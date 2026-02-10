import { EventStore, EventStoreError } from "./model.js";
import { EventController } from "./controller.js";
import { createEventView } from "./view.js";
import { BlockingLevel } from "../types/algorithm_types.js";

describe("EventController: happy paths", () => {
  test("returns view payloads for each controller method", () => {
    const store = new EventStore({ nowFn: () => 1, manualEventPrefix: "manual" });
    const controller = new EventController(store, createEventView());

    const added = controller.addEventBlock({ userId: "u1", startMs: 0, endMs: 10 });
    expect(added.ok).toBe(true);
    expect(added.action).toBe("manual_event_added");

    const loaded = controller.setGoogleEvents({
      userId: "u1",
      events: [{ eventRef: "g1", startMs: 20, endMs: 30 }],
    });
    expect(loaded.ok).toBe(true);
    expect(loaded.action).toBe("google_events_loaded");
    expect(loaded.count).toBe(1);

    const updated = controller.updateGoogleEventPriority({
      userId: "u1",
      eventRef: "g1",
      blockingLevel: BlockingLevel.B1,
    });
    expect(updated.ok).toBe(true);
    expect(updated.action).toBe("google_priority_updated");
    expect(updated.applied).toBe(true);

    const snapshot = controller.getParticipantSnapshot({ userId: "u1" });
    expect(snapshot.ok).toBe(true);
    expect(snapshot.action).toBe("participant_snapshot");
    expect(snapshot.snapshot.userId).toBe("u1");

    const list = controller.listUserEvents({ userId: "u1" });
    expect(list.ok).toBe(true);
    expect(list.action).toBe("user_events");
    expect(list.events.length).toBeGreaterThan(0);
  });
});

describe("EventController: EventStoreError handling", () => {
  test("maps EventStoreError through view.error for each method", () => {
    const model = {
      addManualEvent: () => {
        throw new EventStoreError("VALIDATION_ERROR", "bad add");
      },
      setGoogleEvents: () => {
        throw new EventStoreError("VALIDATION_ERROR", "bad set");
      },
      setGoogleEventPriority: () => {
        throw new EventStoreError("VALIDATION_ERROR", "bad update");
      },
      getParticipantSnapshot: () => {
        throw new EventStoreError("VALIDATION_ERROR", "bad snapshot");
      },
      getUserEvents: () => {
        throw new EventStoreError("VALIDATION_ERROR", "bad list");
      },
    };

    const controller = new EventController(model, createEventView());

    const res1 = controller.addEventBlock({});
    const res2 = controller.setGoogleEvents({});
    const res3 = controller.updateGoogleEventPriority({});
    const res4 = controller.getParticipantSnapshot({});
    const res5 = controller.listUserEvents({});

    [res1, res2, res3, res4, res5].forEach((res) => {
      expect(res.ok).toBe(false);
      expect(res.error.code).toBe("VALIDATION_ERROR");
    });
  });
});

describe("EventController: unknown error handling", () => {
  test("maps unexpected errors to UNKNOWN code", () => {
    const model = {
      addManualEvent: () => {
        throw new Error("boom");
      },
    };

    const controller = new EventController(model, createEventView());
    const res = controller.addEventBlock({});

    expect(res.ok).toBe(false);
    expect(res.error.code).toBe("UNKNOWN");
    expect(res.error.details.originalMessage).toBe("boom");
  });
});
