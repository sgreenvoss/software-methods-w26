/**
 * algorithmAdapter.js
 * * Goal: Bridge the gap between the PostgreSQL database and the pure math algorithm.
 * This file handles the dirty work: SQL queries, raw data formatting, and 
 * mapping flat rows into the nested ParticipantSnapshot structure.
 */

// Map DB priority integers to the algorithm's BlockingLevel strings
const priorityMapping = {
    1: "B1", // Lax
    2: "B2", // Flexible
    3: "B3"  // Strict
};

/**
 * Transforms flat SQL rows into the nested array required by the algorithm.
 * * @param {Array} dbRows - Flat array of objects from Postgres
 * @returns {Array} Array of ParticipantSnapshot objects
 */
function mapDatabaseRowsToParticipants(dbRows) {
    const participantMap = new Map();

    for (const row of dbRows) {
        const { user_id, event_start, event_end, priority } = row;

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
                blockingLevel: priorityMapping[priority] || "B3" // Default to lenient if missing
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
        SELECT 
            gm.user_id, 
            ce.event_start, 
            ce.event_end, 
            ce.priority
        FROM group_match gm
        LEFT JOIN calendar c ON c.user_id = gm.user_id
        LEFT JOIN cal_event ce ON ce.calendar_id = c.calendar_id
            AND ce.event_end > $1
            AND ce.event_start < $2
        WHERE gm.group_id = $3
        ORDER BY gm.user_id ASC, ce.event_start ASC;
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