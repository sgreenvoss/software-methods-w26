/**
 * types/algorithm_types.js
 *
 * This file is intentionally boring: it's the shared contract between:
 *   - whatever builds ParticipantSnapshot[] (Google fetch, DB snapshot, etc.)
 *   - the algorithm module (pure compute)
 *   - the UI (renders blocks / heatmaps)
 *
 * Keeping the contract stable is the whole point.
 */

/** Default block size (minutes) for "heatmap" blocks. */
export const DEFAULT_G_MINUTES = 15;

/**
 * BlockingLevel is a PRIORITY / STRICTNESS label attached to each busy interval.
 *
 * IMPORTANT: the algorithm uses threshold views:
 *   - View B3 => only treat B3 events as busy (most lenient)
 *   - View B2 => treat B2 + B3 events as busy
 *   - View B1 => treat B1 + B2 + B3 events as busy (most restrictive)
 *
 * That matches the petition idea:
 *   - A B3 petition only cares about B3 conflicts
 *   - A B2 petition cares about B2/B3 conflicts
 *   - A B1 petition cares about everything
 */
export const BlockingLevel = Object.freeze({
  B1: "B1",
  B2: "B2",
  B3: "B3",
});

/** @typedef {string} UserId */

/**
 * INPUT CONTRACT: event intervals
 *
 * The algorithm only cares about: startMs/endMs and blockingLevel.
 * Everything else is optional metadata that other layers can use.
 *
 * Rules (enforced by algorithm):
 *   - startMs/endMs must be finite numbers (epoch ms)
 *   - endMs must be > startMs (otherwise ignored)
 *   - blockingLevel missing/invalid => treated as B3 (conservative)
 *
 * @typedef {Object} EventInterval
 * @property {number} startMs
 * @property {number} endMs
 * @property {string} [blockingLevel]   - BlockingLevel (B1/B2/B3)
 * @property {string} [eventRef]        - stable id (google event id, db id, etc.)
 * @property {string} [source]          - "google" | "manual" | etc.
 */

/**
 * INPUT CONTRACT: participant snapshot
 *
 * participants[] is "the group" for this computation.
 * Each participant owns an independent event list.
 *
 * @typedef {Object} ParticipantSnapshot
 * @property {UserId} userId
 * @property {EventInterval[]} events
 */

/**
 * OUTPUT CONTRACT (single view):
 *
 * AvailabilityBlock is what the UI wants to render quickly:
 *   - stable block boundaries [startMs, endMs)
 *   - per-block lists of who is busy vs free
 *   - counts + availabilityFraction for heatmap shading
 *
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
 * OUTPUT CONTRACT (multi view):
 *
 * Same blocks, but each block carries 3 "views" (B1/B2/B3).
 * This is the efficient path: compute once, toggle in UI with a cheap projection.
 *
 * @typedef {Object} AvailabilityView
 * @property {UserId[]} freeUserIds
 * @property {UserId[]} busyUserIds
 * @property {number} availableCount
 * @property {number} busyCount
 * @property {number} totalCount
 * @property {number} availabilityFraction
 *
 * @typedef {Object} AvailabilityBlockMulti
 * @property {number} startMs
 * @property {number} endMs
 * @property {{B1: AvailabilityView, B2: AvailabilityView, B3: AvailabilityView}} views
 */
