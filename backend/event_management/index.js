/*
File: index.js
Purpose: Builds the event-management MVC bundle for ESM callers.
    It exports the factory plus the model, controller, and view helpers.
*/

import { EventStore, EventStoreError, EventSources } from "./model.js";
import { EventController } from "./controller.js";
import { createEventView } from "./view.js";

export function createEventManagementModule({
  model = new EventStore(),
  view = createEventView(),
} = {}) {
  // Build the controller around the injected or default model and view.
  const controller = new EventController(model, view);
  return { model, view, controller };
}

export { EventStore, EventStoreError, EventSources, EventController, createEventView };
