// --- CalendarEventBlock.jsx ---

/*
  This component calculates exactly where 
  an event should sit on the screen. 
  It uses percentages so that if a 
  user opens the app on an iPhone or 
  drags their desktop window smaller, 
  the events scale perfectly with the grid.
*/

import React from 'react';
import { COLORS, DEEMPHASIZED_EVENT_OPACITY } from './calendarConstants';
import { 
  getAvailabilityColor, 
  getAvailabilityOpacity, 
  normalizeBlockingLevelFromEvent, 
  shouldRenderRegularEventAboveAvailability, 
  shouldDeEmphasizeEventSegment 
} from './calendarUtils';

export default function CalendarEventBlock({ 
  event, 
  legendMaxCount, 
  effectiveAvailabilityView, 
  onEventClick, 
  onTooltipEnter, 
  onTooltipLeave 
}) {
  // If this is a heatmap block where literally nobody is available, don't even render a DOM element.
  if (event.mode === 'avail' && event.availLvl === 0) return null;

  // --- THE CLOCK-FACE MATH (Fixes the DST Bug) ---
  const startHour = event.start.getHours();
  const startMins = event.start.getMinutes();
  
  let endHour = event.end.getHours();
  let endMins = event.end.getMinutes();

  // If the event spans perfectly to midnight, force the math to use 24:00
  // This guarantees a full 24-hour block even on Daylight Saving Time days
  if (event.isEndOfDay) {
    endHour = 24;
    endMins = 0;
  }

  // Calculate duration entirely based on the clock hands, ignoring elapsed milliseconds
  const durationMins = ((endHour - startHour) * 60) + (endMins - startMins);
  
  // Calculate percentage from top
  const topPercent = (startMins / 60) * 100;
  
  // Calculate height as a percentage of the parent grid cell.
  // add 2px for the grid border thickness for each hour except the first hour
  const heightPercent = `calc(${(durationMins / 60) * 100}% + 
                              ${(durationMins / 60) * 2 - 2}px)`;

  // --- VISUAL STYLING LOGIC ---
  // Default fallbacks
  let backgroundColor = COLORS.NORMAL;
  let textColor = undefined;
  let opacity = 1;
  let zIndex = 2; // Default z-index puts personal events ABOVE the grid but BELOW petitions
  let petitionClass = '';

  if (event.mode === 'petition') {
    // Petition specific styling
    if (event.status === 'FAILED') {
      backgroundColor = '#9ea3a8'; 
      textColor = '#1f1f1f'; 
      opacity = 0.72; 
      petitionClass = 'petition-failed';
    } else if (event.status === 'ACCEPTED_ALL') {
      backgroundColor = '#ffa963'; 
      textColor = '#ffffff'; 
      opacity = 1; 
      petitionClass = 'petition-accepted-all';
    } else {
      backgroundColor = '#f4d35e'; 
      textColor = '#1f1f1f'; 
      opacity = 0.72; 
      petitionClass = 'petition-open';
    }
    // Petitions ALWAYS render on top of everything else
    zIndex = 4;
    
  } else if (event.mode === 'avail') {
    // Heatmap specific styling
    backgroundColor = getAvailabilityColor(event.availLvl, legendMaxCount);
    opacity = getAvailabilityOpacity(event.availLvl, legendMaxCount);
    // Heatmap sits between personal events and petitions
    zIndex = 3;
    
  } else {
    // Normal / Blocking Events
    const normalizedBlockingLevel = normalizeBlockingLevelFromEvent(event);
    
    // Check if this personal event is a Hard Block that needs to cover up the green heatmap
    const isAboveAvailability = shouldRenderRegularEventAboveAvailability(effectiveAvailabilityView, normalizedBlockingLevel);
    
    // If it is, bump it to z-index 4. Otherwise, leave it at 2 (under the heatmap).
    zIndex = isAboveAvailability ? 4 : 2;
    opacity = event.mode === 'blocking' ? 0.6 : 1;
    
    // Assign color based on backend data, or fall back to constants
    backgroundColor = event.backgroundColor || event.color || (event.mode === 'blocking' ? COLORS.BLOCKING : COLORS.NORMAL);
    textColor = event.backgroundColor && event.color ? event.color : undefined;
  }

  // Override color if it's a manually created event that hasn't synced with Google yet
  if (!event.isPreview && typeof event.id === 'string' && event.id.startsWith('manual-')) {
    backgroundColor = COLORS.MANUAL;
  }

  // --- DE-EMPHASIS LOGIC ---
  // If it's a multi-day event, fade it out so the calendar isn't completely colored in
  const shouldDeEmphasize = shouldDeEmphasizeEventSegment(event);
  const finalOpacity = shouldDeEmphasize ? Math.min(opacity, DEEMPHASIZED_EVENT_OPACITY) : opacity;
  // Push de-emphasized events to the absolute bottom z-index layer
  const finalZIndex = shouldDeEmphasize ? 1 : zIndex;

  // Add a dashed border if it's a drag-and-drop preview
  const borderStyle = event.isPreview ? '2px dashed #333' : (event.borderColor ? `1px solid ${event.borderColor}` : 'none');
  
  // Only standard events can be clicked to open the EventClickModal
  const isRegularEventClickable = event.mode !== 'avail' && event.mode !== 'petition' && !event.isPreview;

  // Compile all CSS classes into one string
  const combinedClassName = [
    'calendar-event',
    event.isAllDay ? 'all-day-event' : '',
    event.mode === 'petition' ? `petition-event ${petitionClass}` : '',
    event.className || ''
  ].filter(Boolean).join(' ');

  return (
    <div
      className={combinedClassName}
      // Attach click handler if applicable
      onClick={(event.mode === 'petition' || isRegularEventClickable) ? () => onEventClick(event) : undefined}
      // Attach hover handlers if it's a heatmap block (for the tooltip)
      onMouseEnter={event.mode === 'avail' ? (e) => onTooltipEnter(e, event.availLvl) : undefined}
      onMouseMove={event.mode === 'avail' ? (e) => onTooltipEnter(e, event.availLvl) : undefined}
      onMouseLeave={event.mode === 'avail' ? onTooltipLeave : undefined}
      style={{
        top: `${topPercent}%`,
        height: heightPercent,
        opacity: finalOpacity,
        zIndex: finalZIndex,
        backgroundColor,
        color: textColor,
        border: borderStyle,
        // Change mouse pointer to hand icon if clickable
        cursor: (event.mode === 'petition' || isRegularEventClickable) ? 'pointer' : 'default'
      }}
    >
      {/* Do not render titles on the green heatmap blocks, it clutters the UI */}
      {event.mode === 'avail' ? null : (event.titleRaw || event.title)}
    </div>
  );
}