// generate_week_ics.mjs
import fs from "fs";
import { computeAvailabilityBlocks, DEFAULT_G_MINUTES } from "../availability.js";

// ================================================================
// CONFIG
// ================================================================

// Choose a week start (UTC). This picks Monday Jan 5, 2026 00:00:00Z.
const WEEK_START = Date.UTC(2026, 0, 5, 0, 0, 0, 0); // Jan=0
const WEEK_END = WEEK_START + 7 * 24 * 60 * 60 * 1000;

// Granularity (G)
const G_MINUTES = DEFAULT_G_MINUTES; // 15

// How to write availability blocks to the output ICS:
// - "ALL_BLOCKS": write every G-minute block (huge: 672 events/week at 15-min)
// - "ONLY_ALL_FREE": only blocks where availabilityFraction === 1
// - "THRESHOLD": blocks where availabilityFraction >= THRESHOLD_FRACTION
const OUTPUT_MODE = "THRESHOLD";
const THRESHOLD_FRACTION = 2 / 3; // example: at least 2 of 3 users free

// Optional: if OUTPUT_MODE is "ALL_BLOCKS", color-coding sometimes helps.
// Many viewers ignore this; it’s harmless.
const ADD_CATEGORIES = true;

// Output file names
const OUT_DIR = ".";
const OUT_A = `${OUT_DIR}/calendar_A.ics`;
const OUT_B = `${OUT_DIR}/calendar_B.ics`;
const OUT_C = `${OUT_DIR}/calendar_C.ics`;
const OUT_AVAIL = `${OUT_DIR}/availability_blocks.ics`;

// ================================================================
// Helpers (time + ICS writer)
// ================================================================

const ONE_MIN = 60 * 1000;

function pad2(n) {
  return String(n).padStart(2, "0");
}

/** Convert UTC epoch ms to ICS date-time: YYYYMMDDTHHMMSSZ */
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

/** Basic ICS text escaping */
function icsEscape(s) {
  return String(s)
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

/**
 * Make a simple VEVENT.
 * @param {Object} e
 * @param {string} e.uid
 * @param {number} e.startMs
 * @param {number} e.endMs
 * @param {string} e.summary
 * @param {string} [e.description]
 * @param {string} [e.categories]
 */
function makeVevent({ uid, startMs, endMs, summary, description = "", categories = "" }) {
  const lines = [
    "BEGIN:VEVENT",
    `UID:${icsEscape(uid)}`,
    `DTSTAMP:${toIcsDateTime(Date.now())}`,
    `DTSTART:${toIcsDateTime(startMs)}`,
    `DTEND:${toIcsDateTime(endMs)}`,
    `SUMMARY:${icsEscape(summary)}`,
  ];

  if (description) lines.push(`DESCRIPTION:${icsEscape(description)}`);
  if (categories) lines.push(`CATEGORIES:${icsEscape(categories)}`);

  lines.push("END:VEVENT");
  return lines.join("\r\n");
}

/** Make a full ICS calendar string */
function makeCalendar({ calName, events }) {
  const header = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//DAGS Algorithm//Availability Debug//EN",
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${icsEscape(calName)}`,
  ].join("\r\n");

  const body = events.join("\r\n");
  const footer = "END:VCALENDAR";

  return [header, body, footer].join("\r\n") + "\r\n";
}

/** Convenience: create event interval in minutes from week start */
function ev(dayIndex, startHour, startMin, endHour, endMin, label) {
  // dayIndex: 0=Mon ... 6=Sun
  const startMs =
    WEEK_START + dayIndex * 24 * 60 * ONE_MIN + startHour * 60 * ONE_MIN + startMin * ONE_MIN;
  const endMs =
    WEEK_START + dayIndex * 24 * 60 * ONE_MIN + endHour * 60 * ONE_MIN + endMin * ONE_MIN;

  return { startMs, endMs, label };
}

// ================================================================
// Build 3 synthetic calendars with overlaps
// ================================================================

// Feel free to edit these to match your intuition.
// The goal is: multiple overlaps + some gaps.
const A_EVENTS = [
  // Mon
  ev(0, 9, 0, 10, 30, "A: Lecture"),
  ev(0, 13, 0, 14, 0, "A: Meeting"),
  ev(0, 15, 30, 17, 0, "A: Work block"),
  // Tue
  ev(1, 9, 30, 11, 0, "A: Office hours"),
  ev(1, 14, 0, 16, 0, "A: Project work"),
  // Wed
  ev(2, 10, 0, 12, 0, "A: Lab"),
  ev(2, 13, 30, 14, 30, "A: Check-in"),
  // Thu
  ev(3, 9, 0, 9, 45, "A: Quick call"),
  ev(3, 11, 0, 12, 30, "A: Study"),
  ev(3, 16, 0, 17, 30, "A: Work"),
  // Fri
  ev(4, 10, 0, 11, 0, "A: Review"),
  ev(4, 14, 0, 15, 30, "A: Deep work"),
];

const B_EVENTS = [
  // Mon
  ev(0, 9, 45, 11, 15, "B: Class"),         // overlaps A lecture
  ev(0, 12, 30, 13, 30, "B: Lunch"),         // overlaps A meeting partially? (A meeting starts 13:00)
  ev(0, 15, 0, 16, 0, "B: Meeting"),         // overlaps A work block
  // Tue
  ev(1, 8, 0, 9, 0, "B: Gym"),
  ev(1, 10, 30, 12, 0, "B: Standup"),        // overlaps A office hours
  ev(1, 15, 0, 17, 0, "B: Focus time"),      // overlaps A project work end
  // Wed
  ev(2, 9, 0, 10, 15, "B: Prep"),
  ev(2, 11, 30, 13, 0, "B: Meeting"),        // overlaps A lab end
  ev(2, 14, 0, 16, 0, "B: Block"),
  // Thu
  ev(3, 10, 30, 12, 0, "B: Class"),          // overlaps A study
  ev(3, 15, 30, 16, 30, "B: Sync"),          // overlaps A work
  // Fri
  ev(4, 9, 0, 10, 30, "B: Admin"),
  ev(4, 14, 30, 16, 0, "B: Work"),           // overlaps A deep work
];

const C_EVENTS = [
  // Mon
  ev(0, 8, 30, 9, 30, "C: Commute"),
  ev(0, 10, 0, 12, 0, "C: Workshop"),        // overlaps A lecture/B class
  ev(0, 13, 30, 15, 0, "C: Client call"),    // overlaps A meeting end
  // Tue
  ev(1, 9, 0, 10, 0, "C: Meeting"),
  ev(1, 14, 30, 15, 30, "C: Check-in"),      // overlaps A project work/B focus
  // Wed
  ev(2, 10, 30, 11, 30, "C: Task"),          // overlaps A lab
  ev(2, 13, 0, 14, 0, "C: Meeting"),         // overlaps A check-in partially
  ev(2, 15, 30, 17, 0, "C: Work"),
  // Thu
  ev(3, 9, 0, 10, 0, "C: Class"),            // overlaps A quick call boundary area
  ev(3, 12, 0, 13, 0, "C: Lunch"),
  ev(3, 16, 30, 18, 0, "C: Work"),           // overlaps A work end
  // Fri
  ev(4, 10, 30, 12, 0, "C: Meeting"),
  ev(4, 13, 30, 14, 30, "C: Task"),          // overlaps A deep work start
];

// ================================================================
// Convert to ParticipantSnapshot format
// ================================================================

function toParticipant(userId, evs) {
  return {
    userId,
    events: evs.map((e, idx) => ({
      eventRef: `${userId}-${idx}`,
      userId,
      startMs: e.startMs,
      endMs: e.endMs,
      source: "SYNTHETIC",
      blockingLevel: "B3", // MVP: everything B3
    })),
  };
}

const participants = [
  toParticipant("A", A_EVENTS),
  toParticipant("B", B_EVENTS),
  toParticipant("C", C_EVENTS),
];

// ================================================================
// Write participant calendars to ICS
// ================================================================

function participantToIcs(userId, evs) {
  const events = evs.map((e, idx) =>
    makeVevent({
      uid: `${userId}-${idx}@dags`,
      startMs: e.startMs,
      endMs: e.endMs,
      summary: e.label,
      description: `User=${userId}`,
      categories: "BUSY",
    })
  );
  return makeCalendar({ calName: `Synthetic Calendar ${userId}`, events });
}

fs.writeFileSync(OUT_A, participantToIcs("A", A_EVENTS), "utf8");
fs.writeFileSync(OUT_B, participantToIcs("B", B_EVENTS), "utf8");
fs.writeFileSync(OUT_C, participantToIcs("C", C_EVENTS), "utf8");

// ================================================================
// Compute availability blocks and write output ICS
// ================================================================

const blocks = computeAvailabilityBlocks({
  windowStartMs: WEEK_START,
  windowEndMs: WEEK_END,
  participants,
  granularityMinutes: G_MINUTES,
  priority: "B3", // accepted, ignored in MVP
});

function shouldEmitBlock(block) {
  if (OUTPUT_MODE === "ALL_BLOCKS") return true;
  if (OUTPUT_MODE === "ONLY_ALL_FREE") return block.availabilityFraction === 1;
  if (OUTPUT_MODE === "THRESHOLD") return block.availabilityFraction >= THRESHOLD_FRACTION;
  return true;
}

const availEvents = [];
for (let i = 0; i < blocks.length; i++) {
  const b = blocks[i];
  if (!shouldEmitBlock(b)) continue;

  const freeList = b.freeUserIds.join(",");
  const busyList = b.busyUserIds.join(",");

  const summary = `Avail ${Math.round(b.availabilityFraction * 100)}% (free:${b.availableCount}/${b.totalCount})`;
  const description = `freeUserIds=[${freeList}]\\nbusyUserIds=[${busyList}]`;

  let categories = "";
  if (ADD_CATEGORIES) {
    if (b.totalCount === 0) categories = "EMPTY";
    else if (b.availabilityFraction === 1) categories = "ALL_FREE";
    else if (b.availabilityFraction === 0) categories = "NONE_FREE";
    else categories = "PARTIAL";
  }

  availEvents.push(
    makeVevent({
      uid: `block-${i}@dags`,
      startMs: b.startMs,
      endMs: b.endMs,
      summary,
      description,
      categories,
    })
  );
}

fs.writeFileSync(
  OUT_AVAIL,
  makeCalendar({ calName: "Availability Blocks (Debug)", events: availEvents }),
  "utf8"
);

console.log("Wrote:");
console.log(" ", OUT_A);
console.log(" ", OUT_B);
console.log(" ", OUT_C);
console.log(" ", OUT_AVAIL);
console.log("");
console.log(`Blocks computed: ${blocks.length}`);
console.log(`Blocks emitted to ICS (${OUTPUT_MODE}): ${availEvents.length}`);