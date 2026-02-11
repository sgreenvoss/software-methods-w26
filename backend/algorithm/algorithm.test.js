/**
 * algorithm.test.js
 *
 * Tests are written to lock down the contract + semantics.
 * If these break, it means we changed something meaningful:
 *   - input validation rules
 *   - overlap logic
 *   - threshold semantics for priority views
 *   - projection helper behavior
 */

import {
  computeAvailabilityBlocks,
  computeAvailabilityBlocksAllViews,
  toSingleViewBlocks,
  DEFAULT_G_MINUTES,
} from "./algorithm";
import { BlockingLevel } from "./types/algorithm_types";

/** @typedef {import("./types/algorithm_types.js").ParticipantSnapshot} ParticipantSnapshot */

const BASE_TIME = Date.UTC(2026, 0, 1, 10, 0, 0, 0);
const ONE_MIN = 60 * 1000;

const t = (minutes) => BASE_TIME + minutes * ONE_MIN;

describe("Algorithm: priority threshold availability", () => {
  describe("Input validation", () => {
    test("throws if windowStart/windowEnd are not finite numbers", () => {
      expect(() =>
        computeAvailabilityBlocks({
          windowStartMs: "invalid",
          windowEndMs: t(60),
          participants: [],
        })
      ).toThrow(/windowStartMs\/windowEndMs must be numbers/);

      expect(() =>
        computeAvailabilityBlocks({
          windowStartMs: t(0),
          windowEndMs: NaN,
          participants: [],
        })
      ).toThrow(/windowStartMs\/windowEndMs must be numbers/);
    });

    test("throws if windowEnd <= windowStart", () => {
      expect(() =>
        computeAvailabilityBlocks({
          windowStartMs: t(60),
          windowEndMs: t(0),
          participants: [],
        })
      ).toThrow(/windowEndMs must be > windowStartMs/);
    });

    test("throws if participants is not an array", () => {
      expect(() =>
        computeAvailabilityBlocks({
          windowStartMs: t(0),
          windowEndMs: t(60),
          participants: null,
        })
      ).toThrow(/participants must be an array/);
    });

    test("throws if granularityMinutes is invalid", () => {
      expect(() =>
        computeAvailabilityBlocks({
          windowStartMs: t(0),
          windowEndMs: t(60),
          participants: [],
          granularityMinutes: 0,
        })
      ).toThrow(/granularityMinutes must be a positive number/);

      expect(() =>
        computeAvailabilityBlocks({
          windowStartMs: t(0),
          windowEndMs: t(60),
          participants: [],
          granularityMinutes: NaN,
        })
      ).toThrow(/granularityMinutes must be a positive number/);
    });

    test("toSingleViewBlocks requires an array", () => {
      expect(() => toSingleViewBlocks(null, BlockingLevel.B1)).toThrow(/blocksMulti must be an array/);
    });
  });

  describe("Basic behavior", () => {
    test("no events => everyone is free", () => {
      const result = computeAvailabilityBlocks({
        windowStartMs: t(0),
        windowEndMs: t(60),
        participants: [{ userId: "u1", events: [] }],
        granularityMinutes: 15,
      });

      expect(result).toHaveLength(4);
      for (const block of result) {
        expect(block.freeUserIds).toEqual(["u1"]);
        expect(block.busyUserIds).toEqual([]);
        expect(block.availabilityFraction).toBe(1);
      }
    });

    test("window splits into granularity blocks + final partial block", () => {
      const r = computeAvailabilityBlocks({
        windowStartMs: t(0),
        windowEndMs: t(16),
        participants: [{ userId: "u1", events: [] }],
        granularityMinutes: 15,
      });

      expect(r).toHaveLength(2);
      expect(r[0].startMs).toBe(t(0));
      expect(r[0].endMs).toBe(t(15));
      expect(r[1].startMs).toBe(t(15));
      expect(r[1].endMs).toBe(t(16));
    });

    test("availabilityFraction handles empty participant list", () => {
      const r = computeAvailabilityBlocks({
        windowStartMs: t(0),
        windowEndMs: t(15),
        participants: [],
      });

      expect(r[0].totalCount).toBe(0);
      expect(r[0].availabilityFraction).toBe(1);
    });
  });

  describe("Overlaps + merging", () => {
    test("overlapping events merge", () => {
      const user = {
        userId: "u1",
        events: [
          { startMs: t(10), endMs: t(20) },
          { startMs: t(15), endMs: t(25) },
        ],
      };

      const r = computeAvailabilityBlocks({
        windowStartMs: t(0),
        windowEndMs: t(45),
        participants: [user],
        granularityMinutes: 15,
      });

      // 0-15 overlaps 10-15 => busy
      expect(r[0].busyUserIds).toContain("u1");
      // 15-30 overlaps 15-25 => busy
      expect(r[1].busyUserIds).toContain("u1");
      // 30-45 => free
      expect(r[2].freeUserIds).toContain("u1");
    });

    test("adjacent intervals are not merged", () => {
      const user = {
        userId: "u1",
        events: [
          { startMs: t(0), endMs: t(15) },
          { startMs: t(15), endMs: t(30) },
        ],
      };

      const r = computeAvailabilityBlocks({
        windowStartMs: t(0),
        windowEndMs: t(30),
        participants: [user],
        granularityMinutes: 15,
      });

      expect(r).toHaveLength(2);
      expect(r[0].busyUserIds).toContain("u1");
      expect(r[1].busyUserIds).toContain("u1");
    });

    test("invalid events (end <= start) are ignored", () => {
      const user = {
        userId: "u1",
        events: [{ startMs: t(10), endMs: t(10) }],
      };

      const r = computeAvailabilityBlocks({
        windowStartMs: t(0),
        windowEndMs: t(15),
        participants: [user],
        granularityMinutes: 15,
      });

      expect(r[0].freeUserIds).toContain("u1");
    });

    test("events fully outside window get clamped away", () => {
      const user = {
        userId: "u1",
        events: [
          { startMs: t(-60), endMs: t(-30) },
          { startMs: t(90), endMs: t(120) },
        ],
      };

      const r = computeAvailabilityBlocks({
        windowStartMs: t(0),
        windowEndMs: t(30),
        participants: [user],
        granularityMinutes: 15,
      });

      expect(r).toHaveLength(2);
      expect(r[0].freeUserIds).toContain("u1");
      expect(r[1].freeUserIds).toContain("u1");
    });
  });

  describe("Priority threshold semantics (single view)", () => {
    /** @type {ParticipantSnapshot[]} */
    const participants = [
      {
        userId: "u1",
        events: [{ startMs: t(0), endMs: t(15), blockingLevel: BlockingLevel.B1 }],
      },
      {
        userId: "u2",
        events: [{ startMs: t(0), endMs: t(15), blockingLevel: BlockingLevel.B2 }],
      },
      {
        userId: "u3",
        events: [{ startMs: t(0), endMs: t(15), blockingLevel: BlockingLevel.B3 }],
      },
    ];

    test("B3 view counts only B3", () => {
      const r = computeAvailabilityBlocks({
        windowStartMs: t(0),
        windowEndMs: t(15),
        participants,
        granularityMinutes: 15,
        priority: BlockingLevel.B3,
      })[0];

      expect(r.busyUserIds).toEqual(["u3"]);
      expect(r.freeUserIds).toEqual(expect.arrayContaining(["u1", "u2"]));
    });

    test("B2 view counts B2+B3", () => {
      const r = computeAvailabilityBlocks({
        windowStartMs: t(0),
        windowEndMs: t(15),
        participants,
        granularityMinutes: 15,
        priority: BlockingLevel.B2,
      })[0];

      expect(r.busyUserIds).toEqual(expect.arrayContaining(["u2", "u3"]));
      expect(r.freeUserIds).toEqual(["u1"]);
    });

    test("B1 view counts everything", () => {
      const r = computeAvailabilityBlocks({
        windowStartMs: t(0),
        windowEndMs: t(15),
        participants,
        granularityMinutes: 15,
        priority: BlockingLevel.B1,
      })[0];

      expect(r.busyUserIds).toEqual(expect.arrayContaining(["u1", "u2", "u3"]));
      expect(r.freeUserIds).toHaveLength(0);
    });

    test("missing/invalid blockingLevel defaults to B3 (conservative)", () => {
      const p = [{ userId: "x", events: [{ startMs: t(0), endMs: t(15) }] }];

      const r = computeAvailabilityBlocks({
        windowStartMs: t(0),
        windowEndMs: t(15),
        participants: p,
        granularityMinutes: 15,
        priority: BlockingLevel.B3,
      })[0];

      expect(r.busyUserIds).toEqual(["x"]);
    });
  });

  describe("All views computed once + projection helper", () => {
    test("toSingleViewBlocks(allViews, chosen) matches computeAvailabilityBlocks(...priority=chosen)", () => {
      const participants = [
        {
          userId: "A",
          events: [
            { startMs: t(0), endMs: t(15), blockingLevel: BlockingLevel.B1 },
            { startMs: t(30), endMs: t(45), blockingLevel: BlockingLevel.B3 },
          ],
        },
        {
          userId: "B",
          events: [{ startMs: t(10), endMs: t(20), blockingLevel: BlockingLevel.B2 }],
        },
      ];

      const windowStartMs = t(0);
      const windowEndMs = t(60);
      const granularityMinutes = DEFAULT_G_MINUTES;

      const all = computeAvailabilityBlocksAllViews({
        windowStartMs,
        windowEndMs,
        participants,
        granularityMinutes,
      });

      for (const chosen of [BlockingLevel.B1, BlockingLevel.B2, BlockingLevel.B3]) {
        const projected = toSingleViewBlocks(all, chosen);

        const single = computeAvailabilityBlocks({
          windowStartMs,
          windowEndMs,
          participants,
          granularityMinutes,
          priority: chosen,
        });

        expect(projected).toHaveLength(single.length);
        for (let i = 0; i < single.length; i++) {
          expect(projected[i]).toEqual(single[i]);
        }
      }
    });

    test("invalid chosen defaults to B1", () => {
      const participants = [{ userId: "u1", events: [] }];

      const all = computeAvailabilityBlocksAllViews({
        windowStartMs: t(0),
        windowEndMs: t(30),
        participants,
        granularityMinutes: 15,
      });

      const projected = toSingleViewBlocks(all, "NOT_A_LEVEL");
      const b1 = computeAvailabilityBlocks({
        windowStartMs: t(0),
        windowEndMs: t(30),
        participants,
        granularityMinutes: 15,
        priority: BlockingLevel.B1,
      });

      expect(projected).toEqual(b1);
    });
  });
});
//ALTERED/SHORTENED WHEN PRIORITY ADDED (REVERT TO OLD COMMIT TO FIND FULL TEST FILE SUITE)
