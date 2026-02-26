const { EventStore, EventStoreError, EventSources } = require("./model.js");
const { EventController } = require("./controller.js");
const { createEventView } = require("./view.js");

function createEventManagementModule({
  model = new EventStore(),
  view = createEventView(),
} = {}) {
  const controller = new EventController(model, view);
  return { model, view, controller };
}

module.exports = {
  createEventManagementModule,
  EventStore,
  EventStoreError,
  EventSources,
  EventController,
  createEventView,
};
