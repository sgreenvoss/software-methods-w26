import { query } from './db.js';

export async function findCalendarByGcalIdAndPerson(gcalId, personId) {
  const result = await query(
    `SELECT calendar_id, gcal_id, calendar_name, person_id
     FROM calendar
     WHERE gcal_id = $1 AND person_id ${personId == null ? 'IS NULL' : '= $2'}
     LIMIT 1`,
    personId == null ? [gcalId] : [gcalId, personId]
  );
  return result.rows[0] || null;
}

export async function createCalendar(gcalId, calendarName, personId) {
  const result = await query(
    'INSERT INTO calendar (gcal_id, calendar_name, person_id) VALUES ($1, $2, $3) RETURNING calendar_id, gcal_id, calendar_name, person_id',
    [gcalId, calendarName, personId ?? null]
  );
  return result.rows[0];
}

export async function getOrCreateCalendar(gcalId, calendarName, personId) {
  const existing = await findCalendarByGcalIdAndPerson(gcalId, personId ?? null);
  if (existing) return existing;
  return createCalendar(gcalId, calendarName, personId ?? null);
}
