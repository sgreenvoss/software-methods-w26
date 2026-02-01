import { query } from './db.js';

export async function deleteEventsInWindow(calendarId, windowStart, windowEnd) {
  await query(
    `DELETE FROM cal_event
     WHERE calendar_id = $1
       AND event_start < $2
       AND event_start + (event_duration || ' hours')::interval > $3`,
    [calendarId, windowEnd, windowStart]
  );
}

export async function insertEvents(calendarId, events) {
  if (!events.length) return { inserted: 0 };

  const values = [];
  const placeholders = [];
  let idx = 1;

  for (const ev of events) {
    placeholders.push(`($${idx++}, $${idx++}, $${idx++}, $${idx++})`);
    values.push(calendarId, ev.priority ?? 0, ev.eventStart, ev.eventDurationHours);
  }

  const sql = `INSERT INTO cal_event (calendar_id, priority, event_start, event_duration)
               VALUES ${placeholders.join(', ')}`;
  await query(sql, values);
  return { inserted: events.length };
}

export async function getEventsOverlappingWindow(calendarId, windowStart, windowEnd) {
  const result = await query(
    `SELECT event_start, event_duration, priority
     FROM cal_event
     WHERE calendar_id = $1
       AND event_start < $2
       AND event_start + (event_duration || ' hours')::interval > $3
     ORDER BY event_start ASC`,
    [calendarId, windowEnd, windowStart]
  );

  return result.rows.map((row) => {
    const startMs = new Date(row.event_start).getTime();
    const endMs = startMs + Number(row.event_duration) * 60 * 60 * 1000;
    return {
      startMs,
      endMs,
      priority: row.priority ?? 0,
    };
  });
}

export async function getEventsForGroupOverlappingWindow(groupId, windowStart, windowEnd) {
  const result = await query(
    `SELECT gm.user_id, ce.event_start, ce.event_duration, ce.priority
     FROM group_match gm
     JOIN calendar c ON c.person_id = gm.user_id
     JOIN cal_event ce ON ce.calendar_id = c.calendar_id
     WHERE gm.group_id = $1
       AND ce.event_start < $2
       AND ce.event_start + (ce.event_duration || ' hours')::interval > $3
     ORDER BY gm.user_id ASC, ce.event_start ASC`,
    [groupId, windowEnd, windowStart]
  );

  return result.rows.map((row) => {
    const startMs = new Date(row.event_start).getTime();
    const endMs = startMs + Number(row.event_duration) * 60 * 60 * 1000;
    return {
      userId: row.user_id,
      startMs,
      endMs,
      priority: row.priority ?? 0,
    };
  });
}
