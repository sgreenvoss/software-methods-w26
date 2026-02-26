const { BlockingLevel } = require("../algorithm/algorithm_types.js");

const VALID_BLOCKING_LEVELS = new Set(Object.values(BlockingLevel));
const SOURCE_MANUAL = "manual";
const SOURCE_GOOGLE = "google";

class EventStoreError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {object} [details]
   */
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "EventStoreError";
    this.code = code;
    this.details = details;
  }
}

function assertNonEmptyString(value, label) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new EventStoreError("VALIDATION_ERROR", `${label} must be a non-empty string.`, {
      label,
      value,
    });
  }
}

function assertFiniteNumber(value, label) {
  if (!Number.isFinite(value)) {
    throw new EventStoreError("VALIDATION_ERROR", `${label} must be a finite number.`, {
      label,
      value,
    });
  }
}

function normalizeBlockingLevel(level) {
  const normalized = level ?? BlockingLevel.B3;
  if (!VALID_BLOCKING_LEVELS.has(normalized)) {
    throw new EventStoreError("VALIDATION_ERROR", `blockingLevel must be one of ${[...VALID_BLOCKING_LEVELS].join(", ")}.`, {
      blockingLevel: level,
    });
  }
  return normalized;
}

function validateInterval({ userId, startMs, endMs }) {
  assertNonEmptyString(userId, "userId");
  assertFiniteNumber(startMs, "startMs");
  assertFiniteNumber(endMs, "endMs");
  if (endMs <= startMs) {
    throw new EventStoreError("VALIDATION_ERROR", "endMs must be greater than startMs.", {
      startMs,
      endMs,
    });
  }
}

function cloneEvent(event) {
  return { ...event };
}

function makeEventRef(prefix, nowMs, seq) {
  return `${prefix}-${nowMs}-${seq}`;
}

/**
 * In-memory event store for UC-05 (Add Event Block) and priority edits.
 * This is intentionally transient (no DB, no UI).
 */
class EventStore {
  constructor({ nowFn = () => Date.now(), manualEventPrefix = "manual" } = {}) {
    this._manualEventsByUser = new Map();
    this._googleEventsByUser = new Map();
    this._googlePriorityOverrides = new Map();
    this._nowFn = nowFn;
    this._manualEventPrefix = manualEventPrefix;
    this._seq = 0;
  }

  /**
   * Add a user-defined time block (UC-05).
   * @param {object} args
   * @param {string} args.userId
   * @param {number} args.startMs
   * @param {number} args.endMs
   * @param {string} [args.blockingLevel] - defaults to B3 for MVP
   * @param {string} [args.title]
   * @param {string} [args.eventRef]
   * @returns {import("../algorithm/algorithm_types.js").EventInterval}
   */
  addManualEvent({ userId, startMs, endMs, blockingLevel, title, eventRef } = {}) {
    validateInterval({ userId, startMs, endMs });
    const normalizedLevel = normalizeBlockingLevel(blockingLevel);

    const manualMap = this._manualEventsByUser.get(userId) ?? new Map();
    const finalEventRef = eventRef ?? makeEventRef(this._manualEventPrefix, this._nowFn(), ++this._seq);

    if (manualMap.has(finalEventRef)) {
      throw new EventStoreError("CONFLICT", "eventRef already exists for user.", {
        userId,
        eventRef: finalEventRef,
      });
    }

    const event = {
      eventRef: finalEventRef,
      userId,
      startMs,
      endMs,
      source: SOURCE_MANUAL,
      blockingLevel: normalizedLevel,
    };

    if (typeof title === "string" && title.trim().length > 0) {
      event.title = title.trim();
    }

    manualMap.set(finalEventRef, event);
    this._manualEventsByUser.set(userId, manualMap);

    return cloneEvent(event);
  }

  /**
   * Replace the current Google event snapshot for a user.
   * Priority overrides (if any) are applied on load.
   * @param {object} args
   * @param {string} args.userId
   * @param {Array<{eventRef:string,startMs:number,endMs:number,blockingLevel?:string,title?:string}>} args.events
   * @returns {number} count of loaded events
   */
  setGoogleEvents({ userId, events } = {}) {
    assertNonEmptyString(userId, "userId");
    if (!Array.isArray(events)) {
      throw new EventStoreError("VALIDATION_ERROR", "events must be an array.", { events });
    }

    const overrides = this._googlePriorityOverrides.get(userId) ?? new Map();
    const googleMap = new Map();

    for (const ev of events) {
      if (!ev) continue;
      assertNonEmptyString(ev.eventRef, "eventRef");
      const startMs = ev.startMs;
      const endMs = ev.endMs;
      validateInterval({ userId, startMs, endMs });

      if (googleMap.has(ev.eventRef)) {
        throw new EventStoreError("CONFLICT", "Duplicate eventRef in Google events payload.", {
          userId,
          eventRef: ev.eventRef,
        });
      }

      const normalizedLevel = normalizeBlockingLevel(
        overrides.get(ev.eventRef) ?? ev.blockingLevel ?? BlockingLevel.B3
      );

      const event = {
        eventRef: ev.eventRef,
        userId,
        startMs,
        endMs,
        source: SOURCE_GOOGLE,
        blockingLevel: normalizedLevel,
      };

      if (typeof ev.title === "string" && ev.title.trim().length > 0) {
        event.title = ev.title.trim();
      }

      googleMap.set(ev.eventRef, event);
    }

    this._googleEventsByUser.set(userId, googleMap);
    return googleMap.size;
  }

  /**
   * Update priority for a Google event (edit action from UI).
   * @param {object} args
   * @param {string} args.userId
   * @param {string} args.eventRef
   * @param {string} args.blockingLevel
   * @returns {{applied:boolean,event:import("../algorithm/algorithm_types.js").EventInterval}}
   */
  setGoogleEventPriority({ userId, eventRef, blockingLevel } = {}) {
    assertNonEmptyString(userId, "userId");
    assertNonEmptyString(eventRef, "eventRef");

    const normalizedLevel = normalizeBlockingLevel(blockingLevel);

    let overrides = this._googlePriorityOverrides.get(userId);
    if (!overrides) {
      overrides = new Map();
      this._googlePriorityOverrides.set(userId, overrides);
    }
    overrides.set(eventRef, normalizedLevel);

    const googleMap = this._googleEventsByUser.get(userId);
    const existing = googleMap?.get(eventRef);

    if (existing) {
      existing.blockingLevel = normalizedLevel;
      return { applied: true, event: cloneEvent(existing) };
    }

    return {
      applied: false,
      event: {
        eventRef,
        userId,
        source: SOURCE_GOOGLE,
        blockingLevel: normalizedLevel,
      },
    };
  }

  /**
   * Fetch a user's events (manual + google) for availability computation.
   * @param {object} args
   * @param {string} args.userId
   * @param {boolean} [args.includeManual=true]
   * @param {boolean} [args.includeGoogle=true]
   * @returns {import("../algorithm/algorithm_types.js").EventInterval[]}
   */
  getUserEvents({ userId, includeManual = true, includeGoogle = true } = {}) {
    assertNonEmptyString(userId, "userId");

    const events = [];
    if (includeManual) {
      const manualMap = this._manualEventsByUser.get(userId);
      if (manualMap) {
        for (const event of manualMap.values()) events.push(cloneEvent(event));
      }
    }

    if (includeGoogle) {
      const googleMap = this._googleEventsByUser.get(userId);
      if (googleMap) {
        for (const event of googleMap.values()) events.push(cloneEvent(event));
      }
    }

    return events;
  }

  /**
   * Build a ParticipantSnapshot for the scheduling algorithm.
   * @param {object} args
   * @param {string} args.userId
   * @param {boolean} [args.includeManual=true]
   * @param {boolean} [args.includeGoogle=true]
   * @returns {import("../algorithm/algorithm_types.js").ParticipantSnapshot}
   */
  getParticipantSnapshot({ userId, includeManual = true, includeGoogle = true } = {}) {
    const events = this.getUserEvents({ userId, includeManual, includeGoogle });
    return { userId, events };
  }

  /**
   * Build ParticipantSnapshots for all known users in the store.
   * @param {object} args
   * @param {boolean} [args.includeManual=true]
   * @param {boolean} [args.includeGoogle=true]
   * @returns {import("../algorithm/algorithm_types.js").ParticipantSnapshot[]}
   */
  getAllParticipantSnapshots({ includeManual = true, includeGoogle = true } = {}) {
    const userIds = new Set([
      ...this._manualEventsByUser.keys(),
      ...this._googleEventsByUser.keys(),
    ]);

    const snapshots = [];
    for (const userId of userIds) {
      snapshots.push(this.getParticipantSnapshot({ userId, includeManual, includeGoogle }));
    }
    return snapshots;
  }
}

const EventSources = Object.freeze({
  manual: SOURCE_MANUAL,
  google: SOURCE_GOOGLE,
});

module.exports = {
  EventStore,
  EventStoreError,
  EventSources,
};
