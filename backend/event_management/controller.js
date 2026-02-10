import { EventStore, EventStoreError } from "./model.js";
import { createEventView } from "./view.js";

export class EventController {
  /**
   * @param {EventStore} model
   * @param {ReturnType<typeof createEventView>} view
   */
  constructor(model, view = createEventView()) {
    this.model = model;
    this.view = view;
  }

  addEventBlock(args) {
    try {
      const event = this.model.addManualEvent(args);
      return this.view.eventBlockAdded(event);
    } catch (error) {
      return this._handleError(error);
    }
  }

  setGoogleEvents(args) {
    try {
      const count = this.model.setGoogleEvents(args);
      return this.view.googleEventsLoaded({ userId: args?.userId, count });
    } catch (error) {
      return this._handleError(error);
    }
  }

  updateGoogleEventPriority(args) {
    try {
      const result = this.model.setGoogleEventPriority(args);
      return this.view.googlePriorityUpdated(result);
    } catch (error) {
      return this._handleError(error);
    }
  }

  getParticipantSnapshot(args) {
    try {
      const snapshot = this.model.getParticipantSnapshot(args);
      return this.view.participantSnapshot(snapshot);
    } catch (error) {
      return this._handleError(error);
    }
  }

  listUserEvents(args) {
    try {
      const events = this.model.getUserEvents(args);
      return this.view.userEvents({ userId: args?.userId, events });
    } catch (error) {
      return this._handleError(error);
    }
  }

  _handleError(error) {
    if (error instanceof EventStoreError) {
      return this.view.error(error);
    }

    return this.view.error(
      new EventStoreError("UNKNOWN", "Unexpected error in EventController.", {
        originalMessage: error?.message,
      })
    );
  }
}
