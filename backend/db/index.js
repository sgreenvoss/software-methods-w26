const { Pool } = require('pg');
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? true : false
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
    getUsersWithName
}