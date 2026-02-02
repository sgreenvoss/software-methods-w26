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
 * @typedef {Object} EventInterval
 * @property {string} eventRef
 * @property {UserId} userId
 * @property {number} startMs
 * @property {number} endMs
 * @property {string} [source]
 * @property {string} [blockingLevel]
 */

/**
 * @typedef {Object} ParticipantSnapshot
 * @property {UserId} userId
 * @property {EventInterval[]} events
 */

/**
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
