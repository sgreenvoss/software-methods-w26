// --- calendarUtils.js ---

/*
This file contains the "Business Logic". 
These are pure JavaScript functions 
that crunch dates and numbers
*/

import { BLOCKING_LEVELS, AVAILABILITY_MIN_OPACITY, AVAILABILITY_MAX_OPACITY, DAY_MS } from './calendarConstants';

// Takes a Date object and rewinds it to the Sunday of that specific week at exactly 12:00 AM
export function getStartOfWeek(date) {
  const d = new Date(date);
  // getDay() returns 0 for Sunday, 1 for Monday, etc. 
  // Subtracting that number from the current date shifts us back to Sunday.
  d.setDate(d.getDate() - d.getDay());
  // Reset hours, minutes, seconds, and milliseconds to zero
  d.setHours(0, 0, 0, 0);
  return d;
}

// Checks if the user is currently viewing the present week
export function isCurrentWeek(date) {
  const today = new Date();
  const currWeekStart = getStartOfWeek(today);
  // Compare the raw millisecond timestamps of the two Sundays
  return date.getTime() === currWeekStart.getTime();
}

// Checks if two Date objects fall on the exact same calendar day
export function isSameLocalDay(left, right) {
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();
}

// Generates the human-readable text for the top of the calendar (e.g., "March 2 - 8, 2026")
export function formatWeekRange(start, end) {
  // Guard clause: If dates are invalid, return an empty string
  if (!Number.isFinite(start?.getTime?.()) || !Number.isFinite(end?.getTime?.())) return '';

  const startMonth = start.toLocaleString('default', { month: 'long' });
  const endMonth = end.toLocaleString('default', { month: 'long' });
  const startDay = start.getDate();
  const endDay = end.getDate();
  const startYear = start.getFullYear();
  const endYear = end.getFullYear();

  // Boolean flags to determine how to format the string
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  const sameYear = start.getFullYear() === end.getFullYear();

  // "March 2 - 8, 2026"
  if (sameMonth) return `${startMonth} ${startDay} - ${endDay}, ${startYear}`;
  // "Feb 28 - March 6, 2026"
  if (sameYear) return `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${startYear}`;
  // "Dec 28, 2025 - Jan 3, 2026"
  return `${startMonth} ${startDay}, ${startYear} - ${endMonth} ${endDay}, ${endYear}`;
}

// Generates an HSL (Hue, Saturation, Lightness) green color that gets darker as availability goes up
export function getAvailabilityColor(availableCount, maxVisibleCount) {
  // If no one is free, make it completely invisible
  if (availableCount <= 0) return 'transparent';
  // If the group only has 1 person, use a hardcoded standard green
  if (maxVisibleCount <= 1) return 'hsl(145, 78%, 42%)';

  // Calculate 't', a ratio from 0.0 to 1.0 representing how full the group is
  const t = (availableCount - 1) / (maxVisibleCount - 1);
  // Interpolate Saturation: ranges from 60% (dull) to 78% (vibrant)
  const saturation = 60 + (18 * t);
  // Interpolate Lightness: ranges from 84% (light) to 42% (dark)
  const lightness = 84 - (42 * t);
  
  return `hsl(145, ${saturation}%, ${lightness}%)`;
}

// Determines how see-through the green block should be based on availability
export function getAvailabilityOpacity(availableCount, maxVisibleCount) {
  if (availableCount <= 0) return 0;
  if (maxVisibleCount <= 1) return AVAILABILITY_MAX_OPACITY;
  // Use the same 't' ratio to scale the opacity smoothly between the min and max constants
  const t = (availableCount - 1) / (maxVisibleCount - 1);
  return AVAILABILITY_MIN_OPACITY + ((AVAILABILITY_MAX_OPACITY - AVAILABILITY_MIN_OPACITY) * t);
}

// Simple grammar formatter for the hover tooltip
export function formatAvailabilityTooltip(count) {
  return count === 1 ? '1 person available' : `${count} people available`;
}

// Determines if an event spans across midnight into the next day
export function spansMultipleLocalDays(start, end) {
  if (!Number.isFinite(start?.getTime?.()) || !Number.isFinite(end?.getTime?.()) || end <= start) return false;
  // Subtract 1 millisecond from the end time so an event ending exactly at 12:00 AM isn't counted as an extra day
  const inclusiveEnd = new Date(end.getTime() - 1);
  return start.getFullYear() !== inclusiveEnd.getFullYear()
    || start.getMonth() !== inclusiveEnd.getMonth()
    || start.getDate() !== inclusiveEnd.getDate();
}

// Flag to visually fade out all-day or multi-day events so they don't block the screen
export function shouldDeEmphasizeEventSegment(event) {
  return event?.mode !== 'avail' && (event?.isAllDay || event?.spansMultipleDays);
}

// Regex check to see if a string is strictly "YYYY-MM-DD"
export function isDateOnlyText(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

// Checks if a date object is exactly 12:00:00.000 AM
export function isLocalMidnight(date) {
  return Number.isFinite(date?.getTime?.()) && date.getHours() === 0 && date.getMinutes() === 0 && date.getSeconds() === 0 && date.getMilliseconds() === 0;
}

// Converts a date into an absolute number of days since the Unix Epoch
export function getLocalCalendarDayNumber(date) {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS;
}

// Checks if an event perfectly covers 1 or more full days (12am to 12am)
export function isWholeLocalDayRange(start, end) {
  if (!Number.isFinite(start?.getTime?.()) || !Number.isFinite(end?.getTime?.()) || end <= start) return false;
  return isLocalMidnight(start) && isLocalMidnight(end) && getLocalCalendarDayNumber(end) > getLocalCalendarDayNumber(start);
}

// Safely extracts the availability numbers based on whether the user selected Strict, Flexible, etc.
export function getViewStatsFromBlock(block, viewKey) {
  if (!block || typeof block !== 'object') return { availableCount: 0, totalCount: 0 };
  
  const strictView = block?.views?.StrictView;
  const selectedView = block?.views?.[viewKey];
  
  // Try to get the selected view, fallback to strict, fallback to the base block count, fallback to 0
  const availableCount = Number.isFinite(selectedView?.availableCount) ? selectedView.availableCount
    : Number.isFinite(strictView?.availableCount) ? strictView.availableCount
    : Number.isFinite(block?.count) ? block.count : 0;
    
  // Do the exact same fallback chain for the total count of group members
  const totalCount = Number.isFinite(selectedView?.totalCount) ? selectedView.totalCount
    : Number.isFinite(strictView?.totalCount) ? strictView.totalCount
    : Number.isFinite(block?.totalCount) ? block.totalCount : 0;
    
  return { availableCount, totalCount };
}

// Standardizes database integers (1, 2, 3) into the B1, B2, B3 format
export function normalizeBlockingLevelFromEvent(event) {
  const rawLevel = typeof event?.blockingLevel === 'string' ? event.blockingLevel.trim().toUpperCase() : '';
  if ([BLOCKING_LEVELS.B1, BLOCKING_LEVELS.B2, BLOCKING_LEVELS.B3].includes(rawLevel)) return rawLevel;
  const rawPriority = Number(event?.priority);
  if (rawPriority === 1) return BLOCKING_LEVELS.B1;
  if (rawPriority === 2) return BLOCKING_LEVELS.B2;
  return BLOCKING_LEVELS.B3; // Default to hardest block if unknown
}

// Logic deciding if a personal event should physically render on top of the green heatmap
export function shouldRenderRegularEventAboveAvailability(view, blockingLevel) {
  if (view === 'StrictView') return true; // In strict view, ALL personal events cover the heatmap
  if (view === 'FlexibleView') return blockingLevel === BLOCKING_LEVELS.B2 || blockingLevel === BLOCKING_LEVELS.B3;
  return blockingLevel === BLOCKING_LEVELS.B3; // In lenient view, only Hard Blocks cover the heatmap
}

// Converts a string "YYYY-MM-DD" into a local 12:00 AM Date object
export function parseLocalDateOnly(dateInput) {
  if (typeof dateInput === 'string' && dateInput.length === 10) {
    const [y, m, d] = dateInput.split('-').map(Number);
    return new Date(y, m - 1, d); // Month is 0-indexed in JS
  }
  return new Date(NaN);
}

// Ensures input is converted to a Date object
export function parseEventInstant(dateInput) {
  return new Date(dateInput);
}

// Strips the time off an ISO string, returning just the date
export function formatUtcDateOnly(dateInput) {
  const parsed = parseEventInstant(dateInput);
  if (!Number.isFinite(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
}

// Unifies how dates are handled, regardless of whether they are full timestamps or just string dates
export function normalizeEventRange(event) {
  const hasDateOnlyInputs = isDateOnlyText(event?.start) && isDateOnlyText(event?.end);
  
  if (event?.isAllDay || hasDateOnlyInputs) {
    const startDateText = event.allDayStartDate || (hasDateOnlyInputs ? event.start : formatUtcDateOnly(event.start));
    const endDateText = event.allDayEndDate || (hasDateOnlyInputs ? event.end : formatUtcDateOnly(event.end));
    const start = parseLocalDateOnly(startDateText);
    const end = parseLocalDateOnly(endDateText);
    return { start, end, isAllDay: true, spansMultipleDays: spansMultipleLocalDays(start, end) };
  }
  
  const start = parseEventInstant(event?.start);
  const end = parseEventInstant(event?.end);
  return { start, end, isAllDay: isWholeLocalDayRange(start, end), spansMultipleDays: spansMultipleLocalDays(start, end) };
}

// THE MOST IMPORTANT FUNCTION: Chops multi-day events into individual blocks exactly at midnight
export function processEvents(rawEvents) {
  if (!Array.isArray(rawEvents)) return [];
  const processed = [];
  
  rawEvents.forEach(event => {
    const normalizedRange = normalizeEventRange(event);
    let start = normalizedRange.start;
    let end = normalizedRange.end;
    
    // Skip totally broken events
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) return;

    let current = new Date(start);
    
    // Loop through the duration of the event
    while (current < end) {
      // Find exactly 12:00 AM of the next calendar day
      const nextDayStart = new Date(current);
      nextDayStart.setDate(nextDayStart.getDate() + 1);
      nextDayStart.setHours(0, 0, 0, 0);
      
      // If the event ends before midnight, use the real end time. Otherwise, chop it at midnight.
      let effectiveEnd = (end < nextDayStart) ? end : nextDayStart;

      processed.push({
        ...event, // Copy over all the raw backend fields (petition statuses, colors, etc.)
        start: new Date(current), // Start time for THIS specific day's visual block
        end: new Date(effectiveEnd), // End time for THIS specific day's visual block
        id: event.event_id,
        isAllDay: normalizedRange.isAllDay,
        spansMultipleDays: normalizedRange.spansMultipleDays,
        isEndOfDay: effectiveEnd.getTime() === nextDayStart.getTime(),
        mode: event.mode || 'normal',
      });
      
      // Move the loop pointer to 12:00 AM the next day to process the rest of the event
      current = nextDayStart;
    }
  });
  return processed;
}

// Optimizes the heatmap by merging adjacent 15-minute blocks that have the exact same availability score
export function mergeAvailabilityBlocks(blocks) {
  if (!blocks || blocks.length === 0) return [];
  
  // Sort them chronologically just in case the backend scrambled them
  const sortedBlocks = [...blocks].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  const merged = [];
  
  // Start with the first block
  let currentBlock = { ...sortedBlocks[0] };

  // Loop through the rest
  for (let i = 1; i < sortedBlocks.length; i++) {
    const nextBlock = sortedBlocks[i];
    const currentEndMs = new Date(currentBlock.end).getTime();
    const nextStartMs = new Date(nextBlock.start).getTime();

    // If they touch AND have the exact same number of available people...
    if (currentEndMs >= nextStartMs && currentBlock.availLvl === nextBlock.availLvl) {
      // ...stretch the current block's end time to swallow the next block
      const nextEndMs = new Date(nextBlock.end).getTime();
      currentBlock.end = new Date(Math.max(currentEndMs, nextEndMs));
    } else {
      // Otherwise, save the current block and start tracking the new one
      merged.push(currentBlock);
      currentBlock = { ...nextBlock };
    }
  }
  
  // Save the very last block in the array
  merged.push(currentBlock);
  return merged;
}

// Translates a backend database Petition row into an object our calendar UI understands
export function mapPetitionToCalendarEvent(petition, activeGroupId, weekStart) {
  if (!petition) return null;
  
  // Extract IDs safely accounting for different casing
  const petitionGroupId = Number(petition.group_id ?? petition.groupId);
  const petitionId = Number(petition.petition_id ?? petition.petitionId ?? petition.id);
  
  // Extract Dates safely
  const startValue = petition.start_time ?? petition.start ?? petition.startMs;
  const endValue = petition.end_time ?? petition.end ?? petition.endMs;
  const startDate = typeof startValue === 'number' ? new Date(startValue) : new Date(Date.parse(startValue));
  const endDate = typeof endValue === 'number' ? new Date(endValue) : new Date(Date.parse(endValue));
  
  const startMs = startDate.getTime();
  const endMs = endDate.getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return null;

  // Filter out petitions that belong to a different group than the user is currently viewing
  if (activeGroupId && Number(activeGroupId) !== petitionGroupId) return null;

  // Filter out petitions that are totally outside the 7-day week we are currently looking at
  const weekStartMs = weekStart.getTime();
  const weekEndMs = weekStartMs + (7 * 24 * 60 * 60 * 1000);
  if (endMs <= weekStartMs || startMs >= weekEndMs) return null;

  // Grab the voting stats
  const acceptedCount = Number(petition.accepted_count ?? petition.acceptedCount ?? 0);
  const declinedCount = Number(petition.declined_count ?? petition.declinedCount ?? 0);
  const groupSize = Number(petition.group_size ?? petition.groupSize ?? 0);

  // Compute the status based on votes
  const status = declinedCount > 0 ? 'FAILED' : (groupSize > 0 && acceptedCount === groupSize) ? 'ACCEPTED_ALL' : 'OPEN';
  const titleRaw = petition.title || 'Petition';

  return {
    ...petition,
    event_id: `petition-${petitionId}`, // Create a fake event ID so React can map it
    mode: 'petition',
    petitionId,
    groupId: petitionGroupId,
    title: titleRaw,
    titleRaw,
    start: startValue,
    end: endValue,
    status,
  };
}