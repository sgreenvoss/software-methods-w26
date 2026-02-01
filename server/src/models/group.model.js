import { query } from './db.js';

export async function createGroup(groupName) {
  const result = await query(
    'INSERT INTO f_group (group_name) VALUES ($1) RETURNING group_id, group_name',
    [groupName]
  );
  return result.rows[0];
}

export async function getGroupById(groupId) {
  const result = await query(
    'SELECT group_id, group_name FROM f_group WHERE group_id = $1',
    [groupId]
  );
  return result.rows[0] || null;
}
