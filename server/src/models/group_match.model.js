import { query } from './db.js';

export async function addMemberToGroup(groupId, userId) {
  await query(
    'INSERT INTO group_match (group_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [groupId, userId]
  );
}

export async function listGroupMembers(groupId) {
  const result = await query(
    `SELECT p.user_id, p.first_name, p.last_name, p.username, p.email, p.google_user_id
     FROM group_match gm
     JOIN person p ON p.user_id = gm.user_id
     WHERE gm.group_id = $1
     ORDER BY p.user_id ASC`,
    [groupId]
  );
  return result.rows;
}
