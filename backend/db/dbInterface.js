const { Pool } = require('pg');

require('dotenv').config({
  path: process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development'
});

const isProduction = process.env.NODE_ENV === 'production';

const pool = new Pool(
    isProduction 
    ? { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }
    : { // else for local dev
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
    // need to check if username matches (maybe)
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

const addCalendar = async(user_id, calendar_name="primary") => {
    const result = await pool.query(
        `INSERT INTO calendar (user_id, calendar_name)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING`,
        [
            user_id,
            calendar_name
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

const addEvents = async(cal_id, events, priority=1) => {
    for (let i = 0; i < events.length; i++) {
        // TODO: consider the logic for doing nothing -> might want to update instead? 
        // added event id to query, some function is server expected it
        await pool.query(
            `INSERT INTO cal_event (calendar_id, priority, event_start, event_end, event_name, gcal_event_id)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT DO NOTHING`,
            [
                cal_id,
                priority, // for testing purposes
                events[i].start,
                events[i].end,
                events[i].title,
                events[i].event_id
            ]
        );
    };
}

/**
 * This takes the calendar id and deletes the events
 * under that calendar id that ended a week ago or more
 * @param {*} cal_id 
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
    // regex to search for usernames that start
    // with the user's search
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
    return result.rows[0].group_id; // Garertt changed this line
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

const isUserInGroup = async(user_id, group_id) => {
    const query = `
        SELECT user_id FROM group_match
        WHERE group_id = ($1) AND user_id = ($2)`;
    const res = await pool.query(query, [group_id, user_id]);
    return (res.rowCount > 0);
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
 * 
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
    return result.rows.length > 0; // returns true if exists
}

module.exports = {
    pool,
    query: (text, params) => pool.query(text,params),
    testConnection,
    getUsersWithName,
    getUserByID,
    getNameByID,
    insertUpdateUser,
    searchFor,
    addCalendar,
    addEvents,
    getEventsByCalendarID,
    deleteEventsByIds,
    updateEvent,
    getCalendarID,
    updateTokens,
    createGroup,
    addUserToGroup,
    getGroupsByUID,
    leaveGroup,
    updateUsername,
    checkUsernameExists,
    isUserInGroup,
    cleanEvents
}