/*
File: dbInterface.js
Purpose: Holds the shared PostgreSQL queries used across the backend.
    This file keeps connection setup, user/group helpers, and petition helpers in one place.
*/

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

require('dotenv').config({
  path: process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development'
});

const isProduction = process.env.NODE_ENV === 'production';

const pool = new Pool(
    isProduction 
    ? { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }
    : { // Local development connection settings.
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        password: process.env.DB_PASSWORD,
        port: process.env.DB_PORT,
        ssl: false
      }
);

const testConnection = async () => {
    const result = await pool.query('SELECT NOW()');
    return {
        success: true,
        timestamp: result.rows[0].now,
        message: "Database connected successfully!"
    };
};

const PETITION_TABLE_NAMES = ["petitions", "petition_responses"];

const isMissingPetitionRelationError = (error) => {
    if (!error) return false;
    if (error.appCode === "PETITION_SCHEMA_MISSING") return true;
    if (error.code !== "42P01") return false;

    const message = String(error.message || "").toLowerCase();
    return PETITION_TABLE_NAMES.some((tableName) => message.includes(tableName));
}

const toPetitionSchemaError = (error) => {
    if (!isMissingPetitionRelationError(error)) return error;

    const wrapped = new Error("Petition schema is not initialized");
    wrapped.status = 503;
    wrapped.appCode = "PETITION_SCHEMA_MISSING";
    wrapped.pgCode = error.code || null;
    wrapped.cause = error;
    return wrapped;
}

const assertPetitionSchemaReady = async(executor = pool) => {
    try {
        const checkSql = `
            SELECT
                to_regclass('public.petitions') AS petitions_table,
                to_regclass('public.petition_responses') AS petition_responses_table
        `;
        const result = await executor.query(checkSql);
        const row = result.rows[0] || {};
        const missingTables = [];

        if (!row.petitions_table) {
            missingTables.push("petitions");
        }
        if (!row.petition_responses_table) {
            missingTables.push("petition_responses");
        }

        if (missingTables.length > 0) {
            const err = new Error(`Petition schema is not initialized: missing ${missingTables.join(", ")}`);
            err.status = 503;
            err.appCode = "PETITION_SCHEMA_MISSING";
            err.missingTables = missingTables;
            throw err;
        }
    } catch (error) {
        throw toPetitionSchemaError(error);
    }
}

const ensurePetitionSchema = async() => {
    const schemaPath = path.resolve(__dirname, '..', '..', 'db', '001_petitions_schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    await pool.query(schemaSql);
    await assertPetitionSchemaReady(pool);
};


/**
 * @param {*} google_id 
 * @param {*} email 
 * @param {*} first_name 
 * @param {*} last_name 
 * @param {*} username if the user is new, the username will be set to the string "New user!" 
 * @param {*} refresh_token 
 * @param {*} access_token 
 * @param {bigint} token_expiry 
 * @returns user_id
 */
const insertUpdateUser = async(google_id, email, first_name, last_name, username, refresh_token, access_token, token_expiry) => {
    var _username = username;
    if (!username) {
        _username = "New user!";
    }
    // Route-level validation handles username rules before this upsert runs.
    const result = await pool.query( `
        INSERT INTO person (google_id, email, first_name, last_name, username, refresh_token, access_token, token_expiry)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (google_id)
        DO UPDATE SET 
            access_token = $7,
            token_expiry = $8,
            updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT * 1000
        RETURNING user_id`,
        [   
            google_id,
            email,
            first_name,
            last_name,
            _username,
            refresh_token,
            access_token,
            token_expiry
        ]
    );
    return result.rows[0].user_id;
}

const addCalendar = async(user_id, calendar_name="primary", google_calendar_id="primary") => {
    const result = await pool.query(
        `INSERT INTO calendar (user_id, calendar_name, google_calendar_id)
        VALUES ($1, $2, $3)
        ON CONFLICT DO NOTHING
        RETURNING calendar_id, user_id, calendar_name, google_calendar_id`,
        [
            user_id,
            calendar_name,
            google_calendar_id
        ]
    );
    console.log('inserted calendar:', result.rows[0]);
    return result.rows[0]
}

const getCalendarID = async(user_id) => {
    const result = await pool.query(
        `SELECT calendar_id FROM calendar
        WHERE user_id = $1`,
        [user_id]
    );
    return result.rows[0];
}

const getCalendarsByUserID = async(user_id) => {
    const result = await pool.query(
        `SELECT calendar_id, calendar_name, google_calendar_id FROM calendar
        WHERE user_id = $1`,
        [user_id]
    );
    return result.rows;
}

const addEvents = async(cal_id, events, priority=3) => {
    for (let i = 0; i < events.length; i++) { 
        await pool.query(
            `INSERT INTO cal_event (calendar_id, priority, event_start, event_end, event_name, gcal_event_id)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT DO NOTHING`,
            [
                cal_id,
                events[i].priority,
                events[i].start,
                events[i].end,
                events[i].title,
                events[i].event_id
            ]
        );
    };
}

// Update the blocking level for one stored event.
const updateEventPriority = async(event_id, priority) => {
    const query = `
        UPDATE cal_event
        SET priority = $1
        WHERE gcal_event_id = $2
        RETURNING *
    `;
    const res = await pool.query(query, [priority, event_id]);
    return res.rows[0];
}

// Update every matching title for one user's calendars.
const updateEventPriorityByTitle = async (userId, title, priority) => {
    const query = `
        UPDATE cal_event
        SET priority = $1
        WHERE event_name = $2
          AND calendar_id IN (SELECT calendar_id FROM calendar WHERE user_id = $3)
        RETURNING *
    `;
    const res = await pool.query(query, [priority, title, userId]);
    return res.rows; // Returns array of all updated rows
}

// Delete one event by its Google Calendar event id.
const deleteEventByGcalEventId = async(event_id) => {
    const query = `
        DELETE FROM cal_event
        WHERE gcal_event_id = $1
        RETURNING *
    `;
    const res = await pool.query(query, [event_id]);
    return res.rows[0];
}

const deleteEventsByTitle = async(userId, title) => {
    try {
        // Delete all exact title matches for this user's calendars.
        const query = `
            DELETE FROM cal_event 
            WHERE event_name = $2
            AND calendar_id IN (
                SELECT calendar_id 
                FROM public.calendar 
                WHERE user_id = $1
            )
        `;
        const result = await pool.query(query, [userId, title]);
        
        // Return the number of rows removed for the caller.
        return { success: true, deletedCount: result.rowCount };
    } catch (error) {
        console.error("Error deleting events by title:", error);
        throw error;
    }
}

/**
 * Deletes events for one calendar that ended before the provided cutoff date.
 * @param {*} cal_id
 * @param {*} date
 */
const cleanEvents = async(cal_id, date) => {
    await pool.query(
        `DELETE FROM cal_event 
        WHERE calendar_id = ($1) 
        AND event_end < ($2)`,
        [   
            cal_id,
            date
        ]
    );
}

const getEventsByCalendarID = async(cal_id) => {
    const result = await pool.query(
        `SELECT * FROM cal_event
        WHERE calendar_id = $1
        ORDER BY event_start ASC`,
        [cal_id]
    );
    return result.rows;
}

const deleteEventsByIds = async(cal_id, gcal_event_ids) => {
    if (!gcal_event_ids || gcal_event_ids.length === 0) return;
    
    await pool.query(
        `DELETE FROM cal_event 
        WHERE calendar_id = $1 
        AND gcal_event_id = ANY($2)`,
        [cal_id, gcal_event_ids]
    );
}

const updateEvent = async(cal_id, gcal_event_id, eventData) => {
    await pool.query(
        `UPDATE cal_event 
        SET event_start = $1, event_end = $2, event_name = $3
        WHERE calendar_id = $4 AND gcal_event_id = $5`,
        [
            eventData.start,
            eventData.end,
            eventData.title,
            cal_id,
            gcal_event_id
        ]
    );
}

const getUserByID = async(user_id) => {
    const result = await pool.query(
        `SELECT user_id, username, email, first_name, last_name, google_id, refresh_token, access_token, token_expiry 
        FROM person 
        WHERE user_id = $1`, [user_id]
    );
    return result.rows[0];
}

const getUsersWithName = async(name) => {
    console.log('running q');
    const query = `
        SELECT email, last_name, username FROM person
        WHERE first_name = $1 
    `
    const result = await pool.query(query, [name]);
    console.log(result);
    return result;
}

const getNameByID = async(id) => {
    const query =  `
    SELECT email, first_name, username FROM person
    WHERE user_id = $1`
    const result = await pool.query(query, [id]);
    return result;
}

const searchFor = async(search) => {
    // Match usernames by prefix so the search dropdown can autocomplete.
    const result = await pool.query(
        `SELECT user_id, username FROM person 
        WHERE username ILIKE $1 LIMIT 10`,
        [`${search}%`]
    );
    return result;
}

/**
 * Updates a user's access token and token expiry in the person table
 * @param {bigint} id user_id in the database
 * @param {text} access access token
 * @param {bigint} expiry token expiry date (as epoch)
 */
const updateTokens = async(id, access, expiry) => {
    const query = `
        UPDATE person 
            SET 
            access_token = $2,
            token_expiry = $3,
            updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT * 1000
        WHERE user_id = $1
    `;
    await pool.query(query, [
        id,
        access,
        expiry
    ]);
}

/**
 * Creates a new group in the table f_group.
 * @param {string} g_name name of the group
 * @returns {bigint} group id
 */
const createGroup = async(g_name) => {
    const query = `
        INSERT INTO f_group (group_name)
        VALUES ($1)
        RETURNING group_id`;
    const result = await pool.query(query, [
        g_name
    ]);
    return result.rows[0].group_id;
}

/**
 * Atomically create a group and attach the creator as a member.
 * @param {string} g_name
 * @param {bigint|string|number} creator_user_id
 * @returns {Promise<bigint>}
 */
const createGroupWithCreator = async(g_name, creator_user_id) => {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const groupResult = await client.query(
            `INSERT INTO f_group (group_name)
             VALUES ($1)
             RETURNING group_id`,
            [g_name]
        );
        const groupId = groupResult.rows[0].group_id;

        await client.query(
            `INSERT INTO group_match (group_id, user_id)
             VALUES ($1, $2)`,
            [groupId, creator_user_id]
        );

        await client.query("COMMIT");
        return groupId;
    } catch (error) {
        try {
            await client.query("ROLLBACK");
        } catch (rollbackError) {
            console.error("rollback failed while creating group transaction", rollbackError);
        }
        throw error;
    } finally {
        client.release();
    }
}

const addUserToGroup = async(group_id, user_id) => {
    const query = `
        INSERT INTO group_match (group_id, user_id)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING`;
    await pool.query(query, [
        group_id,
        user_id
    ]);
}

const getGroupsByUID = async(user_id) => {
    const query = `
        SELECT * FROM f_group
        JOIN group_match ON group_match.group_id = f_group.group_id
        WHERE group_match.user_id = ($1);`;
    const result = await pool.query(query, [user_id]);
    return result.rows;
}

const getUIDByGroupID = async(group_id) => {
    const query = `
        SELECT user_id FROM group_match
        WHERE group_id = ($1)`;
    const res = await pool.query(query, [group_id]);
    return res;
}

const getGroupById = async(group_id) => {
    const query = `
        SELECT group_id, group_name FROM f_group
        WHERE group_id = ($1)`;
    const res = await pool.query(query, [group_id]);
    return res.rows[0] || null;
}

const isUserInGroup = async(user_id, group_id) => {
    const query = `
        SELECT user_id FROM group_match
        WHERE group_id = ($1) AND user_id = ($2)`;
    const res = await pool.query(query, [group_id, user_id]);
    return (res.rowCount > 0);
}

const getGroupByID = async(group_id) => {
    const query = `
        SELECT * FROM f_group WHERE group_id = ($1)`;
    const res = await pool.query(query, [group_id]);
    return res.rows;
}

const getGroupMembersByID = async(group_id) => {
    const query = `
        SELECT p.username, p.user_id 
        FROM person p
        JOIN group_match gm ON p.user_id = gm.user_id
        WHERE gm.group_id = ($1)
    `;
    const res = await pool.query(query, [group_id]);
    return res.rows;
}

const deleteGroup = async(group_id) => {
    const query = `DELETE FROM f_group WHERE group_id = ($1)`;
    await pool.query(query, [group_id]);
}

const leaveGroup = async(user_id, group_id) => {
    try {
        const query = `
            DELETE FROM group_match 
            WHERE group_id = ($1) AND user_id = ($2)`;
        await pool.query(query, [group_id, user_id]);
        
        const members = await getUIDByGroupID(group_id); 
        console.log("members of that group remaining: ", members);

        if (!members.rows[0]) {
            console.log("no more members, deleting this group.");
            await deleteGroup(group_id);
        }
    } catch (error) {
        console.error(error);
    }
}

/**
 * @param {bigint} user_id unique user id. NOT their google id.
 * @param {string} new_username new username the user wants. Note that this is not checking for proper length or encoding.
 */
const updateUsername = async(user_id, new_username) => {
    try {
        const query = `
            UPDATE person
            SET username = ($1)
            WHERE user_id = ($2)`;
        await pool.query(query, [new_username, user_id]);
    } catch (error) {
        console.error(error);
    }
}

const checkUsernameExists = async(username) => {
    const result = await pool.query(
        `SELECT user_id FROM person WHERE username = $1`,
        [username]
    );
    return result.rows.length > 0;
}

// --- petition helpers ---

const PETITION_CTES = `
WITH response_counts AS (
    SELECT
        petition_id,
        COUNT(*) FILTER (WHERE response = 'ACCEPTED')::INT AS accepted_count,
        COUNT(*) FILTER (WHERE response = 'DECLINED')::INT AS declined_count
    FROM petition_responses
    GROUP BY petition_id
),
group_sizes AS (
    SELECT
        group_id,
        COUNT(*)::INT AS group_size
    FROM group_match
    GROUP BY group_id
)
`;

const PETITION_SELECT_COLUMNS = `
    p.petition_id,
    p.group_id,
    p.created_by_user_id,
    p.title,
    p.start_time,
    p.end_time,
    p.blocking_level,
    COALESCE(rc.accepted_count, 0)::INT AS accepted_count,
    COALESCE(rc.declined_count, 0)::INT AS declined_count,
    COALESCE(gs.group_size, 0)::INT AS group_size,
    cur.response AS current_user_response,
    CASE
        WHEN COALESCE(rc.declined_count, 0) > 0 THEN 'FAILED'
        WHEN COALESCE(gs.group_size, 0) > 0
         AND COALESCE(rc.accepted_count, 0) = COALESCE(gs.group_size, 0) THEN 'ACCEPTED_ALL'
        ELSE 'OPEN'
    END AS status,
    p.created_at,
    p.updated_at,
    g.group_name
`;

const getPetitionByIdForUser = async(executor, petitionId, userId) => {
    const sql = `
        ${PETITION_CTES}
        SELECT
            ${PETITION_SELECT_COLUMNS}
        FROM petitions p
        JOIN f_group g ON g.group_id = p.group_id
        LEFT JOIN group_sizes gs ON gs.group_id = p.group_id
        LEFT JOIN response_counts rc ON rc.petition_id = p.petition_id
        LEFT JOIN petition_responses cur
            ON cur.petition_id = p.petition_id
           AND cur.user_id = $2
        WHERE p.petition_id = $1
    `;
    const result = await executor.query(sql, [petitionId, userId]);
    return result.rows[0] || null;
}

const createPetition = async({ groupId, creatorUserId, title, startMs, endMs, blockingLevel }) => {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const insertSql = `
            INSERT INTO petitions (
                group_id,
                created_by_user_id,
                title,
                start_time,
                end_time,
                blocking_level
            )
            VALUES (
                $1,
                $2,
                $3,
                to_timestamp($4 / 1000.0),
                to_timestamp($5 / 1000.0),
                $6
            )
            RETURNING petition_id
        `;
        const insertResult = await client.query(insertSql, [
            groupId,
            creatorUserId,
            title,
            startMs,
            endMs,
            blockingLevel
        ]);

        const petitionId = insertResult.rows[0].petition_id;

        await client.query(
            `
            INSERT INTO petition_responses (petition_id, user_id, response)
            VALUES ($1, $2, 'ACCEPTED')
            ON CONFLICT (petition_id, user_id)
            DO UPDATE SET
                response = EXCLUDED.response,
                responded_at = NOW()
            `,
            [petitionId, creatorUserId]
        );

        await client.query(
            `
            UPDATE petitions
            SET updated_at = NOW()
            WHERE petition_id = $1
            `,
            [petitionId]
        );

        const row = await getPetitionByIdForUser(client, petitionId, creatorUserId);

        await client.query("COMMIT");
        return row;
    } catch (error) {
        await client.query("ROLLBACK");
        throw toPetitionSchemaError(error);
    } finally {
        client.release();
    }
}

const listGroupPetitions = async({ groupId, userId }) => {
    try {
        const sql = `
            ${PETITION_CTES}
            SELECT
                ${PETITION_SELECT_COLUMNS}
            FROM petitions p
            JOIN f_group g ON g.group_id = p.group_id
            LEFT JOIN group_sizes gs ON gs.group_id = p.group_id
            LEFT JOIN response_counts rc ON rc.petition_id = p.petition_id
            LEFT JOIN petition_responses cur
                ON cur.petition_id = p.petition_id
               AND cur.user_id = $2
            WHERE p.group_id = $1
            ORDER BY p.start_time ASC, p.petition_id DESC
        `;
        const result = await pool.query(sql, [groupId, userId]);
        return result.rows;
    } catch (error) {
        throw toPetitionSchemaError(error);
    }
}

const listUserPetitions = async({ userId }) => {
    try {
        const sql = `
            ${PETITION_CTES}
            SELECT
                ${PETITION_SELECT_COLUMNS}
            FROM petitions p
            JOIN f_group g ON g.group_id = p.group_id
            LEFT JOIN group_match gm
                ON gm.group_id = p.group_id
               AND gm.user_id = $1
            LEFT JOIN group_sizes gs ON gs.group_id = p.group_id
            LEFT JOIN response_counts rc ON rc.petition_id = p.petition_id
            LEFT JOIN petition_responses cur
                ON cur.petition_id = p.petition_id
               AND cur.user_id = $1
            WHERE gm.user_id IS NOT NULL
               OR p.created_by_user_id = $1
            ORDER BY p.start_time ASC, p.petition_id DESC
        `;
        const result = await pool.query(sql, [userId]);
        return result.rows;
    } catch (error) {
        throw toPetitionSchemaError(error);
    }
}

const respondToPetition = async({ petitionId, userId, response }) => {
    const normalizedResponse = String(response || "").toUpperCase();
    if (normalizedResponse !== "ACCEPTED" && normalizedResponse !== "DECLINED") {
        const err = new Error("response must be ACCEPTED or DECLINED");
        err.status = 400;
        throw err;
    }

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const petitionResult = await client.query(
            `
            SELECT petition_id, group_id
            FROM petitions
            WHERE petition_id = $1
            FOR UPDATE
            `,
            [petitionId]
        );

        const petition = petitionResult.rows[0];
        if (!petition) {
            const err = new Error("Petition not found");
            err.status = 404;
            throw err;
        }

        const memberResult = await client.query(
            `
            SELECT 1
            FROM group_match
            WHERE group_id = $1
              AND user_id = $2
            `,
            [petition.group_id, userId]
        );
        if (memberResult.rowCount === 0) {
            const err = new Error("Forbidden");
            err.status = 403;
            throw err;
        }

        await client.query(
            `
            INSERT INTO petition_responses (petition_id, user_id, response)
            VALUES ($1, $2, $3)
            ON CONFLICT (petition_id, user_id)
            DO UPDATE SET
                response = EXCLUDED.response,
                responded_at = NOW()
            `,
            [petitionId, userId, normalizedResponse]
        );

        await client.query(
            `
            UPDATE petitions
            SET updated_at = NOW()
            WHERE petition_id = $1
            `,
            [petitionId]
        );

        const row = await getPetitionByIdForUser(client, petitionId, userId);

        await client.query("COMMIT");
        return row;
    } catch (error) {
        await client.query("ROLLBACK");
        throw toPetitionSchemaError(error);
    } finally {
        client.release();
    }
}

const deletePetitionByCreator = async({ petitionId, userId }) => {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const petitionResult = await client.query(
            `
            SELECT petition_id, created_by_user_id
            FROM petitions
            WHERE petition_id = $1
            FOR UPDATE
            `,
            [petitionId]
        );

        const petition = petitionResult.rows[0];
        if (!petition) {
            const err = new Error("Petition not found");
            err.status = 404;
            throw err;
        }

        if (Number(petition.created_by_user_id) !== Number(userId)) {
            const err = new Error("Forbidden");
            err.status = 403;
            throw err;
        }

        await client.query(
            `
            DELETE FROM petition_responses
            WHERE petition_id = $1
            `,
            [petitionId]
        );

        await client.query(
            `
            DELETE FROM petitions
            WHERE petition_id = $1
            `,
            [petitionId]
        );

        await client.query("COMMIT");
        return { ok: true, petitionId };
    } catch (error) {
        try {
            await client.query("ROLLBACK");
        } catch (rollbackError) {
            console.error("rollback failed while deleting petition", rollbackError);
        }
        throw toPetitionSchemaError(error);
    } finally {
        client.release();
    }
}

module.exports = {
    pool,
    query: (text, params) => pool.query(text,params),
    testConnection,
    assertPetitionSchemaReady,
    ensurePetitionSchema,
    getUsersWithName,
    getUserByID,
    getNameByID,
    insertUpdateUser,
    searchFor,
    addCalendar,
    addEvents,
    updateEventPriority,
    updateEventPriorityByTitle,
    deleteEventByGcalEventId,
    deleteEventsByTitle,
    getEventsByCalendarID,
    deleteEventsByIds,
    updateEvent,
    getCalendarID,
    getCalendarsByUserID,
    updateTokens,
    createGroup,
    createGroupWithCreator,
    addUserToGroup,
    getGroupsByUID,
    getGroupById,
    getGroupByID,
    getGroupMembersByID,
    leaveGroup,
    updateUsername,
    checkUsernameExists,
    isUserInGroup,
    cleanEvents,
    createPetition,
    listGroupPetitions,
    listUserPetitions,
    respondToPetition,
    deletePetitionByCreator
}
