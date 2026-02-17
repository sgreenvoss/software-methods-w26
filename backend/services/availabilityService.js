const db = require("./db/index");
const algorithm = require("./algorithm");

// Map DB priority (1, 2, 3) to Algorithm strings ("B1", "B2", "B3")
const PRIORITY_MAP = { 1: "B1", 2: "B2", 3: "B3" };

/**
 * The MVP Logic:
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
  );  // This query gets all events for all members of the group in one go, which is more efficient than querying per user.
      // We will filter these events in-memory for the relevant time window and user, 
      // which is simpler and still efficient for our expected data sizes.
      // Note: For a production system with large data, 
      // we would want to add time window filtering directly in the SQL query to reduce the amount of data transferred and processed in-memory (FUTURE)
      // However, for this MVP and expected data sizes, this approach is simpler and sufficient?

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
  // Note: The algorithm will handle filtering events that fall outside the requested time window, so we can pass all events for simplicity. 
  // (FUTURE) We could optimize by filtering in SQL or here before passing to the algorithm if needed.
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
      // 1. Parse Inputs (Simple validation) - We can enhance this with more robust validation and error handling as needed. (FUTURE) SECURITY
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
      // 4. Error Handling
      // AI suggestion.
      console.error("Availability Error:", error);
      res.status(500).json({ error: error.message });
    }
  });
};