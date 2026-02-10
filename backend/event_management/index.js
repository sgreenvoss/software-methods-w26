import { EventStore, EventStoreError, EventSources } from "./model.js";
import { EventController } from "./controller.js";
import { createEventView } from "./view.js";

export function createEventManagementModule({
  model = new EventStore(),
  view = createEventView(),
} = {}) {
  const controller = new EventController(model, view);
  return { model, view, controller };
}

export { EventStore, EventStoreError, EventSources, EventController, createEventView };
