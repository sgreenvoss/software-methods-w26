import { refreshCalendarCache, getCachedEvents } from '../services/calendarCache.service.js';

export async function refreshEvents(req, res, next) {
  try {
    const { windowStartMs, windowEndMs, force, personId } = req.query;
    const tokens = req.session.tokens;

    if (!tokens) {
      return res.status(401).json({ error: 'Missing OAuth tokens. Authenticate via /auth/start first.' });
    }

    const result = await refreshCalendarCache({
      tokens,
      windowStartMs,
      windowEndMs,
      force: force === 'true',
      personId: personId ? Number(personId) : null,
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getEvents(req, res, next) {
  try {
    const { windowStartMs, windowEndMs, personId } = req.query;
    const data = await getCachedEvents({
      windowStartMs: Number(windowStartMs),
      windowEndMs: Number(windowEndMs),
      personId: personId ? Number(personId) : null,
    });

    res.json(data);
  } catch (err) {
    next(err);
  }
}
