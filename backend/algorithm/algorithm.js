/**
 * algorithm.js
 *
 * Goal:
 *   - Stay PURE (no DB, no API calls, no timezones, no “Google weirdness” here)
 *   - Take ParticipantSnapshot[] + a window => produce AvailabilityBlock[] (or the multi-view form)
 *
 * Design choices (MVP-friendly):
 *   1) Clamp events to the query window (ignore anything outside).
 *   2) Merge overlapping intervals per user (so we don't scan a million tiny overlaps).
 *   3) Iterate the window in fixed-size blocks (granularityMinutes).
 *   4) Use per-user pointers into merged intervals to keep block scan cheap.
 *
 * Priority / threshold semantics:
 *   - B3 view counts only B3 events
 *   - B2 view counts B2+B3
 *   - B1 view counts B1+B2+B3
 *
 * That lines up with “petition priority” pretty directly.
 */

// Trying to work with whatever module system backend is using (CommonJS or ESM). If this causes issues, we can adjust.
const { DEFAULT_G_MINUTES, BlockingLevel } = require('./algorithm_types.js');

/** @typedef {import("./algorithm_types.js").UserId} UserId */
/** @typedef {import("./algorithm_types.js").ParticipantSnapshot} ParticipantSnapshot */
/** @typedef {import("./algorithm_types.js").AvailabilityBlock} AvailabilityBlock */
/** @typedef {import("./algorithm_types.js").AvailabilityBlockMulti} AvailabilityBlockMulti */
/** @typedef {import("./algorithm_types.js").AvailabilityView} AvailabilityView */

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
 * @param {string} [args.priority=BlockingLevel.B3] - min blocking level; B1=lenient, B2=flexible, B3=strict
 * @returns {AvailabilityBlock[]}
 */
function computeAvailabilityBlocks({
  windowStartMs,
  windowEndMs,
  participants,
  granularityMinutes = DEFAULT_G_MINUTES,
  priority = BlockingLevel.B3,
}) {
  // Define the missing threshold value based on the chosen priority
  const minPriorityValue = blockingOrder[priority] || blockingOrder[BlockingLevel.B3];

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

/**
 * computeAvailabilityBlocksAllViews (multi view, computed in one pass)
 *
 * Same window/participant input contract as computeAvailabilityBlocks,
 * except we always compute the three threshold views at once.
 *
 * Why do this?
 *   - The UI wants to flip between heatmaps instantly (no recompute).
 *   - Running the single-view function 3 times is easy but wasteful.
 *   - This version keeps the block scan as “one loop, 3 quick checks”.
 *
 * Output:
 *   - AvailabilityBlockMulti[] where each block has .views.B1/.views.B2/.views.B3
 *
 * @param {Object} args
 * @param {number} args.windowStartMs
 * @param {number} args.windowEndMs
 * @param {ParticipantSnapshot[]} args.participants
 * @param {number} [args.granularityMinutes=DEFAULT_G_MINUTES]
 * @returns {AvailabilityBlockMulti[]}
 */
function computeAvailabilityBlocksAllViews({
  windowStartMs,
  windowEndMs,
  participants,
  granularityMinutes = DEFAULT_G_MINUTES,
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

  /**
   * Preprocess per user into 3 merged interval lists.
   *
   * Key detail: we build lists via ROUTING rules, not by rerunning filters.
   * That way each event is clamped once and pushed to the views it affects.
   *
   * Routing: StrictView ALL events considered busy
   *          FlexibleView ALL B2, B3 events considered busy
   *          LenientView ALL B1, B2, B3 events considered busy
   *
   * @type {Map<UserId, {B1:{startMs:number,endMs:number}[],B2:{startMs:number,endMs:number}[],B3:{startMs:number,endMs:number}[]}>}
   */
  const busyByUser = new Map();

  for (const p of participants) {
    const userId = p.userId;
    const rawEvents = Array.isArray(p.events) ? p.events : [];

    const lists = { StrictView: [], FlexibleView: [], LenientView: [] }; // Fixing Priority. Naming conventions for clarity. 02-22 1.1

    for (const ev of rawEvents) {
      if (!ev) continue;

      const s = ev.startMs;
      const e = ev.endMs;
      if (!Number.isFinite(s) || !Number.isFinite(e)) continue;
      if (e <= s) continue;

      const startMs = Math.max(s, windowStartMs);
      const endMs = Math.min(e, windowEndMs);
      if (endMs <= startMs) continue;

      const level = normalizeBlockingLevel(ev.blockingLevel);

      if (level === BlockingLevel.B3) {
        // A B3 event is always busy for all views.
        lists.StrictView.push({ startMs, endMs });
        lists.FlexibleView.push({ startMs, endMs });
        lists.LenientView.push({ startMs, endMs });
      }
      else if (level === BlockingLevel.B2) {
        // (Mediium Priority / Flexible) A B2 event counts as busy for StrictView and FlexibleView.
        lists.StrictView.push({ startMs, endMs });
        lists.FlexibleView.push({ startMs, endMs });
      }
      else {
        // Only B1 events effect all views, so push to StrictView only
        lists.StrictView.push({ startMs, endMs });
      }
      // Fixing Routing For Priority Level clarity. 02-22. 1.1
    }
    const merged = {
      StrictView: mergeIntervals(lists.StrictView),
      FlexibleView: mergeIntervals(lists.FlexibleView),
      LenientView: mergeIntervals(lists.LenientView),
    };

    if (merged.StrictView.length || merged.FlexibleView.length || merged.LenientView.length) {
      busyByUser.set(userId, merged);
    }
  }

  /**
   * One pointer per user per view.
   * Same idea as the single-view function, just x3.
   */
  const idxByUser = new Map();
  for (const p of participants) idxByUser.set(p.userId, { StrictView: 0, FlexibleView: 0, LenientView: 0 });

  /** @type {AvailabilityBlockMulti[]} */
  const out = [];
  const totalCount = participants.length;

  for (let blockStart = windowStartMs; blockStart < windowEndMs; blockStart += blockMs) {
    const blockEnd = Math.min(blockStart + blockMs, windowEndMs);

    const acc = {
      StrictView: { freeUserIds: [], busyUserIds: [] },
      FlexibleView: { freeUserIds: [], busyUserIds: [] },
      LenientView: { freeUserIds: [], busyUserIds: [] },
    };

    for (const p of participants) {
      const userId = p.userId;
      const merged = busyByUser.get(userId) || { StrictView: [], FlexibleView: [], LenientView: [] };
      const idxs = idxByUser.get(userId) || { StrictView: 0, FlexibleView: 0, LenientView: 0 };

      const isBusyInView = (viewKey) => {
        const arr = merged[viewKey];
        let idx = idxs[viewKey];

        while (idx < arr.length && arr[idx].endMs <= blockStart) idx++;
        idxs[viewKey] = idx;

        if (idx >= arr.length) return false;
        const it = arr[idx];
        return overlaps(blockStart, blockEnd, it.startMs, it.endMs);
      };

      const busyStrict = isBusyInView("StrictView");
      const busyFlexible = isBusyInView("FlexibleView");
      const busyLenient = isBusyInView("LenientView");

      if (busyStrict) acc.StrictView.busyUserIds.push(userId);
      else acc.StrictView.freeUserIds.push(userId);

      if (busyFlexible) acc.FlexibleView.busyUserIds.push(userId);
      else acc.FlexibleView.freeUserIds.push(userId);

      if (busyLenient) acc.LenientView.busyUserIds.push(userId);
      else acc.LenientView.freeUserIds.push(userId);

      idxByUser.set(userId, idxs);
    }

    const finalize = (viewKey) => {
      const freeUserIds = acc[viewKey].freeUserIds;
      const busyUserIds = acc[viewKey].busyUserIds;
      const availableCount = freeUserIds.length;
      const busyCount = busyUserIds.length;
      return {
        freeUserIds,
        busyUserIds,
        availableCount,
        busyCount,
        totalCount,
        availabilityFraction: totalCount === 0 ? 1 : availableCount / totalCount,
      };
    };

    out.push({
      startMs: blockStart,
      endMs: blockEnd,
      views: {
        StrictView: finalize("StrictView"),
        FlexibleView: finalize("FlexibleView"),
        LenientView: finalize("LenientView"),
      },
    });
  }

  return out;
}

/**
 * toSingleViewBlocks (UI helper)
 *
 * This is the “keep UI consuming AvailabilityBlock[]” bridge:
 *   1) computeAvailabilityBlocksAllViews(...) once
 *   2) project it down to a single view whenever the user toggles
 *
 * Complexity:
 *   - projection is O(#blocks)
 *   - no extra event merging, no extra interval scans
 *
 * Input:
 *   - blocksMulti: AvailabilityBlockMulti[]
 *   - chosen: "StrictView" | "FlexibleView" | "LenientView" (defaults to StrictView if invalid)
 *
 * Output:
 *   - AvailabilityBlock[] (exact same shape as computeAvailabilityBlocks)
 *
 * @param {AvailabilityBlockMulti[]} blocksMulti
 * @param {"StrictView"|"FlexibleView"|"LenientView"} chosen
 * @returns {AvailabilityBlock[]}
 */
function toSingleViewBlocks(blocksMulti, chosen) {
  if (!Array.isArray(blocksMulti)) {
    throw new Error("blocksMulti must be an array.");
  }

  // Defensive default: if chosen is wrong, go restrictive.
  const key = blockingOrder[chosen] ? chosen : BlockingLevel.StrictView;

  return blocksMulti.map((b) => ({
    startMs: b.startMs,
    endMs: b.endMs,
    ...b.views[key],
  }));
}

// Trying to comply with whatever module system the backend is using (CommonJS or ESM).
module.exports = {
  computeAvailabilityBlocks,
  computeAvailabilityBlocksAllViews,
  toSingleViewBlocks
};