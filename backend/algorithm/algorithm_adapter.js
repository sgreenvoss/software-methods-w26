/**
 * algorithmAdapter.js
 * * Goal: Bridge the gap between the PostgreSQL database and the pure math algorithm.
 * This file handles the dirty work: SQL queries, raw data formatting, and 
 * mapping flat rows into the nested ParticipantSnapshot structure.
 */

function normalizeBlockingLevel(level) {
    if (level === "B1" || level === "B2" || level === "B3") {
        return level;
    }
    return "B3";
}

/**
 * Transforms flat SQL rows into the nested array required by the algorithm.
 * * @param {Array} dbRows - Flat array of objects from Postgres
 * @returns {Array} Array of ParticipantSnapshot objects
 */
function mapDatabaseRowsToParticipants(dbRows) {
    const participantMap = new Map();

    for (const row of dbRows) {
        const { user_id, event_start, event_end, blocking_level } = row;

        // 1. Ensure the user exists in the map (even if they have no events)
        if (!participantMap.has(user_id)) {
            participantMap.set(user_id, {
                userId: user_id,
                events: []
            });
        }

        // 2. If the LEFT JOIN returned an actual event, format and push it
        if (event_start && event_end) {
            participantMap.get(user_id).events.push({
                startMs: new Date(event_start).getTime(),
                endMs: new Date(event_end).getTime(),
                blockingLevel: normalizeBlockingLevel(blocking_level)
            });
        }
    }

    // Convert the Map values back into a standard array
    return Array.from(participantMap.values());
}

/**
 * Fetches group events and formats them for the algorithm.
 * * @param {Object} db - Your PostgreSQL connection pool
 * @param {number|string} groupId - The ID of the group
 * @param {number} windowStartMs - Epoch timestamp for the start of the search window
 * @param {number} windowEndMs - Epoch timestamp for the end of the search window
 * @returns {Promise<Array>} The formatted participants array
 */
async function fetchAndMapGroupEvents(db, groupId, windowStartMs, windowEndMs) {
    // Convert epoch milliseconds back to Postgres timestamps
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
        )
        SELECT user_id, event_start, event_end, blocking_level
        FROM calendar_rows
        UNION ALL
        SELECT user_id, event_start, event_end, blocking_level
        FROM petition_rows
        ORDER BY user_id ASC, event_start ASC NULLS FIRST;
    `;

    const values = [startTimestamp, endTimestamp, groupId];

    try {
        const result = await db.query(query, values);
        
        // Pass the raw Postgres rows into our reducer
        const formattedParticipants = mapDatabaseRowsToParticipants(result.rows);
        return formattedParticipants;
        
    } catch (error) {
        console.error("Error fetching group events for algorithm:", error);
        throw error;
    }
}

module.exports = {
    fetchAndMapGroupEvents,
    mapDatabaseRowsToParticipants // Exported for easy unit testing
};
