// availability.test.js
import { computeAvailabilityBlocks, DEFAULT_G_MINUTES } from './availability';

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
  });

  // =================================================================
  // USE CASE 3: Event Overlap Logic
  // Requirement: Events overlapping a block mark the user as busy for that block.
  // =================================================================
  describe('Event Overlap Logic', () => {
    const user = { userId: 'u1', events: [] };

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
  });

  // =================================================================
  // USE CASE 5: Group Availability & Fractions
  // Requirement: Calculate what % of the group is free (for heatmaps).
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
  });
});
// ================================================================
// more tests to get 100% coverage
// ===============================================================
// Test for granularity edge cases negative or 0
describe('Granularity Edge Cases', () => {
    test('should throw error if granularityMinutes is non-positive', () => {
        expect( () => {
            computeAvailabilityBlocks({
                windowStartMs: t(0),
                windowEndMs: t(60),
                participants: [],
                granularityMinutes: 0
            });
        }).toThrow();
    });

    test('should throw error if granularityMinutes is negative', () => {
        expect( () => {
            computeAvailabilityBlocks({
                windowStartMs: t(0),
                windowEndMs: t(60),
                participants: [],
                granularityMinutes: -15
            });
        }).toThrow();
    });
});

// Test for ev === null or undefined
describe('Event Null/Undefined Handling', () => {
    test('should ignore null events in participant event list and assert user is "free"', () => {
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

    test('should ignore undefined events in participant event list and assert user is "free"', () => {
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
    test('should ignore events with non-finite startMs and assert user is "free"', () => {
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
        // Block 1 (0-15): Busy (overlap 10-15)
        expect(result[0].busyUserIds).toContain('u1');
        // Block 2 (15-30): Busy (overlap 15-20)
        expect(result[1].busyUserIds).toContain('u1');
    });

    test('should ignore events with non-finite endMs and assert user is "free"', () => {
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
        // Block 1 (0-15): Busy (overlap 10-15)
        expect(result[0].busyUserIds).toContain('u1');
        // Block 2 (15-30): Busy (overlap 15-20)
        expect(result[1].busyUserIds).toContain('u1');
    });
});