const { pool } = require('../db');

const createUser = async(googleId, email, fname, lname, username) => {
    const query = `
        INSERT INTO person (google_user_id, email, name, first_name, last_name, username)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
    `
    const result = await pool.query(query, [googleId, email, fname, lname, username]);
    return result.rows[0];
};