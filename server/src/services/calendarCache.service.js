import { getOrCreateCalendar } from '../models/calendar.model.js';
import { deleteEventsInWindow, insertEvents, getEventsOverlappingWindow } from '../models/cal_event.model.js';
import { getSyncMeta, upsertSyncMeta } from '../models/calendar_sync_meta.model.js';
import { listEventsInWindow } from './googleCalendar.service.js';

const DEFAULT_WINDOW_DAYS = 7;
const DEFAULT_MIN_REFRESH_INTERVAL_MS = 5 * 60 * 1000;
const DEFAULT_CACHE_TTL_MS = 10 * 60 * 1000;

function toEpochMs(value) {
  const ms = Number(value);
  return Number.isFinite(ms) ? ms : null;
}

function toIso(ms) {
  return new Date(ms).toISOString();
}

function mapGoogleEventsToDb(events) {
  return events
    .map((event) => {
      const start = event.start?.dateTime || event.start?.date;
      const end = event.end?.dateTime || event.end?.date;
      const startMs = Date.parse(start);
      const endMs = Date.parse(end);
      if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return null;
      return {
        eventStart: new Date(startMs),
        eventDurationHours: (endMs - startMs) / (60 * 60 * 1000),
        priority: 0,
      };
    })
    .filter(Boolean);
}

export async function refreshCalendarCache({ tokens, windowStartMs, windowEndMs, force = false, personId = null }) {
  const now = Date.now();
  const startMs = toEpochMs(windowStartMs) ?? now;
  const endMs = toEpochMs(windowEndMs) ?? now + DEFAULT_WINDOW_DAYS * 24 * 60 * 60 * 1000;

  const calendar = await getOrCreateCalendar('primary', 'Primary', personId);
  const meta = await getSyncMeta(calendar.calendar_id);

  const minIntervalMs = Number(process.env.MIN_REFRESH_INTERVAL_MS) || DEFAULT_MIN_REFRESH_INTERVAL_MS;
  if (!force && meta?.last_refreshed) {
    const last = new Date(meta.last_refreshed).getTime();
    if (Number.isFinite(last) && now - last < minIntervalMs) {
      return {
        ok: true,
        skipped: true,
        reason: 'refresh_cooldown',
        meta: buildMeta(meta),
      };
    }
  }

  try {
    const events = await listEventsInWindow(tokens, toIso(startMs), toIso(endMs));
    const dbEvents = mapGoogleEventsToDb(events);

    await deleteEventsInWindow(calendar.calendar_id, new Date(startMs), new Date(endMs));
    await insertEvents(calendar.calendar_id, dbEvents);

    const updatedMeta = await upsertSyncMeta({
      calendarId: calendar.calendar_id,
      lastRefreshed: new Date(now),
      lastError: null,
      syncToken: null,
    });

    return {
      ok: true,
      skipped: false,
      inserted: dbEvents.length,
      meta: buildMeta(updatedMeta),
    };
  } catch (err) {
    const updatedMeta = await upsertSyncMeta({
      calendarId: calendar.calendar_id,
      lastRefreshed: meta?.last_refreshed || null,
      lastError: err.message || 'refresh_failed',
      syncToken: meta?.sync_token || null,
    });

    return {
      ok: false,
      skipped: false,
      error: err.message || 'refresh_failed',
      meta: buildMeta(updatedMeta),
    };
  }
}

export async function getCachedEvents({ windowStartMs, windowEndMs, personId = null }) {
  const startMs = toEpochMs(windowStartMs);
  const endMs = toEpochMs(windowEndMs);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    throw new Error('windowStartMs and windowEndMs are required (epoch ms).');
  }

  const calendar = await getOrCreateCalendar('primary', 'Primary', personId);
  const events = await getEventsOverlappingWindow(
    calendar.calendar_id,
    new Date(startMs),
    new Date(endMs)
  );
  const meta = await getSyncMeta(calendar.calendar_id);

  return { events, meta: buildMeta(meta) };
}

export function buildMeta(meta) {
  const ttlMs = Number(process.env.CACHE_TTL_MS) || DEFAULT_CACHE_TTL_MS;
  const lastRefreshed = meta?.last_refreshed ? new Date(meta.last_refreshed).toISOString() : null;
  const lastError = meta?.last_error || null;
  const stale = !lastRefreshed
    ? true
    : Date.now() - new Date(lastRefreshed).getTime() > ttlMs;

  return { lastRefreshed, lastError, stale, ttlMs };
}
