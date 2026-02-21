const availabilityService = require('./availability_service');

const availabilityController = {
  async getAvailability(req, res) {
    // 1. Auth Check
    if (!req.session.userId) {
      return res.status(401).json({ ok: false, message: "Unauthorized" });
    }

    try {
      const { groupId } = req.params;

      // 2. Extract the correct keys from the URL (req.query)
      // These must match the frontend: windowStartMs and windowEndMs
      const { windowStartMs, windowEndMs } = req.query;

      // 3. Convert to Numbers and pass to Service
      // If windowStartMs is missing, Number(undefined) is NaN, which triggers your 400
      const start = Number(windowStartMs);
      const end = Number(windowEndMs);

      if (isNaN(start) || isNaN(end)) {
        return res.status(400).json({ 
          ok: false, 
          error: "Invalid or missing timestamps (windowStartMs/windowEndMs)" 
        });
      }

      const data = await availabilityService.getGroupAvailability(
        groupId,
        start,
        end
      );

      res.json({ ok: true, ...data });

    } catch (err) {
      console.error(`[AvailabilityController] Error: ${err.message}`);
      const statusCode = err.status || 500;
      res.status(statusCode).json({ ok: false, error: err.message });
    }
  }
};

module.exports = availabilityController;