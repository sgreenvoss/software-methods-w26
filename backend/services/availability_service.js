/*
File: availability_service.js
Purpose: Builds the availability payload for the group heatmap route.
    This file fetches participants, runs the algorithm, and formats the response.
*/

const { fetchAndMapGroupEvents } = require('../algorithm/algorithm_adapter.js');
const { computeAvailabilityBlocksAllViews } = require('../algorithm/algorithm.js');
const db = require('../db/dbInterface.js');

const availabilityService = {
  
  async getGroupAvailability(groupId, windowStartMs, windowEndMs) {
    // Validate the time window before touching the database or the algorithm.
    if (!windowStartMs || !windowEndMs || windowEndMs <= windowStartMs) {
      const err = new Error("Invalid time window: end must be after start.");
      err.status = 400; // Return a client error when the request window is invalid.
      throw err;
    }

    // Fetch and map the raw group events into the algorithm snapshot format.
    const participants = await fetchAndMapGroupEvents(db, groupId, windowStartMs, windowEndMs);

    // Treat empty groups as a clean 404 instead of feeding bad input into the algorithm.
    if (!participants || participants.length === 0) {
      const err = new Error("No members found for this group.");
      err.status = 404;
      throw err;
    }

    // Let the pure algorithm module compute every availability view in one pass.
    const blocks = computeAvailabilityBlocksAllViews({
      windowStartMs,
      windowEndMs,
      participants,
      granularityMinutes: 15
    });

    // Normalize missing counts so the frontend always gets the same response shape.
    const normalizeView = (view = {}) => ({
      availableCount: Number.isFinite(view.availableCount) ? view.availableCount : 0,
      busyCount: Number.isFinite(view.busyCount) ? view.busyCount : 0,
      totalCount: Number.isFinite(view.totalCount) ? view.totalCount : participants.length,
      availabilityFraction: Number.isFinite(view.availabilityFraction) ? view.availabilityFraction : 0
    });

    // Keep the legacy strict-view fields while adding the richer multi-view payload.
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
    // Return the fully formatted payload to the controller.
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
