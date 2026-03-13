/*
File: algorithm_adapter.js
Purpose:
 * * Goal: Bridge the gap between the PostgreSQL database and the pure math algorithm.
 * This file handles the dirty work: SQL queries, raw data formatting, and 
 * mapping flat rows into the nested ParticipantSnapshot structure.
Creation Date: 2026-02-19
Initial Author(s): David Haddad

System Context:
 * Sits between persistence and computation layers for group availability. It fetches raw event rows
 * from PostgreSQL, normalizes blocking levels and event timestamps (including all-day corrections),
 * and converts flat query results into ParticipantSnapshot[] input expected by algorithm.js.

*/

// Map the older integer priority values onto the algorithm's blocking labels.
const priorityMapping = {
    1: "B1",
    2: "B2",
    3: "B3"
};

/*
Normalize blocking-level text coming back from the database.
This keeps the algorithm input using the B1/B2/B3 format.
*/
function normalizeBlockingLevel(level) {
    const normalized = typeof level === "string" ? level.trim().toUpperCase() : "";
    if (normalized === "B1" || normalized === "B2" || normalized === "B3") {
        return normalized;
    }
    return "B3";
}

/*
Adjust all-day events to the user's local midnight boundaries.
This keeps midnight-to-midnight rows lining up with the frontend calendar.
*/
function adjustIfAllDay(startMs, endMs, windowStartMs) {
    const start = new Date(startMs);
    const end = new Date(endMs);

    // Only shift rows that were stored as midnight-to-midnight UTC spans.
    const isStartMidnightUTC = start.getUTCHours() === 0 && start.getUTCMinutes() === 0;
    const isEndMidnightUTC = end.getUTCHours() === 0 && end.getUTCMinutes() === 0;

    if (isStartMidnightUTC && isEndMidnightUTC) {
        // Derive the local offset from the request window so the event lands on local midnight.
        let offsetMs = windowStartMs % (24 * 60 * 60 * 1000);
        
        // Convert offsets above 12 hours into the negative local offset form.
        if (offsetMs > 12 * 60 * 60 * 1000) {
            offsetMs -= (24 * 60 * 60 * 1000);
        }

        return {
            adjustedStartMs: startMs + offsetMs,
            adjustedEndMs: endMs + offsetMs
        };
    }

    return { adjustedStartMs: startMs, adjustedEndMs: endMs };
}

/**
 * Transforms flat SQL rows into the nested array required by the algorithm.
 * @param {Array} dbRows - Flat array of objects from Postgres
 * @returns {Array} Array of ParticipantSnapshot objects
 */
function mapDatabaseRowsToParticipants(dbRows, windowStartMs) {
    const participantMap = new Map();

    for (const row of dbRows) {
        const { user_id, event_start, event_end } = row;

        // Keep users with no event rows so empty calendars still stay in the group snapshot.
        if (!participantMap.has(user_id)) {
            participantMap.set(user_id, {
                userId: user_id,
                events: []
            });
        }

        // Only push an event when the LEFT JOIN actually returned one.
        if (event_start && event_end) {
            const levelFromSql = normalizeBlockingLevel(row.blocking_level);
            const levelFromPriority = priorityMapping[row.priority] || "B3";

            // Normalize all-day rows before storing them in the participant snapshot.
            const rawStartMs = new Date(event_start).getTime();
            const rawEndMs = new Date(event_end).getTime();
            
            const { adjustedStartMs, adjustedEndMs } = adjustIfAllDay(rawStartMs, rawEndMs, windowStartMs);

            participantMap.get(user_id).events.push({
                startMs: adjustedStartMs,
                endMs: adjustedEndMs,
                // Prefer blocking_level from SQL and fall back to the older priority column.
                blockingLevel: row.blocking_level == null ? levelFromPriority : levelFromSql
            });
        }
    }

    // Return the snapshots in a plain array for the algorithm module.
    return Array.from(participantMap.values());
}

/**
 * Fetches group events and formats them for the algorithm.
 * 
 * @param {Object} db - Your PostgreSQL connection pool
 * @param {number|string} groupId - The ID of the group
 * @param {number} windowStartMs - Epoch timestamp for the start of the search window
 * @param {number} windowEndMs - Epoch timestamp for the end of the search window
 * @returns {Promise<Array>} The formatted participants array
 */
async function fetchAndMapGroupEvents(db, groupId, windowStartMs, windowEndMs) {
    // Turn the requested epoch window back into timestamp strings for SQL.
    const startTimestamp = new Date(windowStartMs).toISOString();
    const endTimestamp = new Date(windowEndMs).toISOString();

    const query = `
        WITH group_users AS (
            SELECT gm.user_id
            FROM group_match gm
            WHERE gm.group_id = $3
        ),
        calendar_rows AS (
            SELECT
                gu.user_id,
                ce.event_start,
                ce.event_end,
                CASE
                    WHEN ce.priority = 1 THEN 'B1'
                    WHEN ce.priority = 2 THEN 'B2'
                    WHEN ce.priority = 3 THEN 'B3'
                    ELSE 'B3'
                END AS blocking_level
            FROM group_users gu
            LEFT JOIN calendar c
                ON c.user_id = gu.user_id
            LEFT JOIN cal_event ce
                ON ce.calendar_id = c.calendar_id
               AND ce.event_end > $1
               AND ce.event_start < $2
        ),
        petition_rows AS (
            SELECT
                pr.user_id,
                p.start_time AS event_start,
                p.end_time AS event_end,
                COALESCE(p.blocking_level, 'B3') AS blocking_level
            FROM petitions p
            JOIN petition_responses pr
                ON pr.petition_id = p.petition_id
               AND pr.response = 'ACCEPTED'
            JOIN group_users gu
                ON gu.user_id = pr.user_id
            WHERE p.end_time > $1
              AND p.start_time < $2
              AND NOT EXISTS (
                  SELECT 1
                  FROM petition_responses pr_declined
                  WHERE pr_declined.petition_id = p.petition_id
                    AND pr_declined.response = 'DECLINED'
              )
        ),
        event_rows AS (
            SELECT user_id, event_start, event_end, blocking_level
            FROM calendar_rows
            UNION ALL
            SELECT user_id, event_start, event_end, blocking_level
            FROM petition_rows
        )
        SELECT
            gu.user_id,
            er.event_start,
            er.event_end,
            er.blocking_level
        FROM group_users gu
        LEFT JOIN event_rows er
            ON er.user_id = gu.user_id
        ORDER BY gu.user_id ASC, er.event_start ASC NULLS FIRST;
    `;

    const values = [startTimestamp, endTimestamp, groupId];

    try {
        const result = await db.query(query, values);
        
        // Reduce the SQL rows into the participant shape the algorithm expects.
        const formattedParticipants = mapDatabaseRowsToParticipants(result.rows, windowStartMs);
        return formattedParticipants;
        
    } catch (error) {
        console.error("Error fetching group events for algorithm:", error);
        throw error;
    }
}

module.exports = {
    fetchAndMapGroupEvents,
    mapDatabaseRowsToParticipants // Export this separately so the adapter tests can target the reducer.
};
