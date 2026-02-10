import { EventStore, EventStoreError, EventSources } from "./model.js";
import { BlockingLevel } from "../types/algorithm_types.js";

const USER_A = "user-a";
const USER_B = "user-b";

function createStore({ nowMs = 1700000000000 } = {}) {
  return new EventStore({
    nowFn: () => nowMs,
    manualEventPrefix: "manual",
  });
}

describe("EventStore: manual events", () => {
  test("adds manual event with default B3 and trims title", () => {
    const store = createStore({ nowMs: 1234 });
    const event = store.addManualEvent({
      userId: USER_A,
      startMs: 0,
      endMs: 60,
      title: "  Focus Block  ",
    });

    expect(event.eventRef).toBe("manual-1234-1");
    expect(event.blockingLevel).toBe(BlockingLevel.B3);
    expect(event.title).toBe("Focus Block");
    expect(event.source).toBe(EventSources.manual);
  });

  test("uses default nowFn when not provided", () => {
    const store = new EventStore();
    const event = store.addManualEvent({
      userId: USER_A,
      startMs: 5,
      endMs: 15,
    });

    expect(event.eventRef).toMatch(/^manual-\d+-1$/);
  });

  test("accepts explicit eventRef and omits empty title", () => {
    const store = createStore();
    const event = store.addManualEvent({
      userId: USER_A,
      startMs: 10,
      endMs: 20,
      eventRef: "manual-custom-1",
      title: "   ",
    });

    expect(event.eventRef).toBe("manual-custom-1");
    expect(event.title).toBeUndefined();
  });

  test("rejects duplicate manual eventRef per user", () => {
    const store = createStore();
    store.addManualEvent({
      userId: USER_A,
      startMs: 0,
      endMs: 10,
      eventRef: "dup-ref",
    });

    expect(() => {
      store.addManualEvent({
        userId: USER_A,
        startMs: 20,
        endMs: 30,
        eventRef: "dup-ref",
      });
    }).toThrow(EventStoreError);
  });

  test("validates userId and time bounds", () => {
    const store = createStore();

    expect(() => {
      store.addManualEvent({ userId: "", startMs: 0, endMs: 10 });
    }).toThrow(/userId must be a non-empty string/);

    expect(() => {
      store.addManualEvent({ userId: USER_A, startMs: NaN, endMs: 10 });
    }).toThrow(/startMs must be a finite number/);

    expect(() => {
      store.addManualEvent({ userId: USER_A, startMs: 0, endMs: Infinity });
    }).toThrow(/endMs must be a finite number/);

    expect(() => {
      store.addManualEvent({ userId: USER_A, startMs: 10, endMs: 10 });
    }).toThrow(/endMs must be greater than startMs/);
  });

  test("validates blockingLevel values", () => {
    const store = createStore();
    expect(() => {
      store.addManualEvent({
        userId: USER_A,
        startMs: 0,
        endMs: 10,
        blockingLevel: "B9",
      });
    }).toThrow(/blockingLevel must be one of/);
  });
});

describe("EventStore: google snapshot + priority overrides", () => {
  test("rejects non-array events payload", () => {
    const store = createStore();
    expect(() => {
      store.setGoogleEvents({ userId: USER_A, events: "nope" });
    }).toThrow(/events must be an array/);
  });

  test("loads google events, trims title, ignores null entries", () => {
    const store = createStore();
    const count = store.setGoogleEvents({
      userId: USER_A,
      events: [
        null,
        {
          eventRef: "g1",
          startMs: 0,
          endMs: 60,
          title: "  Meeting  ",
        },
      ],
    });

    expect(count).toBe(1);
    const events = store.getUserEvents({ userId: USER_A, includeManual: false });
    expect(events).toHaveLength(1);
    expect(events[0].title).toBe("Meeting");
    expect(events[0].blockingLevel).toBe(BlockingLevel.B3);
    expect(events[0].source).toBe(EventSources.google);
  });

  test("uses provided google blockingLevel when no override exists", () => {
    const store = createStore();
    store.setGoogleEvents({
      userId: USER_A,
      events: [
        { eventRef: "g-level", startMs: 0, endMs: 30, blockingLevel: BlockingLevel.B2 },
      ],
    });

    const events = store.getUserEvents({ userId: USER_A, includeManual: false });
    expect(events[0].blockingLevel).toBe(BlockingLevel.B2);
  });

  test("rejects duplicate google eventRef in snapshot", () => {
    const store = createStore();
    expect(() => {
      store.setGoogleEvents({
        userId: USER_A,
        events: [
          { eventRef: "g1", startMs: 0, endMs: 10 },
          { eventRef: "g1", startMs: 20, endMs: 30 },
        ],
      });
    }).toThrow(/Duplicate eventRef/);
  });

  test("rejects google event missing eventRef or invalid interval", () => {
    const store = createStore();
    expect(() => {
      store.setGoogleEvents({
        userId: USER_A,
        events: [{ startMs: 0, endMs: 10 }],
      });
    }).toThrow(/eventRef must be a non-empty string/);

    expect(() => {
      store.setGoogleEvents({
        userId: USER_A,
        events: [{ eventRef: "g1", startMs: 10, endMs: 10 }],
      });
    }).toThrow(/endMs must be greater than startMs/);
  });

  test("applies priority override on snapshot load", () => {
    const store = createStore();
    store.setGoogleEventPriority({
      userId: USER_A,
      eventRef: "g1",
      blockingLevel: BlockingLevel.B1,
    });

    store.setGoogleEvents({
      userId: USER_A,
      events: [{ eventRef: "g1", startMs: 0, endMs: 30, blockingLevel: BlockingLevel.B2 }],
    });

    const events = store.getUserEvents({ userId: USER_A, includeManual: false });
    expect(events[0].blockingLevel).toBe(BlockingLevel.B1);
  });

  test("updates priority for existing google event and returns applied=true", () => {
    const store = createStore();
    store.setGoogleEvents({
      userId: USER_A,
      events: [{ eventRef: "g2", startMs: 0, endMs: 30 }],
    });

    const result = store.setGoogleEventPriority({
      userId: USER_A,
      eventRef: "g2",
      blockingLevel: BlockingLevel.B2,
    });

    expect(result.applied).toBe(true);
    expect(result.event.blockingLevel).toBe(BlockingLevel.B2);

    const result2 = store.setGoogleEventPriority({
      userId: USER_A,
      eventRef: "g2",
      blockingLevel: BlockingLevel.B1,
    });
    expect(result2.applied).toBe(true);
    expect(result2.event.blockingLevel).toBe(BlockingLevel.B1);
  });

  test("returns applied=false when overriding missing google event", () => {
    const store = createStore();
    const result = store.setGoogleEventPriority({
      userId: USER_A,
      eventRef: "missing",
      blockingLevel: BlockingLevel.B1,
    });

    expect(result.applied).toBe(false);
    expect(result.event.source).toBe(EventSources.google);
    expect(result.event.blockingLevel).toBe(BlockingLevel.B1);
  });

  test("override persists across refreshed google snapshot", () => {
    const store = createStore();
    store.setGoogleEventPriority({
      userId: USER_A,
      eventRef: "g3",
      blockingLevel: BlockingLevel.B1,
    });

    store.setGoogleEvents({
      userId: USER_A,
      events: [{ eventRef: "g3", startMs: 0, endMs: 20 }],
    });

    const events = store.getUserEvents({ userId: USER_A, includeManual: false });
    expect(events[0].blockingLevel).toBe(BlockingLevel.B1);
  });

  test("manual blocks persist while google snapshots refresh", () => {
    const store = createStore();
    store.addManualEvent({ userId: USER_A, startMs: 0, endMs: 10 });

    store.setGoogleEvents({
      userId: USER_A,
      events: [{ eventRef: "g-old", startMs: 20, endMs: 30 }],
    });

    store.setGoogleEvents({
      userId: USER_A,
      events: [{ eventRef: "g-new", startMs: 40, endMs: 50 }],
    });

    const allEvents = store.getUserEvents({ userId: USER_A });
    const manualCount = allEvents.filter((e) => e.source === EventSources.manual).length;
    const googleOnly = store.getUserEvents({ userId: USER_A, includeManual: false });

    expect(manualCount).toBe(1);
    expect(googleOnly).toHaveLength(1);
    expect(googleOnly[0].eventRef).toBe("g-new");
  });
});

describe("EventStore: retrieval helpers", () => {
  test("getUserEvents respects includeManual/includeGoogle", () => {
    const store = createStore();
    store.addManualEvent({ userId: USER_A, startMs: 0, endMs: 10 });
    store.setGoogleEvents({
      userId: USER_A,
      events: [{ eventRef: "g1", startMs: 20, endMs: 30 }],
    });

    const manualOnly = store.getUserEvents({ userId: USER_A, includeGoogle: false });
    const googleOnly = store.getUserEvents({ userId: USER_A, includeManual: false });
    const none = store.getUserEvents({ userId: USER_A, includeManual: false, includeGoogle: false });

    expect(manualOnly).toHaveLength(1);
    expect(googleOnly).toHaveLength(1);
    expect(none).toHaveLength(0);
  });

  test("getParticipantSnapshot returns combined events", () => {
    const store = createStore();
    store.addManualEvent({ userId: USER_A, startMs: 0, endMs: 10 });
    store.setGoogleEvents({
      userId: USER_A,
      events: [{ eventRef: "g1", startMs: 20, endMs: 30 }],
    });

    const snapshot = store.getParticipantSnapshot({ userId: USER_A });
    expect(snapshot.userId).toBe(USER_A);
    expect(snapshot.events).toHaveLength(2);
  });

  test("getAllParticipantSnapshots includes users from manual and google maps", () => {
    const store = createStore();
    store.addManualEvent({ userId: USER_A, startMs: 0, endMs: 10 });
    store.setGoogleEvents({
      userId: USER_B,
      events: [{ eventRef: "g1", startMs: 20, endMs: 30 }],
    });

    const snapshots = store.getAllParticipantSnapshots();
    const ids = snapshots.map((s) => s.userId).sort();
    expect(ids).toEqual([USER_A, USER_B].sort());
  });

  test("getUserEvents returns empty array when no events exist", () => {
    const store = createStore();
    const events = store.getUserEvents({ userId: USER_A });
    expect(events).toEqual([]);
  });
});
