import { query } from './db.js';

export async function createPerson({ firstName, lastName, username, email, googleUserId } = {}) {
  const result = await query(
    `INSERT INTO person (first_name, last_name, username, email, google_user_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING user_id, first_name, last_name, username, email, google_user_id`,
    [firstName || null, lastName || null, username || null, email || null, googleUserId || null]
  );
  return result.rows[0];
}

export async function getPersonById(userId) {
  const result = await query(
    'SELECT user_id, first_name, last_name, username, email, google_user_id FROM person WHERE user_id = $1',
    [userId]
  );
  return result.rows[0] || null;
}

export async function listPeople() {
  const result = await query(
    'SELECT user_id, first_name, last_name, username, email, google_user_id FROM person ORDER BY user_id ASC'
  );
  return result.rows;
}
