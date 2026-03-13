/*
File: calendar_event_normalizer.js
Purpose: Normalizes calendar events before they go back to the frontend.
    This keeps all-day metadata consistent for Google events and manual events.
*/

const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function toDate(value) {
  // Copy Date inputs so later normalization never mutates the caller's value.
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? new Date(value.getTime()) : null;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const parsed = new Date(value);
    return Number.isFinite(parsed.getTime()) ? parsed : null;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = new Date(value);
    return Number.isFinite(parsed.getTime()) ? parsed : null;
  }

  return null;
}

function isDateOnlyString(value) {
  return typeof value === 'string' && DATE_ONLY_PATTERN.test(value);
}

function isUtcMidnight(date) {
  return date.toISOString().endsWith('T00:00:00.000Z');
}

function isWholeDaySpan(start, end) {
  const spanMs = end.getTime() - start.getTime();
  return spanMs > 0 && spanMs % DAY_MS === 0;
}

function formatUtcDateOnly(date) {
  return date.toISOString().slice(0, 10);
}

function serializeBoundary(value, parsedDate) {
  // Preserve the original shape when parsing fails so callers keep the raw value.
  if (parsedDate) {
    return parsedDate.toISOString();
  }

  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value.toISOString() : null;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value).toISOString();
  }

  if (typeof value === 'string') {
    return value;
  }

  return null;
}

function deriveAllDayMetadata(startValue, endValue) {
  // Treat both explicit date-only ranges and midnight-to-midnight UTC spans as all-day.
  const start = toDate(startValue);
  const end = toDate(endValue);

  if (!start || !end || end.getTime() <= start.getTime()) {
    return {
      start,
      end,
      isAllDay: false
    };
  }

  const isDateOnlyRange = isDateOnlyString(startValue) && isDateOnlyString(endValue);
  const isStoredWholeDayRange =
    isUtcMidnight(start) &&
    isUtcMidnight(end) &&
    isWholeDaySpan(start, end);

  if (!isDateOnlyRange && !isStoredWholeDayRange) {
    return {
      start,
      end,
      isAllDay: false
    };
  }

  return {
    start,
    end,
    isAllDay: true,
    allDayStartDate: formatUtcDateOnly(start),
    allDayEndDate: formatUtcDateOnly(end)
  };
}

function normalizeCalendarEvent(event) {
  // Copy the event and add the normalized all-day fields the calendar UI expects.
  const metadata = deriveAllDayMetadata(event?.start, event?.end);
  const normalized = {
    ...event,
    start: serializeBoundary(event?.start, metadata.start),
    end: serializeBoundary(event?.end, metadata.end),
    isAllDay: metadata.isAllDay
  };

  if (metadata.isAllDay) {
    normalized.allDayStartDate = metadata.allDayStartDate;
    normalized.allDayEndDate = metadata.allDayEndDate;
  }

  return normalized;
}

module.exports = {
  DAY_MS,
  deriveAllDayMetadata,
  normalizeCalendarEvent
};
