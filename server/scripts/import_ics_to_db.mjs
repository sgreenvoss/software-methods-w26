import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getOrCreateCalendar } from '../src/models/calendar.model.js';
import { insertEvents } from '../src/models/cal_event.model.js';
import { query } from '../src/models/db.js';

function usage() {
  console.log('Usage: node scripts/import_ics_to_db.mjs <personId> <icsPath>');
  process.exit(1);
}

function unfoldLines(text) {
  const raw = text.replace(/\r\n/g, '\n').split('\n');
  const out = [];
  for (const line of raw) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && out.length > 0) {
      out[out.length - 1] += line.slice(1);
    } else {
      out.push(line);
    }
  }
  return out;
}

function parseIcsUtcDateTime(value) {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(value);
  if (!m) return null;
  const [_, y, mo, d, h, mi, s] = m;
  return Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s), 0);
}

function parseEventsFromIcs(fileText) {
  const lines = unfoldLines(fileText);
  const events = [];
  let inEvent = false;
  let dtStart = null;
  let dtEnd = null;

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      inEvent = true;
      dtStart = null;
      dtEnd = null;
      continue;
    }
    if (line === 'END:VEVENT') {
      if (inEvent && dtStart != null && dtEnd != null && dtEnd > dtStart) {
        events.push({ startMs: dtStart, endMs: dtEnd });
      }
      inEvent = false;
      continue;
    }
    if (!inEvent) continue;

    if (line.startsWith('DTSTART')) {
      const parts = line.split(':');
      const value = parts[parts.length - 1];
      dtStart = parseIcsUtcDateTime(value);
    } else if (line.startsWith('DTEND')) {
      const parts = line.split(':');
      const value = parts[parts.length - 1];
      dtEnd = parseIcsUtcDateTime(value);
    }
  }

  return events;
}

async function main() {
  const [personIdArg, icsPathArg] = process.argv.slice(2);
  if (!personIdArg || !icsPathArg) usage();

  const personId = Number(personIdArg);
  if (!Number.isFinite(personId)) {
    console.error('personId must be a number');
    process.exit(1);
  }

  const icsPath = path.resolve(process.cwd(), icsPathArg);
  const text = fs.readFileSync(icsPath, 'utf8');
  const intervals = parseEventsFromIcs(text);

  const calendar = await getOrCreateCalendar('primary', 'Primary', personId);

  // Clear existing events for this calendar to keep imports deterministic.
  await query('DELETE FROM cal_event WHERE calendar_id = $1', [calendar.calendar_id]);

  const dbEvents = intervals.map((it) => ({
    eventStart: new Date(it.startMs),
    eventDurationHours: (it.endMs - it.startMs) / (60 * 60 * 1000),
    priority: 0,
  }));

  const result = await insertEvents(calendar.calendar_id, dbEvents);
  console.log(`Imported ${result.inserted} events for personId=${personId} from ${icsPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
