import React, { useState, useEffect } from 'react';
import { apiGet } from '../../api'; // Adjust path based on your folder structure
import '../../css/calendar.css';

// --- HELPER LOGIC (The "Business Logic" or Model Helpers) ---
function getStartOfWeek(date) {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

export default function CustomCalendar({ groupId, draftEvent }) {
  // --- STATE (The "Controller" Data) ---
  const [weekStart, setWeekStart] = useState(getStartOfWeek(new Date()));
  const [rawEvents, setRawEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [groupAvailability, setGroupAvailability] = useState([]);

  // const renderCount = useRef(0);
  // renderCount.current++;
  // console.log("Render #", renderCount.current, "rawEvents length:", rawEvents.length);

  // --- EFFECT 1: Fetch Personal Events ---

  useEffect(() => {
    const fetchPersonalEvents = async () => {
      setLoading(true);
      try {
        try {
          await apiGet('/api/events');
        } catch (syncErr) {
          console.error("Failed syncing events:", syncErr);
        }
        const personalEvents = await apiGet('/api/get-events');
        if (Array.isArray(personalEvents)) {
            setRawEvents(personalEvents);
          }
          else if (personalEvents && personalEvents.error) {
            console.warn("Backend rejected token:", personalEvents.error);
            setRawEvents([]);
            window.location.href = '/login'; // IDK
          }
          else {
            console.warn("Unexpected data format for personal events recieved from api/events", personalEvents);
            setRawEvents([]);
          }
      } catch (error) {
        console.error('Failed to fetch personal events:', error);
        setRawEvents([]);
      } finally {
        setLoading(false);
      }
    };
    
    fetchPersonalEvents();
  }, [weekStart]); 

  // --- EFFECT 2: Fetch Group Availability ---

  useEffect(() => {
    const fetchGroupEvents = async () => {
      // If the user clicked "Hide", groupId will be null.
      // We just clear the state and exit early. No network call needed.
      if (!groupId || groupId === 0) {
        setGroupAvailability([]);
        return; 
      }

      setLoading(true);
      try {
        const startMs = weekStart.getTime();
        const ONEWEEK_MS = 7 * 24 * 60 * 60 * 1000;
        const endMs = startMs + ONEWEEK_MS;

        const response = await apiGet(`/api/groups/${groupId}/availability?windowStartMs=${startMs}&windowEndMs=${endMs}&granularityMinutes=15`);
        
        const availabilityBlocks = Array.isArray(response?.availability)
          ? response.availability
          : Array.isArray(response?.blocks)
            ? response.blocks
            : null;

        if (response && response.ok && response.blocks) {
          // 2. Disguise the availability blocks as standard events for your UI
          const heatmapEvents = response.blocks.map((block, i) => ({
            title: `Avail: ${block.count}`,
            availLvl: block.count,
            start: block.start,
            end: block.end,
            event_id: `avail-${i}`,
            mode: 'avail'
          }));

          const consolidatedEvents = mergeAvailabilityBlocks(heatmapEvents);
          const finalHeatmapEvents = consolidatedEvents.map((event, i) => ({ 
            ...event,
            event_id: `avail-merged-${i}`
          }));

          setGroupAvailability(finalHeatmapEvents);
        } else {
          // Default: Fetch personal events
          const personalEvents = await apiGet('/api/get-events');
          setRawEvents(personalEvents || []);
          setGroupAvailability([]); // Clear if response is bad
        }
      } catch (error) {
        console.error('Failed to fetch group availability:', error);
        setGroupAvailability([]);
      } finally {
        setLoading(false);
      }
    };
    
    fetchGroupEvents();
  }, [groupId, weekStart]);

  const handlePrevWeek = () => {
    const newDate = new Date(weekStart);
    newDate.setDate(newDate.getDate() - 7);
    setWeekStart(newDate);
  };

  const handleNextWeek = () => {
    const newDate = new Date(weekStart);
    newDate.setDate(newDate.getDate() + 7);
    setWeekStart(newDate);
  };

  const finalRawEvents = [...rawEvents];

  if (draftEvent) {
      finalRawEvents.push({ ...draftEvent });
  }

  // --- PREPARING THE VIEW ---
  const events = processEvents(finalRawEvents);
  const groupEvents = processEvents(groupAvailability);
  const allEvents = events.concat(groupEvents);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });
  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <div id="calendar-container">
      {/* 1. CALENDAR HEADER (Navigation) */}
      <div className="calendar-header">
        <button onClick={handlePrevWeek}>← Prev</button>
        <h2>
          {weekStart.toLocaleString("default", { month: "long", year: "numeric" })}
        </h2>
        <button onClick={handleNextWeek}>Next →</button>
      </div>

      {/* 2. CALENDAR GRID (View) */}
      <div className="calendar-grid">
        <div className="corner-cell"></div>
        {days.map((day, i) => (
          <div key={i} className="day-header">
            {day.toLocaleDateString("default", { weekday: "short", month: "numeric", day: "numeric" })}
          </div>
        ))}

        {hours.map(hour => (
          <React.Fragment key={hour}>
            <div className="time-label">
              {`${hour === 0 || hour === 12 ? 12 : hour % 12}:00${hour < 12 ? 'am' : 'pm'}`}
            </div>

            {days.map((day, i) => (
              <div key={i} className="calendar-cell">
                {allEvents
                  .filter(e => e.start.toDateString() === day.toDateString() && e.start.getHours() === hour)
                  .map((event, idx) => {
                    // --- hides 0 avail events
                    if (event.mode == 'avail' && event.availLvl === 0) {
                      // Don't render 0-availability blocks, they just add clutter
                      return null;
                    }

                    const startMins = event.start.getMinutes();
                    const duration = (event.end - event.start) / (1000 * 60);

                    // precise visual logic
                    // each grid line (hour) subtracts 2px to height, so add duration/30
                    let visualHeight = (duration / 30) + duration - 10; // -10 to add padding between events 
                    const endsOnHour = event.end.getMinutes() === 0 && event.end.getSeconds() === 0;
                    if (!event.isEndOfDay && !endsOnHour) visualHeight -= 2;

                    let backgroundColor;
                    let opacity;
                    let zIndex;
                    switch (event.mode) {
                      case 'petition':
                        backgroundColor = '#ffa963';
                        opacity = 0.6;
                        zIndex = 2;
                        break;
                      case 'blocking':
                        backgroundColor = '#34333c';
                        opacity = 0.6;
                        zIndex = 2;
                        break;
                      case 'avail':
                        // backgroundColor = '#2ecc71';
                        const calculatedLightness = Math.max(35, 90 - (event.availLvl * 12));
                        backgroundColor = `hsl(145, 65%, ${calculatedLightness}%)`;
                        opacity = 0.5;
                        zIndex = 4
                        break;
                      default:
                        backgroundColor = '#6395ee';
                        opacity = 1;
                        zIndex = 3;
                    }
                    return (
                      <div
                        key={idx}
                        className={`calendar-event ${event.isAllDay ? 'all-day-event' : ''}`}
                        style={{
                          height: `${Math.max(1, visualHeight)}px`,
                          top: `${startMins}px`,
                          opacity: event.isAllDay ? 0.6 : opacity,
                          zIndex: event.isAllDay ? 1 :zIndex,
                          backgroundColor: backgroundColor,
                          border: event.isPreview ? '2px dashed #333' : 'none'
                          
                        }}
                      >
                        {event.title}
                      </div>
                    );
                  })}
              </div>
            ))}
          </React.Fragment>
        ))}
      </div>
      {loading && <p>Loading events...</p>}
    </div>
  );
}

// --- KEEP YOUR PROCESSING FUNCTIONS OUTSIDE THE COMPONENT ---
// This keeps the "Business Logic" separate from the "View"
function processEvents(rawEvents) {
  if (!Array.isArray(rawEvents)) return [];
  console.log("in the processing events function");
  const processed = [];
  rawEvents.forEach(event => {
    let start = parseLocal(event.start);
    let end = parseLocal(event.end);
    if (end <= start) return;

    let current = new Date(start);
    while (current < end) {
      const nextDayStart = new Date(current);
      nextDayStart.setDate(nextDayStart.getDate() + 1);
      nextDayStart.setHours(0, 0, 0, 0);
      let effectiveEnd = (end < nextDayStart) ? end : nextDayStart;

      processed.push({
        title: event.title,
        start: new Date(current),
        end: new Date(effectiveEnd),
        id: event.event_id,
        isAllDay: (effectiveEnd - current) >= 24 * 60 * 60 * 1000,
        isEndOfDay: effectiveEnd.getTime() === nextDayStart.getTime(),
        isPreview: event.isPreview || false,
        availLvl: event.availLvl || 0, // for group availability heatmap
        mode: event.mode || 'normal', // 'normal', 'blocking', 'petition', 'avail'
        // isAvail: event.isAvail || false
      });
      current = nextDayStart;
    }
  });
  return processed;
}

function parseLocal(dateInput) {
  if (typeof dateInput === 'string' && dateInput.length === 10) {
    const [y, m, d] = dateInput.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(dateInput);
}


function mergeAvailabilityBlocks(blocks) {
  if (!blocks || blocks.length === 0) return [];

  // 1. Sort blocks chronologically by start time just to be safe
  const sortedBlocks = [...blocks].sort((a, b) => {
    const timeA = new Date(a.start).getTime();
    const timeB = new Date(b.start).getTime();
    return timeA - timeB; // if negative sort a before b; if positive sort b before a; if 0, keep original order
  });

  const merged = [];
  let currentBlock = { ...sortedBlocks[0] };

  for (let i = 1; i < sortedBlocks.length; i++) {
    const nextBlock = sortedBlocks[i];
    
    const currentEndMs = new Date(currentBlock.end).getTime();
    const nextStartMs = new Date(nextBlock.start).getTime();

    // 2. Check if they are back-to-back (or overlapping) AND have the same availability count
    if (currentEndMs >= nextStartMs && currentBlock.availLvl === nextBlock.availLvl) {
      // 3. Extend the current block's end time
      const nextEndMs = new Date(nextBlock.end).getTime();
      currentBlock.end = new Date(Math.max(currentEndMs, nextEndMs));
    } else {
      // 4. No match, push the current block and start a new one
      merged.push(currentBlock);
      currentBlock = { ...nextBlock };
    }
  }
  
  // Push the very last block
  merged.push(currentBlock);

  return merged;
}