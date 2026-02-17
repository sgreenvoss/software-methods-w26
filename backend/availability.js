// availability.js
// This module defines the route handler for computing group availability.
// It uses the availability service to perform the necessary computations and returns the results in a standardized format.
// The route is protected and requires the user to be authenticated. It also handles various error scenarios and returns appropriate HTTP status codes and error messages. (instead of just an error like algorithm.js

// The route expects the following query parameters:
// - windowStartMs: The start of the time window for which to compute availability, in milliseconds since the epoch.
// - windowEndMs: The end of the time window for which to compute availability, in milliseconds since the epoch.
// - granularityMinutes: The granularity of the availability results, in minutes (e.g., 15 for 15-minute intervals).
// - priority: An optional parameter that can be used to specify how to prioritize different users' availabilities when computing the results.
const db = require("./db/index");
const algorithm = require("./algorithm/algorithm.js");

// Map DB priority (1, 2, 3) to Algorithm strings ("B1", "B2", "B3")
const PRIORITY_MAP = { 1: "B1", 2: "B2", 3: "B3" };

/**
 * The "Bicycle" Logic:
 * 1. Get Group Members
 * 2. Get Their Events
 * 3. Run Algorithm
 */
async function getGroupAvailability(groupId, startMs, endMs) {
  // 1. Get Group Members
  const membersResult = await db.query(
    `SELECT user_id FROM group_match WHERE group_id = $1`,
    [groupId]
  );
  
  const memberIds = membersResult.rows.map(row => row.user_id.toString());
  
  if (memberIds.length === 0) {
    throw new Error("Group not found or has no members.");
  }

  // 2. Get Events for those members
  // Note: We cast user_id to text to ensure matching works easily
  const eventsResult = await db.query(
    `SELECT gm.user_id::text as user_id, 
            ce.event_start, 
            ce.event_end, 
            ce.priority
     FROM group_match gm
     JOIN calendar c ON c.user_id = gm.user_id
     JOIN cal_event ce ON ce.calendar_id = c.calendar_id
     WHERE gm.group_id = $1`,
    [groupId]
  );

  // 3. Transform DB rows -> Algorithm Input
  const participants = memberIds.map(userId => {
    // Filter events for this specific user
    const userEvents = eventsResult.rows
      .filter(row => row.user_id === userId)
      .map(row => ({
        startMs: new Date(row.event_start).getTime(),
        endMs: new Date(row.event_end).getTime(),
        blockingLevel: PRIORITY_MAP[row.priority] || "B3"
      }));

    return {
      userId: userId,
      events: userEvents
    };
  });

  // 4. Run the Algorithm
  return algorithm.computeAvailabilityBlocks({
    windowStartMs: startMs,
    windowEndMs: endMs,
    participants: participants
  });
}

// Express Wiring
module.exports = function availabilityModule(app) {
  app.get("/api/groups/:groupId/availability", async (req, res) => {
    try {
      // 1. Parse Inputs (Simple validation)
      const groupId = req.params.groupId;
      const startMs = parseInt(req.query.windowStartMs);
      const endMs = parseInt(req.query.windowEndMs);

      if (isNaN(startMs) || isNaN(endMs)) {
        return res.status(400).json({ error: "windowStartMs and windowEndMs are required numbers" });
      }

      // 2. Run Logic
      const result = await getGroupAvailability(groupId, startMs, endMs);

      // 3. Send Response
      res.json(result);

    } catch (error) {
      console.error("Availability Error:", error);
      res.status(500).json({ error: error.message });
    }
  });
};