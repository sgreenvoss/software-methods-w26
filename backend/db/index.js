const { Pool } = require('pg');
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

const testConnection = async () => {
    const result = await pool.query('SELECT NOW()');
    return {
        success: true,
        timestamp: result.rows[0].now,
        message: "Database connected successfully!"
    };
};

const createUser = async(email, fname, lname, username) => {
    const query = `
        INSERT INTO person (email, first_name, last_name, username)
        VALUES ($1, $2, $3, $4)
        RETURNING *
    `
    const result = await pool.query(query, [email, fname, lname, username]);
    return result.rows[0];
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
            refresh_token = $6,
            access_token = $7,
            token_expiry = $8,
            updated_at = NOW()
        RETURNING user_id`,
        [   
            google_id,
            email,
            first_name,
            last_name,
            _username,
            refresh_token,
            access_token,
            new Date(token_expiry)
        ]
    );
    // double check - might just be .id?
    return result.rows[0].user_id;
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

module.exports = {
    pool,
    testConnection,
    createUser,
    getUsersWithName,
    getUserByID,
    insertUpdateUser
}