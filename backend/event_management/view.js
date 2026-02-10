export function createEventView() {
  return {
    eventBlockAdded(event) {
      return {
        ok: true,
        action: "manual_event_added",
        event,
      };
    },

    googleEventsLoaded({ userId, count }) {
      return {
        ok: true,
        action: "google_events_loaded",
        userId,
        count,
      };
    },

    googlePriorityUpdated({ applied, event }) {
      return {
        ok: true,
        action: "google_priority_updated",
        applied,
        event,
      };
    },

    participantSnapshot(snapshot) {
      return {
        ok: true,
        action: "participant_snapshot",
        snapshot,
      };
    },

    userEvents({ userId, events }) {
      return {
        ok: true,
        action: "user_events",
        userId,
        events,
      };
    },

    error(error) {
      return {
        ok: false,
        error: {
          code: error?.code ?? "UNKNOWN",
          message: error?.message ?? "Unknown error",
          details: error?.details ?? null,
        },
      };
    },
  };
}
