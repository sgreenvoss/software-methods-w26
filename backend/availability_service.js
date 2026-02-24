/**
 * availability_service.js
 * * Goal: The "Model" in MVC. Orchestrates data fetching and calculation.
 * Principles: Implementation Hiding (Ch. 6), High Cohesion (Ch. 6).
 */

const { fetchAndMapGroupEvents } = require('./algorithm/algorithm_adapter');
const { computeAvailabilityBlocksAllViews } = require('./algorithm/algorithm');
const db = require('./db/dbInterface.js');

/**
 * High-level service to get group availability heatmap data.
 * Handles the orchestration of DB fetching, mapping, and core calculation.
 */
const availabilityService = {
  
  async getGroupAvailability(groupId, windowStartMs, windowEndMs) {
    // 1. Ch. 1: Fail Fast - Validate inputs before touching the DB
    if (!windowStartMs || !windowEndMs || windowEndMs <= windowStartMs) {
      const err = new Error("Invalid time window: end must be after start.");
      err.status = 400; // Ch. 5: Explicit error state for Alternative Flow
      throw err;
    }

    // 2. Ch. 6: Implementation Hiding - Controller doesn't know about the Adapter
    // Fetch raw events from DB and map them to the ParticipantSnapshot format
    const participants = await fetchAndMapGroupEvents(db, groupId, windowStartMs, windowEndMs);

    // 3. Ch. 1: Failure Containment - Handle empty groups gracefully
    if (!participants || participants.length === 0) {
      const err = new Error("No members found for this group.");
      err.status = 404;
      throw err;
    }

    // 4. Ch. 7: MVC Separation - Delegate pure math to the Algorithm "Model"
    console.log("DATA FED TO ALGORITHM:", JSON.stringify(participants, null, 2)); // Debug log to verify input format
    const blocks = computeAvailabilityBlocksAllViews({
      windowStartMs,
      windowEndMs,
      participants,
      granularityMinutes: 15
    });
    // FIX ATTEMPT: Match input contract for CustomCalendarView
    // CustomCalendar expects: {start, end, count}
    const formattedBlocks = blocks.map(block => ({
      start: new Date(block.startMs).toISOString(),
      end: new Date(block.endMs).toISOString(),
      // Clarity 02-22 1.1: Using view names instead of B1/B2/B3 for clarity in the frontend
      count: block.views.StrictView
    }));
    // Return the clean data to the controller
    return {
      groupId,
      windowStartMs,
      windowEndMs,
      blocks : formattedBlocks
    };
  }
};

module.exports = availabilityService;