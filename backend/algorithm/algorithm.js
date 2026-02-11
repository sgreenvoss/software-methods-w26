// availability.js
// ES module exports: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules :contentReference[oaicite:6]{index=6}

import { DEFAULT_G_MINUTES, BlockingLevel } from "./types/algorithm_types.js";

/** @typedef {import("./types/algorithm_types.js").UserId} UserId */
/** @typedef {import("./types/algorithm_types.js").ParticipantSnapshot} ParticipantSnapshot */
/** @typedef {import("./types/algorithm_types.js").AvailabilityBlock} AvailabilityBlock */
/** @typedef {import("./types/algorithm_types.js").AvailabilityBlockMulti} AvailabilityBlockMulti */
/** @typedef {import("./types/algorithm_types.js").AvailabilityView} AvailabilityView */

// Internal ordering so we can do threshold comparisons.
// Lower number = "counts earlier" when we go more restrictive.
const blockingOrder = Object.freeze({
  [BlockingLevel.B1]: 1,
  [BlockingLevel.B2]: 2,
  [BlockingLevel.B3]: 3,
});

/**
 * Missing/invalid blockingLevel is treated as B3.
 * Why? If we don't know the level, I'd rather be conservative than accidentally
 * label someone as free when they shouldn't be.
 *
 * @param {any} level
 * @returns {"B1"|"B2"|"B3"}
 */
function normalizeBlockingLevel(level) {
  return blockingOrder[level] ? level : BlockingLevel.B3;
}

/**
 * Merge overlapping busy intervals for ONE user.
 *
 * NOTE: We intentionally do NOT merge "touching" intervals (adjacent).
 * So [0,15) and [15,30) stays two intervals.
 * That keeps block boundaries precise (especially in 15-minute grids).
 *
 * @param {{startMs:number,endMs:number}[]} intervals
 * @returns {{startMs:number,endMs:number}[]}
 */
function mergeIntervals(intervals) {
  if (intervals.length <= 1) return intervals.slice();

  const sorted = intervals.slice().sort((a, b) => a.startMs - b.startMs);

  /** @type {{startMs:number,endMs:number}[]} */
  const merged = [];
  let cur = { startMs: sorted[0].startMs, endMs: sorted[0].endMs };

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];
    if (next.startMs < cur.endMs) {
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
 * Half-open overlap check: [aStart, aEnd) overlaps [bStart, bEnd)
 * @param {number} aStart
 * @param {number} aEnd
 * @param {number} bStart
 * @param {number} bEnd
 */
function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * computeAvailabilityBlocks (single view)
 *
 * INPUT CONTRACT:
 *   - windowStartMs / windowEndMs are epoch ms
 *   - windowStartMs is inclusive, windowEndMs is exclusive
 *   - participants is an array of {userId, events[]}
 *   - events contain {startMs,endMs,blockingLevel?}
 *
 * OUTPUT CONTRACT:
 *   - returns AvailabilityBlock[] where each block is [startMs,endMs)
 *   - block boundaries are aligned to windowStartMs + k*blockMs
 *   - freeUserIds/busyUserIds list participant userIds only
 *   - availabilityFraction = availableCount / totalCount (1 if totalCount=0)
 *
 * Priority behavior:
 *   - priority=B3 => only count B3 conflicts
 *   - priority=B2 => count B2+B3 conflicts
 *   - priority=B1 => count everything (most restrictive)
 *
 * @param {Object} args
 * @param {number} args.windowStartMs
 * @param {number} args.windowEndMs
 * @param {ParticipantSnapshot[]} args.participants
 * @param {number} [args.granularityMinutes=DEFAULT_G_MINUTES]
 * @param {string} [args.priority=BlockingLevel.B1]
 * @returns {AvailabilityBlock[]}
 */
function computeAvailabilityBlocks({
  windowStartMs,
  windowEndMs,
  participants,
  granularityMinutes = DEFAULT_G_MINUTES,
  priority = BlockingLevel.B1,
}) {
  // Basic validation: fail loud so bugs don't silently ship.
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
  const minPriorityValue = blockingOrder[normalizeBlockingLevel(priority)];

  // If caller passes garbage, default to most restrictive (B1).
  const priorityKey = blockingOrder[priority] ? priority : BlockingLevel.B1;
  const minPriorityValue = blockingOrder[priorityKey];

  /**
   * Preprocessing step:
   *   For each user:
   *     - clamp events to window
   *     - filter by threshold
   *     - merge overlaps
   *
   * That reduces per-block work.
   *
   * @type {Map<UserId, {startMs:number,endMs:number}[]>}
   */
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

      // threshold logic
      const levelKey = normalizeBlockingLevel(ev.blockingLevel);
      const levelValue = blockingOrder[levelKey];
      if (levelValue < minPriorityValue) continue;

      clamped.push({ startMs, endMs });
    }

    const merged = mergeIntervals(clamped);
    if (merged.length > 0) mergedBusyByUser.set(userId, merged);
  }

  /**
   * Pointer trick:
   *   Each user gets an index into their merged interval list.
   *   As blockStart increases, we only move forward (no rescanning).
   *
   * @type {Map<UserId, number>}
   */
  const idxByUser = new Map();
  for (const p of participants) idxByUser.set(p.userId, 0);

  /** @type {AvailabilityBlock[]} */
  const out = [];
  const totalCount = participants.length;

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

      // advance pointer while the interval ends before this block starts
      while (idx < merged.length && merged[idx].endMs <= blockStart) idx++;
      idxByUser.set(userId, idx);

      let isBusy = false;
      if (idx < merged.length) {
        const it = merged[idx];
        isBusy = overlaps(blockStart, blockEnd, it.startMs, it.endMs);
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