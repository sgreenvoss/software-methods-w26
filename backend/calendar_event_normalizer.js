/*
File: calendar_event_normalizer.js
Purpose: Normalizes calendar events before they go back to the frontend.
    This keeps all-day metadata consistent for Google events and manual events.
Date Created: 2026-03-07
Initial Author(s): David Haddad

System Context:
Ensures consistency of calendar events between systems so that both
manual and Google calendar events can be handled more easily by other
modules.
*/

const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Converts a supported boundary value into a valid Date instance.
 *
 * @param {Date|number|string|*} value - Candidate date/time input
 * @returns {Date|null} Parsed Date clone/object, or null when invalid
 */
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

/**
 * Checks whether a value is a YYYY-MM-DD date-only string.
 *
 * @param {*} value - Input value to test
 * @returns {boolean} True when value matches date-only pattern
 */
function isDateOnlyString(value) {
  return typeof value === 'string' && DATE_ONLY_PATTERN.test(value);
}

/**
 * Determines whether a Date falls exactly at UTC midnight.
 *
 * @param {Date} date - Date object to evaluate
 * @returns {boolean} True when timestamp is at 00:00:00.000Z
 */
function isUtcMidnight(date) {
  return date.toISOString().endsWith('T00:00:00.000Z');
}

/**
 * Determines whether start/end span one or more exact whole UTC days.
 *
 * @param {Date} start - Start boundary date
 * @param {Date} end - End boundary date
 * @returns {boolean} True when duration is positive and evenly divisible by one day
 */
function isWholeDaySpan(start, end) {
  const spanMs = end.getTime() - start.getTime();
  return spanMs > 0 && spanMs % DAY_MS === 0;
}

/**
 * Formats a Date as `YYYY-MM-DD` using UTC components.
 *
 * @param {Date} date - Date to format
 * @returns {string} UTC date-only string
 */
function formatUtcDateOnly(date) {
  return date.toISOString().slice(0, 10);
}

/**
 * Serializes event boundary value back into API-friendly representation.
 * Prefers parsed Date output but preserves raw string shape when parsing fails.
 *
 * @param {Date|number|string|*} value - Original boundary value
 * @param {Date|null} parsedDate - Parsed Date counterpart when available
 * @returns {string|null} Serialized boundary string or null when unsupported
 */
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

/**
 * Derives normalized all-day metadata from event start/end boundaries.
 * Treats explicit date-only ranges and stored midnight-to-midnight UTC ranges as all-day.
 *
 * @param {Date|number|string|*} startValue - Raw start boundary value
 * @param {Date|number|string|*} endValue - Raw end boundary value
 * @returns {{start: Date|null, end: Date|null, isAllDay: boolean, allDayStartDate?: string, allDayEndDate?: string}} Parsed boundaries and all-day metadata
 */
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

/**
 * Normalizes one calendar event shape for frontend consumption.
 * Adds canonical `isAllDay` and optional all-day date fields while serializing boundaries.
 *
 * @param {Object} event - Event object containing at least start/end boundaries
 * @returns {Object} Normalized event object with serialized boundaries and all-day metadata
 */
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
