// availability.test.js
import { computeAvailabilityBlocks, DEFAULT_G_MINUTES } from './algorithm';
import { BlockingLevel } from './types/algorithm_types';
/** @typedef {import("./types/algorithm_types.js").UserId} UserId */
/** @typedef {import("./types/algorithm_types.js").ParticipantSnapshot} ParticipantSnapshot */
/** @typedef {import("./types/algorithm_types.js").AvailabilityBlock} AvailabilityBlock */

// --- Test Data Helpers ---
// A fixed base time to make math easy (e.g., 10:00 AM UTC)
const BASE_TIME = Date.UTC(2026, 0, 1, 10, 0, 0, 0);
const ONE_MIN = 60 * 1000;
const ONE_BLOCK = DEFAULT_G_MINUTES * ONE_MIN; // 15 minutes
const ONE_HOUR = 60 * ONE_MIN;

// Helper to create timestamp relative to BASE_TIME
const t = (minutes) => BASE_TIME + minutes * ONE_MIN;

describe('Algorithm Module: Simple Availability (MVP)', () => {

  // =================================================================
  // USE CASE 1: System Stability & Input Validation
  // Requirement: System must handle invalid inputs gracefully without crashing.
  // =================================================================
  describe('Input Validation', () => {
    test('should throw error if windowStart/End are not numbers', () => {
      expect(() => {
        computeAvailabilityBlocks({
          windowStartMs: "invalid",
          windowEndMs: t(60),
          participants: []
        });
      }).toThrow(/windowStartMs\/windowEndMs must be numbers/);
    });

    // NEW: cover the "windowEndMs is invalid" side of the OR branch
    test('should throw error if windowEndMs is not a finite number', () => {
      expect(() => {
        computeAvailabilityBlocks({
          windowStartMs: t(0),
          windowEndMs: NaN,
          participants: []
        });
      }).toThrow(/windowStartMs\/windowEndMs must be numbers/);
    });

    test('should throw error if windowEnd <= windowStart', () => {
      expect(() => {
        computeAvailabilityBlocks({
          windowStartMs: t(60),
          windowEndMs: t(0),
          participants: []
        });
      }).toThrow(/windowEndMs must be > windowStartMs/);
    });

    test('should throw error if participants is not an array', () => {
      expect(() => {
        computeAvailabilityBlocks({
          windowStartMs: t(0),
          windowEndMs: t(60),
          participants: null
        });
      }).toThrow(/participants must be an array/);
    });
  });

  // =================================================================
  // USE CASE 2: Basic Availability Reporting
  // Requirement: Users with no events should be reported as free.
  // =================================================================
  describe('Basic Availability', () => {
    test('should return 100% availability for a single user with no events', () => {
      const result = computeAvailabilityBlocks({
        windowStartMs: t(0),
        windowEndMs: t(60), // 1 hour window
        participants: [{ userId: 'user1', events: [] }],
        granularityMinutes: 15
      });

      // Should have 4 blocks (0-15, 15-30, 30-45, 45-60)
      expect(result).toHaveLength(4);
      result.forEach(block => {
        expect(block.availableCount).toBe(1);
        expect(block.availabilityFraction).toBe(1);
        expect(block.freeUserIds).toContain('user1');
      });
    });

    test('should correctly divide window into blocks based on granularity', () => {
      const result = computeAvailabilityBlocks({
        windowStartMs: t(0),
        windowEndMs: t(30), // 30 min window
        participants: [],
        granularityMinutes: 10 // 3 blocks expected
      });

      expect(result).toHaveLength(3);
      expect(result[0].startMs).toBe(t(0));
      expect(result[0].endMs).toBe(t(10));
      expect(result[2].endMs).toBe(t(30));
    });

    // NEW: cover partial final block behavior (window not multiple of granularity)
    test('should create a final partial block when windowEnd is not aligned to block size', () => {
      const result = computeAvailabilityBlocks({
        windowStartMs: t(0),
        windowEndMs: t(16), // 16 minutes, with 15-minute blocks
        participants: [{ userId: 'user1', events: [] }],
        granularityMinutes: 15
      });

      expect(result).toHaveLength(2);
      expect(result[0].startMs).toBe(t(0));
      expect(result[0].endMs).toBe(t(15));
      expect(result[1].startMs).toBe(t(15));
      expect(result[1].endMs).toBe(t(16)); // partial block
    });
  });

  // =================================================================
  // USE CASE 3: Event Overlap Logic
  // Requirement: Events overlapping a block mark the user as busy for that block.
  // =================================================================
  describe('Event Overlap Logic', () => {
    let user;

    // NEW: avoid shared mutable state across tests
    beforeEach(() => {
      user = { userId: 'u1', events: [] };
    });

    test('should mark user as busy if event completely covers a block', () => {
      // Event: 0 to 30 mins
      user.events = [{ startMs: t(0), endMs: t(30) }];

      const result = computeAvailabilityBlocks({
        windowStartMs: t(15), // Window starts at 15
        windowEndMs: t(30),   // Window ends at 30
        participants: [user],
        granularityMinutes: 15
      });

      // The event (0-30) fully covers the window (15-30)
      expect(result[0].busyUserIds).toContain('u1');
      expect(result[0].availabilityFraction).toBe(0);
    });

    test('should mark user as busy if event partially overlaps start of block', () => {
      // Event: 0 to 5 mins. Block: 0 to 15 mins.
      user.events = [{ startMs: t(0), endMs: t(5) }];

      const result = computeAvailabilityBlocks({
        windowStartMs: t(0),
        windowEndMs: t(15),
        participants: [user],
        granularityMinutes: 15
      });

      expect(result[0].busyUserIds).toContain('u1');
    });

    test('should mark user as busy if event partially overlaps end of block', () => {
      // Event: 10 to 20 mins. Block: 0 to 15 mins.
      user.events = [{ startMs: t(10), endMs: t(20) }];

      const result = computeAvailabilityBlocks({
        windowStartMs: t(0),
        windowEndMs: t(15),
        participants: [user],
        granularityMinutes: 15
      });

      expect(result[0].busyUserIds).toContain('u1');
    });

    test('should NOT mark user as busy if event is strictly before or after block', () => {
      // Event 1: 0-14 (Busy in block 1)
      // Event 2: 31-40 (Busy in block 3)
      user.events = [
        { startMs: t(0), endMs: t(14) },
        { startMs: t(31), endMs: t(40) }
      ];

      const result = computeAvailabilityBlocks({
        windowStartMs: t(0),
        windowEndMs: t(45),
        participants: [user],
        granularityMinutes: 15
      });

      // Block 1 (0-15): Busy (overlap 0-14)
      expect(result[0].busyUserIds).toContain('u1');

      // Block 2 (15-30): FREE (Gap between 14 and 31)
      expect(result[1].freeUserIds).toContain('u1');
      expect(result[1].availabilityFraction).toBe(1);

      // Block 3 (30-45): Busy (overlap 31-40)
      expect(result[2].busyUserIds).toContain('u1');
    });

    // NEW: cover clamping eliminating an event entirely (no overlap after clamp)
    test('should treat user as free if an event is entirely outside the window (clamped away)', () => {
      user.events = [
        { startMs: t(-60), endMs: t(-30) }, // fully before window
        { startMs: t(90), endMs: t(120) }   // fully after window
      ];

      const result = computeAvailabilityBlocks({
        windowStartMs: t(0),
        windowEndMs: t(30),
        participants: [user],
        granularityMinutes: 15
      });

      expect(result).toHaveLength(2);
      expect(result[0].freeUserIds).toContain('u1');
      expect(result[1].freeUserIds).toContain('u1');
    });
  });

  // =================================================================
  // USE CASE 4: Complex Calendar Data Handling
  // Requirement: Handle messy data (unsorted, overlapping events) cleanly.
  // =================================================================
  describe('Data Normalization (Sorting & Merging)', () => {
    test('should treat overlapping events as a single busy interval', () => {
      // Events: [10-20] and [15-25]. Merged logic should see [10-25].
      const user = {
        userId: 'u1',
        events: [
          { startMs: t(10), endMs: t(20) },
          { startMs: t(15), endMs: t(25) }
        ]
      };

      const result = computeAvailabilityBlocks({
        windowStartMs: t(0),
        windowEndMs: t(45), // Blocks: 0-15, 15-30, 30-45
        participants: [user],
        granularityMinutes: 15
      });

      // Block 1 (0-15): Busy (overlap 10-15)
      expect(result[0].busyUserIds).toContain('u1');
      // Block 2 (15-30): Busy (overlap 15-25)
      expect(result[1].busyUserIds).toContain('u1');
      // Block 3 (30-45): Free
      expect(result[2].freeUserIds).toContain('u1');
    });

    test('should handle unsorted events correctly', () => {
      const user = {
        userId: 'u1',
        events: [
          { startMs: t(30), endMs: t(45) }, // Later event first
          { startMs: t(0), endMs: t(15) }   // Earlier event second
        ]
      };

      const result = computeAvailabilityBlocks({
        windowStartMs: t(0),
        windowEndMs: t(60),
        participants: [user],
        granularityMinutes: 15
      });

      expect(result[0].busyUserIds).toContain('u1'); // 0-15
      expect(result[1].freeUserIds).toContain('u1'); // 15-30 (Gap)
      expect(result[2].busyUserIds).toContain('u1'); // 30-45
    });

    test('should ignore invalid events (start >= end)', () => {
      const user = {
        userId: 'u1',
        events: [{ startMs: t(10), endMs: t(10) }] // Zero duration
      };

      const result = computeAvailabilityBlocks({
        windowStartMs: t(0),
        windowEndMs: t(15),
        participants: [user],
        granularityMinutes: 15
      });

      // Should be free because the event is invalid/zero-length
      expect(result[0].freeUserIds).toContain('u1');
    });

    // NEW: cover missing startMs/endMs fields being ignored
    test('should ignore events missing startMs or endMs', () => {
      const user = {
        userId: 'u1',
        events: [
          { startMs: t(0) },           // missing endMs
          { endMs: t(15) },            // missing startMs
          { startMs: t(0), endMs: t(15) } // valid
        ]
      };

      const result = computeAvailabilityBlocks({
        windowStartMs: t(0),
        windowEndMs: t(15),
        participants: [user],
        granularityMinutes: 15
      });

      // still busy because of the one valid event
      expect(result[0].busyUserIds).toContain('u1');
    });
  });

  // =================================================================
  // USE CASE 5: Group Availability & Fractions
  // Requirement: Calculate what % of the group is free (for maybe heatmaps of fairness SPIRAL).
  // =================================================================
  describe('Group Aggregation', () => {
    test('should calculate correct availability fraction for mixed group', () => {
      const p1 = { userId: 'A', events: [{ startMs: t(0), endMs: t(15) }] }; // Busy
      const p2 = { userId: 'B', events: [] }; // Free
      const p3 = { userId: 'C', events: [{ startMs: t(0), endMs: t(15) }] }; // Busy
      const p4 = { userId: 'D', events: [] }; // Free

      const result = computeAvailabilityBlocks({
        windowStartMs: t(0),
        windowEndMs: t(15),
        participants: [p1, p2, p3, p4],
        granularityMinutes: 15
      });

      const block = result[0];
      expect(block.totalCount).toBe(4);
      expect(block.busyCount).toBe(2);
      expect(block.availableCount).toBe(2);
      expect(block.availabilityFraction).toBe(0.5); // 50% free
      expect(block.freeUserIds).toEqual(expect.arrayContaining(['B', 'D']));
      expect(block.busyUserIds).toEqual(expect.arrayContaining(['A', 'C']));
    });

    test('should handle empty participant list (0 users)', () => {
      const result = computeAvailabilityBlocks({
        windowStartMs: t(0),
        windowEndMs: t(15),
        participants: []
      });

      expect(result[0].totalCount).toBe(0);
      expect(result[0].availabilityFraction).toBe(1); // Avoid division by zero, default to "open"
    });

    // NEW: cover that "priority" is accepted (forward compatible), but ignored in MVP
    test('should accept a priority argument without changing MVP output', () => {
      const baseArgs = {
        windowStartMs: t(0),
        windowEndMs: t(15),
        participants: [{ userId: 'u1', events: [] }],
        granularityMinutes: 15
      };

      const r1 = computeAvailabilityBlocks(baseArgs);
      const r2 = computeAvailabilityBlocks({ ...baseArgs, priority: "B1" });

      expect(r2).toEqual(r1);
    });
  });
});

// ================================================================
// more tests to get 100% coverage
// ===============================================================

// Test for granularity edge cases negative or 0
describe('Granularity Edge Cases', () => {
  test('should throw error if granularityMinutes is non-positive', () => {
    expect(() => {
      computeAvailabilityBlocks({
        windowStartMs: t(0),
        windowEndMs: t(60),
        participants: [],
        granularityMinutes: 0
      });
    }).toThrow(/granularityMinutes must be a positive number/);
  });

  test('should throw error if granularityMinutes is negative', () => {
    expect(() => {
      computeAvailabilityBlocks({
        windowStartMs: t(0),
        windowEndMs: t(60),
        participants: [],
        granularityMinutes: -15
      });
    }).toThrow(/granularityMinutes must be a positive number/);
  });

  // NEW: cover non-finite blockMs paths (NaN / Infinity)
  test('should throw error if granularityMinutes is NaN', () => {
    expect(() => {
      computeAvailabilityBlocks({
        windowStartMs: t(0),
        windowEndMs: t(60),
        participants: [],
        granularityMinutes: NaN
      });
    }).toThrow(/granularityMinutes must be a positive number/);
  });

  test('should throw error if granularityMinutes is Infinity', () => {
    expect(() => {
      computeAvailabilityBlocks({
        windowStartMs: t(0),
        windowEndMs: t(60),
        participants: [],
        granularityMinutes: Infinity
      });
    }).toThrow(/granularityMinutes must be a positive number/);
  });
});

// Test for ev === null or undefined
describe('Event Null/Undefined Handling', () => {
  test('should ignore null events in participant event list (no crash, valid event still counts)', () => {
    const user = {
      userId: 'u1',
      events: [null, { startMs: t(10), endMs: t(20) }]
    };

    const result = computeAvailabilityBlocks({
      windowStartMs: t(0),
      windowEndMs: t(30),
      participants: [user],
      granularityMinutes: 15
    });

    // Block 1 (0-15): Busy (overlap 10-15)
    expect(result[0].busyUserIds).toContain('u1');
    // Block 2 (15-30): Busy (overlap 15-20)
    expect(result[1].busyUserIds).toContain('u1');
  });

  test('should ignore undefined events in participant event list (no crash, valid event still counts)', () => {
    const user = {
      userId: 'u1',
      events: [undefined, { startMs: t(10), endMs: t(20) }]
    };

    const result = computeAvailabilityBlocks({
      windowStartMs: t(0),
      windowEndMs: t(30),
      participants: [user],
      granularityMinutes: 15
    });

    // Block 1 (0-15): Busy (overlap 10-15)
    expect(result[0].busyUserIds).toContain('u1');
    // Block 2 (15-30): Busy (overlap 15-20)
    expect(result[1].busyUserIds).toContain('u1');
  });
});

// Test for ev.startMs or ev.endMs not finite
describe('Event Timestamp Validation', () => {
  test('should ignore events with non-finite startMs and still count valid events', () => {
    const user = {
      userId: 'u1',
      events: [{ startMs: NaN, endMs: t(20) }, { startMs: t(10), endMs: t(20) }]
    };

    const result = computeAvailabilityBlocks({
      windowStartMs: t(0),
      windowEndMs: t(30),
      participants: [user],
      granularityMinutes: 15
    });

    expect(result[0].busyUserIds).toContain('u1');
    expect(result[1].busyUserIds).toContain('u1');
  });

  test('should ignore events with non-finite endMs and still count valid events', () => {
    const user = {
      userId: 'u1',
      events: [{ startMs: t(10), endMs: Infinity }, { startMs: t(10), endMs: t(20) }]
    };

    const result = computeAvailabilityBlocks({
      windowStartMs: t(0),
      windowEndMs: t(30),
      participants: [user],
      granularityMinutes: 15
    });

    expect(result[0].busyUserIds).toContain('u1');
    expect(result[1].busyUserIds).toContain('u1');
  });
});

// NEW: cover the Array.isArray(p.events) ? p.events : [] path
describe('Participant Event List Validation', () => {
  test('should treat participant.events = null as empty list (user should be free)', () => {
    const user = { userId: 'u1', events: null };

    const result = computeAvailabilityBlocks({
      windowStartMs: t(0),
      windowEndMs: t(30),
      participants: [user],
      granularityMinutes: 15
    });

    expect(result[0].freeUserIds).toContain('u1');
    expect(result[1].freeUserIds).toContain('u1');
  });

  test('should treat participant.events = "not an array" as empty list (user should be free)', () => {
    const user = { userId: 'u1', events: "not an array" };

    const result = computeAvailabilityBlocks({
      windowStartMs: t(0),
      windowEndMs: t(30),
      participants: [user],
      granularityMinutes: 15
    });

    expect(result[0].freeUserIds).toContain('u1');
    expect(result[1].freeUserIds).toContain('u1');
  });
});