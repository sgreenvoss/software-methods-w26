// build_availability_from_ics.mjs
import fs from "fs";
import path from "path";
import { computeAvailabilityBlocks, DEFAULT_G_MINUTES } from "../availability.js";

/**
 * Minimal ICS parser for VEVENT DTSTART/DTEND in UTC ("...Z") format.
 * This is intentionally small + predictable for *your generated* ICS files.
 *
 * If later you import real Google ICS with TZID, RRULE, etc.,
 * you’ll want a library (node-ical / ical.js).
 */

// --- helpers ---
function unfoldLines(text) {
  // ICS line folding: lines can continue if the next line starts with space or tab.
  // This recombines folded lines.
  const raw = text.replace(/\r\n/g, "\n").split("\n");
  const out = [];
  for (const line of raw) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && out.length > 0) {
      out[out.length - 1] += line.slice(1);
    } else {
      out.push(line);
    }
  }
  return out;
}

function parseIcsUtcDateTime(value) {
  // Expect: YYYYMMDDTHHMMSSZ
  // Example: 20260105T090000Z
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(value);
  if (!m) return null;
  const [_, y, mo, d, h, mi, s] = m;
  return Date.UTC(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(h),
    Number(mi),
    Number(s),
    0
  );
}

function icsEscape(s) {
  return String(s)
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function toIcsDateTime(ms) {
  const d = new Date(ms);
  return (
    d.getUTCFullYear() +
    pad2(d.getUTCMonth() + 1) +
    pad2(d.getUTCDate()) +
    "T" +
    pad2(d.getUTCHours()) +
    pad2(d.getUTCMinutes()) +
    pad2(d.getUTCSeconds()) +
    "Z"
  );
}

function makeVevent({ uid, startMs, endMs, summary, description = "" }) {
  const lines = [
    "BEGIN:VEVENT",
    `UID:${icsEscape(uid)}`,
    `DTSTAMP:${toIcsDateTime(Date.now())}`,
    `DTSTART:${toIcsDateTime(startMs)}`,
    `DTEND:${toIcsDateTime(endMs)}`,
    `SUMMARY:${icsEscape(summary)}`,
  ];
  if (description) lines.push(`DESCRIPTION:${icsEscape(description)}`);
  lines.push("END:VEVENT");
  return lines.join("\r\n");
}

function makeCalendar({ calName, events }) {
  const header = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//DAGS Algorithm//Availability Debug//EN",
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${icsEscape(calName)}`,
  ].join("\r\n");

  return [header, events.join("\r\n"), "END:VCALENDAR"].join("\r\n") + "\r\n";
}

// --- core: parse VEVENTs from one ICS file ---
function parseEventsFromIcs(fileText) {
  const lines = unfoldLines(fileText);

  const events = [];
  let inEvent = false;
  let dtStart = null;
  let dtEnd = null;

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      inEvent = true;
      dtStart = null;
      dtEnd = null;
      continue;
    }
    if (line === "END:VEVENT") {
      if (inEvent && dtStart != null && dtEnd != null && dtEnd > dtStart) {
        events.push({ startMs: dtStart, endMs: dtEnd });
      }
      inEvent = false;
      continue;
    }
    if (!inEvent) continue;

    // Accept formats:
    // DTSTART:20260105T090000Z
    // DTEND:20260105T103000Z
    // (Ignore TZID and other complexities for now.)
    if (line.startsWith("DTSTART")) {
      const parts = line.split(":");
      const value = parts[parts.length - 1];
      dtStart = parseIcsUtcDateTime(value);
    } else if (line.startsWith("DTEND")) {
      const parts = line.split(":");
      const value = parts[parts.length - 1];
      dtEnd = parseIcsUtcDateTime(value);
    }
  }

  return events;
}

// --- Build participants from calendar_*.ics files ---
const inputFiles = process.argv.slice(2);
if (inputFiles.length < 3) {
  console.error("Usage: node build_availability_from_ics.mjs calendar_A.ics calendar_B.ics calendar_C.ics");
  process.exit(1);
}

const participants = [];
let globalMin = Infinity;
let globalMax = -Infinity;

for (const file of inputFiles) {
  const text = fs.readFileSync(file, "utf8");

  // userId: use filename stem (calendar_A -> A) if possible
  const stem = path.basename(file).replace(/\.ics$/i, "");
  const m = /calendar_(.+)$/i.exec(stem);
  const userId = m ? m[1] : stem;

  const intervals = parseEventsFromIcs(text);

  // Track global min/max to define a window if you want auto windowing
  for (const it of intervals) {
    globalMin = Math.min(globalMin, it.startMs);
    globalMax = Math.max(globalMax, it.endMs);
  }

  participants.push({
    userId,
    events: intervals.map((it, idx) => ({
      eventRef: `${userId}-${idx}`,
      userId,
      startMs: it.startMs,
      endMs: it.endMs,
      source: "ICS",
      blockingLevel: "B3",
    })),
  });
}

// Choose the window:
// Option A (recommended): hardcode your week window so you know what you're looking at.
// Option B: auto-detect from min/max intervals.
const USE_AUTO_WINDOW = false;

let windowStartMs, windowEndMs;
if (USE_AUTO_WINDOW && Number.isFinite(globalMin) && Number.isFinite(globalMax) && globalMax > globalMin) {
  // small padding so the first/last event isn't right at the edge
  const pad = 60 * 60 * 1000; // 1 hour
  windowStartMs = globalMin - pad;
  windowEndMs = globalMax + pad;
} else {
  // Hardcode a known week (UTC)
  windowStartMs = Date.UTC(2026, 0, 5, 0, 0, 0, 0);
  windowEndMs = windowStartMs + 7 * 24 * 60 * 60 * 1000;
}

const blocks = computeAvailabilityBlocks({
  windowStartMs,
  windowEndMs,
  participants,
  granularityMinutes: DEFAULT_G_MINUTES,
  priority: "B3",
});

// Writing 672 events/week at 15-min is noisy but correct.
// You can filter to make visualization usable.
const OUTPUT_MODE = "THRESHOLD"; // "ALL_BLOCKS" | "ONLY_ALL_FREE" | "THRESHOLD"
const THRESHOLD_FRACTION = 2 / 3;

function shouldEmit(b) {
  if (OUTPUT_MODE === "ALL_BLOCKS") return true;
  if (OUTPUT_MODE === "ONLY_ALL_FREE") return b.availabilityFraction === 1;
  if (OUTPUT_MODE === "THRESHOLD") return b.availabilityFraction >= THRESHOLD_FRACTION;
  return true;
}

const vevents = [];
for (let i = 0; i < blocks.length; i++) {
  const b = blocks[i];
  if (!shouldEmit(b)) continue;

  const summary = `Avail ${Math.round(b.availabilityFraction * 100)}% (free ${b.availableCount}/${b.totalCount})`;
  const description =
    `freeUserIds=[${b.freeUserIds.join(",")}]\\n` +
    `busyUserIds=[${b.busyUserIds.join(",")}]`;

  vevents.push(
    makeVevent({
      uid: `block-${i}@dags`,
      startMs: b.startMs,
      endMs: b.endMs,
      summary,
      description,
    })
  );
}

fs.writeFileSync(
  "./availability_blocks.ics",
  makeCalendar({ calName: "Availability Blocks (Debug)", events: vevents }),
  "utf8"
);

console.log("Wrote availability_blocks.ics");
console.log("Participants:", participants.map((p) => p.userId).join(", "));
console.log("Blocks computed:", blocks.length);
console.log("Blocks written:", vevents.length, `(mode=${OUTPUT_MODE})`);