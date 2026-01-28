// availability.js
// ES module exports: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules :contentReference[oaicite:6]{index=6}

/** Global default block size (minutes). */
export const DEFAULT_G_MINUTES = 15;

/**
 * "Enum" pattern in JS.
 * (In TS this becomes: enum BlockingLevel { B1, B2, B3 })
 */
export const BlockingLevel = Object.freeze({
  B1: "B1",
  B2: "B2",
  B3: "B3", // MVP default: treat as highest
});

/**
 * @typedef {string} UserId
 */

/**
 * An interval on a timeline (half-open): [startMs, endMs)
 * Times are UTC epoch milliseconds.
 *
 * @typedef {Object} EventInterval
 * @property {string} eventRef - Identifier (Google event id, DB id, etc.)
 * @property {UserId} userId
 * @property {number} startMs
 * @property {number} endMs
 * @property {string} [source] - e.g. "GOOGLE" | "TIMEBLOCK" | "PETITION"
 * @property {string} [blockingLevel] - one of BlockingLevel (ignored in MVP)
 */

/**
 * One participant’s snapshot.
 * @typedef {Object} ParticipantSnapshot
 * @property {UserId} userId
 * @property {EventInterval[]} events
 */

/**
 * Output: availability for one fixed-size block [startMs, endMs)
 * @typedef {Object} AvailabilityBlock
 * @property {number} startMs
 * @property {number} endMs
 * @property {UserId[]} freeUserIds
 * @property {UserId[]} busyUserIds
 * @property {number} availableCount
 * @property {number} busyCount
 * @property {number} totalCount
 * @property {number} availabilityFraction
 */

/**
 * Merge overlapping/adjacent intervals for ONE user.
 * Assumes intervals are within the query window and valid (start < end).
 *
 * @param {{startMs:number,endMs:number}[]} intervals
 * @returns {{startMs:number,endMs:number}[]}
 */
function mergeIntervals(intervals) {
  if (intervals.length <= 1) return intervals.slice();

  // MDN sort: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort :contentReference[oaicite:7]{index=7}
  const sorted = intervals.slice().sort((a, b) => a.startMs - b.startMs);

  /** @type {{startMs:number,endMs:number}[]} */
  const merged = [];
  let cur = { startMs: sorted[0].startMs, endMs: sorted[0].endMs };

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];
    // "Adjacent counts as merged" is a design choice; good for block math.
    if (next.startMs <= cur.endMs) {
      cur.endMs = Math.max(cur.endMs, next.endMs);
    } else {
      merged.push(cur);
      cur = { startMs: next.startMs, endMs: next.endMs };
    }
  }
  merged.push(cur);
  return merged;
}

/**
 * True if [aStart, aEnd) overlaps [bStart, bEnd)
 * @param {number} aStart
 * @param {number} aEnd
 * @param {number} bStart
 * @param {number} bEnd
 */
function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Compute availability for each G-minute block within a window.
 *
 * This is deliberately "pure": no DB, no API calls, no queries.
 * The SDS describes availability as computed from fetched calendar events,
 * transiently sorted/merged in memory. :contentReference[oaicite:8]{index=8}
 *
 * @param {Object} args
 * @param {number} args.windowStartMs - inclusive
 * @param {number} args.windowEndMs - exclusive
 * @param {ParticipantSnapshot[]} args.participants
 * @param {number} [args.granularityMinutes=DEFAULT_G_MINUTES]
 * @param {string} [args.priority=BlockingLevel.B3] - accepted, ignored in MVP
 * @returns {AvailabilityBlock[]}
 */
export function computeAvailabilityBlocks({
  windowStartMs,
  windowEndMs,
  participants,
  granularityMinutes = DEFAULT_G_MINUTES,
  priority = BlockingLevel.B3, // accepted; unused in MVP
}) {
  if (!Number.isFinite(windowStartMs) || !Number.isFinite(windowEndMs)) {
    throw new Error("windowStartMs/windowEndMs must be numbers (epoch ms).");
  }
  if (windowEndMs <= windowStartMs) {
    throw new Error("windowEndMs must be > windowStartMs.");
  }
  if (!Array.isArray(participants)) {
    throw new Error("participants must be an array.");
  }

  const blockMs = granularityMinutes * 60 * 1000;
  if (!Number.isFinite(blockMs) || blockMs <= 0) {
    throw new Error("granularityMinutes must be a positive number.");
  }

  // Preprocess: for each user, clamp events to window and merge overlaps.
  /** @type {Map<UserId, {startMs:number,endMs:number}[]>} */
  const mergedBusyByUser = new Map();

  for (const p of participants) {
    const userId = p.userId;
    const rawEvents = Array.isArray(p.events) ? p.events : [];

    /** @type {{startMs:number,endMs:number}[]} */
    const clamped = [];

    for (const ev of rawEvents) {
      if (!ev) continue;
      const s = ev.startMs;
      const e = ev.endMs;
      if (!Number.isFinite(s) || !Number.isFinite(e)) continue;
      if (e <= s) continue;

      // clamp to the query window
      const startMs = Math.max(s, windowStartMs);
      const endMs = Math.min(e, windowEndMs);
      if (endMs <= startMs) continue;

      // MVP ignores ev.blockingLevel and ignores `priority`
      // Later: use priority to treat some events as "soft busy".
      clamped.push({ startMs, endMs });
    }

    mergedBusyByUser.set(userId, mergeIntervals(clamped));
  }

  // Block iteration with per-user pointers (fast enough for MVP).
  /** @type {Map<UserId, number>} */
  const idxByUser = new Map();
  for (const p of participants) idxByUser.set(p.userId, 0);

  /** @type {AvailabilityBlock[]} */
  const out = [];
  const totalCount = participants.length;

  // Align to block boundaries relative to windowStartMs.
  // (If you want “round to nearest quarter hour of day”, that’s a later enhancement.)
  for (let blockStart = windowStartMs; blockStart < windowEndMs; blockStart += blockMs) {
    const blockEnd = Math.min(blockStart + blockMs, windowEndMs);

    /** @type {UserId[]} */
    const freeUserIds = [];
    /** @type {UserId[]} */
    const busyUserIds = [];

    for (const p of participants) {
      const userId = p.userId;
      const merged = mergedBusyByUser.get(userId) || [];
      let idx = idxByUser.get(userId) || 0;

      // advance pointer while interval ends before this block starts
      while (idx < merged.length && merged[idx].endMs <= blockStart) idx++;

      idxByUser.set(userId, idx);

      let isBusy = false;
      if (idx < merged.length) {
        const interval = merged[idx];
        isBusy = overlaps(blockStart, blockEnd, interval.startMs, interval.endMs);
      }

      if (isBusy) busyUserIds.push(userId);
      else freeUserIds.push(userId);
    }

    const availableCount = freeUserIds.length;
    const busyCount = busyUserIds.length;

    out.push({
      startMs: blockStart,
      endMs: blockEnd,
      freeUserIds,
      busyUserIds,
      availableCount,
      busyCount,
      totalCount,
      availabilityFraction: totalCount === 0 ? 1 : availableCount / totalCount,
    });
  }

  return out;
}