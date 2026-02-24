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
    // CustomCalendar expects: {start, end, count}
    const formattedBlocks = blocks.map((block) => {
      // Keep strict-view mapping as the default UI projection.
      // The algorithm already computes counts; we just reshape them.
      // No algorithm contract changes needed here.
      const strictView = block.views && block.views.StrictView ? block.views.StrictView : {};
      return {
        start: new Date(block.startMs).toISOString(),
        end: new Date(block.endMs).toISOString(),
        count: Number.isFinite(strictView.availableCount) ? strictView.availableCount : 0,
        availabilityFraction: Number.isFinite(strictView.availabilityFraction) ? strictView.availabilityFraction : 0,
        totalCount: Number.isFinite(strictView.totalCount) ? strictView.totalCount : 0
      };
    });
    // Return the clean data to the controller
    return {
      groupId,
      windowStartMs,
      windowEndMs,
      availability: formattedBlocks,
      blocks: formattedBlocks // temporary alias for compatibility during transition
    };
  }
};

module.exports = availabilityService;
