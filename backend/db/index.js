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


const insertUpdateUser = async(google_id, email, first_name, last_name, username, refresh_token, access_token, token_expiry) => {
    var _username = username;
    if (!username) {
        _username = first_name; // temp fix
    }
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
    // double check - might just be .id?
    console.log('insert result:', result.rows[0]);
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

const addEvents = async(cal_id, events) => {
    for (let i = 0; i < events.length; i++) {
        // TODO: consider the logic for doing nothing -> might want to update instead? 
        await pool.query(
            `INSERT INTO cal_event (calendar_id, priority, event_start, event_end, event_name, gcal_event_id)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT DO NOTHING`,
            [
                cal_id,
                1, // for testing purposes
                events[i].start,
                events[i].end,
                events[i].title,
                events[i].event_id
            ]
        );
    };
}

const getUserByID = async(user_id) => {
    const result = await pool.query(
        `SELECT google_id, refresh_token, access_token, token_expiry FROM person WHERE user_id = $1`, [user_id]
    );
    return result.rows[0];
}

// TODO: get userwithID
// get groups from user
// get users from group
// check if user already in db
// get stored events from a user

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
        VALUES ($1, $2)`;
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
    getCalendarID,
    updateTokens,
    createGroup,
    addUserToGroup,
    getGroupsByUID,
    leaveGroup
}