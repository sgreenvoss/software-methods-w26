import { buildAvailability } from '../services/availability.service.js';

export async function getAvailability(req, res, next) {
  try {
    const { windowStartMs, windowEndMs, granularityMinutes } = req.query;

    const data = await buildAvailability({
      windowStartMs: Number(windowStartMs),
      windowEndMs: Number(windowEndMs),
      granularityMinutes: granularityMinutes ? Number(granularityMinutes) : undefined,
    });

    res.json(data);
  } catch (err) {
    next(err);
  }
}
