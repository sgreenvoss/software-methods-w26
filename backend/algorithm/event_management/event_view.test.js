import { createEventView } from "./view.js";

describe("Event view helpers", () => {
  test("success helpers return ok actions", () => {
    const view = createEventView();
    const event = { eventRef: "e1" };

    expect(view.eventBlockAdded(event)).toEqual({
      ok: true,
      action: "manual_event_added",
      event,
    });

    expect(view.googleEventsLoaded({ userId: "u1", count: 2 })).toEqual({
      ok: true,
      action: "google_events_loaded",
      userId: "u1",
      count: 2,
    });

    expect(view.googlePriorityUpdated({ applied: true, event })).toEqual({
      ok: true,
      action: "google_priority_updated",
      applied: true,
      event,
    });

    expect(view.participantSnapshot({ userId: "u1", events: [] })).toEqual({
      ok: true,
      action: "participant_snapshot",
      snapshot: { userId: "u1", events: [] },
    });

    expect(view.userEvents({ userId: "u1", events: [event] })).toEqual({
      ok: true,
      action: "user_events",
      userId: "u1",
      events: [event],
    });
  });

  test("error helper returns defaults when missing fields", () => {
    const view = createEventView();
    const res = view.error();

    expect(res.ok).toBe(false);
    expect(res.error.code).toBe("UNKNOWN");
    expect(res.error.message).toBe("Unknown error");
    expect(res.error.details).toBeNull();
  });

  test("error helper passes through provided fields", () => {
    const view = createEventView();
    const res = view.error({ code: "E1", message: "Bad", details: { a: 1 } });

    expect(res.ok).toBe(false);
    expect(res.error.code).toBe("E1");
    expect(res.error.message).toBe("Bad");
    expect(res.error.details).toEqual({ a: 1 });
  });
});
