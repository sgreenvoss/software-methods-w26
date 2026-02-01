import { query } from './db.js';

export async function getSyncMeta(calendarId) {
  const result = await query(
    'SELECT calendar_id, last_refreshed, last_error, sync_token FROM calendar_sync_meta WHERE calendar_id = $1',
    [calendarId]
  );
  return result.rows[0] || null;
}

export async function upsertSyncMeta({ calendarId, lastRefreshed, lastError, syncToken }) {
  const result = await query(
    `INSERT INTO calendar_sync_meta (calendar_id, last_refreshed, last_error, sync_token)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (calendar_id)
     DO UPDATE SET last_refreshed = EXCLUDED.last_refreshed,
                   last_error = EXCLUDED.last_error,
                   sync_token = EXCLUDED.sync_token
     RETURNING calendar_id, last_refreshed, last_error, sync_token`,
    [calendarId, lastRefreshed, lastError, syncToken]
  );
  return result.rows[0];
}
