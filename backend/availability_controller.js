/*
File: availability_controller.js
Purpose: Handles the group availability endpoint.
    This file validates the request, checks group access, and returns service data.
*/

const availabilityService = require('./services/availability_service');
const db = require('./db/dbInterface');

const availabilityController = {
  async getAvailability(req, res) {
    // Check that the user has an authenticated session before hitting the service.
    if (!req.session.userId) {
      return res.status(401).json({ ok: false, message: "Unauthorized" });
    }

    try {
      const { groupId } = req.params;

      // Read the query keys the frontend sends for the availability window.
      const { windowStartMs, windowEndMs } = req.query;

      // Convert route and query values up front so the validation stays in one place.
      const parsedGroupId = Number(groupId);
      const start = Number(windowStartMs);
      const end = Number(windowEndMs);

      if (!Number.isInteger(parsedGroupId) || parsedGroupId <= 0) {
        return res.status(400).json({
          ok: false,
          error: "Invalid groupId"
        });
      }

      if (isNaN(start) || isNaN(end)) {
        return res.status(400).json({ 
          ok: false, 
          error: "Invalid or missing timestamps (windowStartMs/windowEndMs)" 
        });
      }

      const userId = Number(req.session.userId);
      const isMember = await db.isUserInGroup(userId, parsedGroupId);
      if (!isMember) {
        return res.status(403).json({
          ok: false,
          error: "Forbidden"
        });
      }

      const data = await availabilityService.getGroupAvailability(
        parsedGroupId.toString(),
        start,
        end
      );

      // Return the service payload in the same envelope the frontend already expects.
      res.json({ ok: true, ...data });

    } catch (err) {
      // Let the service drive the status code when it throws a classified error.
      console.error(`[AvailabilityController] Error: ${err.message}`);
      const statusCode = err.status || 500;
      res.status(statusCode).json({ ok: false, error: err.message });
    }
  }
};

module.exports = availabilityController;
