const express = require('express');
const { createEventController } = require('../controllers/event_controller');

function createEventRouter(deps) {
  const router = express.Router();
  const controller = createEventController(deps);

  router.get('/api/events', controller.getEvents);
  router.get('/api/get-events', controller.getStoredEvents);
  router.post('/api/events/manual', controller.createManualEvent);
  router.post('/api/events/:eventId/priority', controller.updateGoogleEventPriority);
  router.delete('/api/events/:eventId', controller.deleteManualEvent);

  return router;
}

module.exports = createEventRouter;
