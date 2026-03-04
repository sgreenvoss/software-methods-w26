/**
 * availability_service.js
 * * Goal: The "Model" in MVC. Orchestrates data fetching and calculation.
 * Principles: Implementation Hiding (Ch. 6), High Cohesion (Ch. 6).
 */

const { fetchAndMapGroupEvents } = require('../algorithm/algorithm_adapter.js');
const { computeAvailabilityBlocksAllViews } = require('../algorithm/algorithm.js');
const db = require('../db/dbInterface.js');

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
    const blocks = computeAvailabilityBlocksAllViews({
      windowStartMs,
      windowEndMs,
      participants,
      granularityMinutes: 15
    });

    const normalizeView = (view = {}) => ({
      availableCount: Number.isFinite(view.availableCount) ? view.availableCount : 0,
      busyCount: Number.isFinite(view.busyCount) ? view.busyCount : 0,
      totalCount: Number.isFinite(view.totalCount) ? view.totalCount : participants.length,
      availabilityFraction: Number.isFinite(view.availabilityFraction) ? view.availabilityFraction : 0
    });

    const formattedBlocks = blocks.map((block) => {
      const strictView = normalizeView(block.views && block.views.StrictView ? block.views.StrictView : {});
      const flexibleView = normalizeView(block.views && block.views.FlexibleView ? block.views.FlexibleView : {});
      const lenientView = normalizeView(block.views && block.views.LenientView ? block.views.LenientView : {});

      return {
        start: new Date(block.startMs).toISOString(),
        end: new Date(block.endMs).toISOString(),
        count: strictView.availableCount,
        availabilityFraction: strictView.availabilityFraction,
        totalCount: strictView.totalCount,
        views: {
          StrictView: strictView,
          FlexibleView: flexibleView,
          LenientView: lenientView
        }
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
