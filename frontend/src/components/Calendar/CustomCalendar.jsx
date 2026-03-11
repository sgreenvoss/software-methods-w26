/*
  The Orchestrator. 
  It fetches the data, merges it together, 
  and maps over it to render the UI grid. 
  By moving all the logic out to 
  calendarUtils.js, this file is strictly 
  focused on React State and the DOM.
*/

// --- CustomCalendar.jsx ---
import React, { useState, useEffect, useRef, useContext } from 'react';
import { createPortal } from 'react-dom';
import { apiGet } from '../../api';
import PetitionActionModal from '../Petitions/PetitionActionModal';
import { ErrorContext } from '../../ErrorContext';
import '../../css/calendar.css';

// Import our modular tools
import { AVAILABILITY_VIEWS, DEFAULT_GROUP_VIEW, FALLBACK_VIEW, AVAILABILITY_VIEW_LABELS } from './calendarConstants';
import { 
  getStartOfWeek, isCurrentWeek, formatWeekRange, isSameLocalDay, 
  formatAvailabilityTooltip, getViewStatsFromBlock, processEvents, 
  mergeAvailabilityBlocks, mapPetitionToCalendarEvent, getAvailabilityColor, 
  getAvailabilityOpacity, filterAvailabilityAgainstPersonalEvents
} from './calendarUtils';

import CalendarEventBlock from './CalendarEventBlock';
import EventClickModal from './EventClickModal';

export default function CustomCalendar({ refreshTrigger, groupId, draftEvent, onCellClick, onDraftDrop }) {
  // --- APPLICATION STATE ---
  const [weekStart, setWeekStart] = useState(getStartOfWeek(new Date()));
  const [rawEvents, setRawEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [rawAvailabilityBlocks, setRawAvailabilityBlocks] = useState([]);
  const [availabilityViewByGroup, setAvailabilityViewByGroup] = useState({});
  const [availabilityTooltip, setAvailabilityTooltip] = useState(null);
  
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [visiblePetitions, setVisiblePetitions] = useState([]);
  const [selectedPetition, setSelectedPetition] = useState(null);
  const [isPetitionModalOpen, setIsPetitionModalOpen] = useState(false);
  const [petitionActionRefreshKey, setPetitionActionRefreshKey] = useState(0);
  
  const [currentUserId, setCurrentUserId] = useState(null);
  const { setError } = useContext(ErrorContext);
  
  // Used to prevent race-conditions if the user clicks between groups rapidly
  const latestAvailabilityRequestRef = useRef(0);

  // Derive simple constants from state
  const petitionDraftActive = draftEvent?.mode === 'petition';
  const selectedGroupKey = groupId == null ? null : String(groupId);
  const selectedAvailabilityView = selectedGroupKey
    ? (availabilityViewByGroup[selectedGroupKey] || DEFAULT_GROUP_VIEW)
    : DEFAULT_GROUP_VIEW;

  // --- API DATA FETCHING ---

  // Helper to specifically refetch personal events after a manual DB change
  const refreshPersonalEvents = async () => {
    const personalEvents = await apiGet('/api/get-events');
    if (Array.isArray(personalEvents)) setRawEvents(personalEvents);
  };

  // EFFECT 1: Fetch Personal Events on load, or when the week/refreshTrigger changes
  useEffect(() => {
    const fetchPersonalEvents = async () => {
      setLoading(true);
      try {
        const personalEvents = await apiGet('/api/get-events');
        if (Array.isArray(personalEvents)) {
            setRawEvents(personalEvents);
        } else if (personalEvents && personalEvents.error) {
            window.location.href = '/login'; 
        }
      } catch (error) {
        setRawEvents([]);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };
    fetchPersonalEvents();
  }, [weekStart, refreshTrigger]); 

  // EFFECT 2: Fetch Group Heatmap Data when a group is selected
  useEffect(() => {
    let isCancelled = false; // Flag for cleanup

    const fetchGroupEvents = async () => {
      // If no group is selected, wipe the heatmap and exit
      if (!groupId || groupId === 0) {
        latestAvailabilityRequestRef.current += 1;
        setRawAvailabilityBlocks([]);
        setLoading(false);
        return; 
      }

      // Track request ID to ignore stale responses
      const requestId = latestAvailabilityRequestRef.current + 1;
      latestAvailabilityRequestRef.current = requestId;

      setLoading(true);
      try {
        const startMs = weekStart.getTime();
        const endMs = startMs + (7 * 24 * 60 * 60 * 1000); // 1 week later

        // Fetch data based on a 15-minute granularity algorithm
        const response = await apiGet(`/api/groups/${groupId}/availability?windowStartMs=${startMs}&windowEndMs=${endMs}&granularityMinutes=15`);
        
        const availabilityBlocks = Array.isArray(response?.availability) ? response.availability 
          : Array.isArray(response?.blocks) ? response.blocks : null;

        if (isCancelled || latestAvailabilityRequestRef.current !== requestId) return;

        if (response && response.ok && Array.isArray(availabilityBlocks)) {
          setRawAvailabilityBlocks(availabilityBlocks);
        } else {
          setRawAvailabilityBlocks([]);
        }
      } catch (error) {
        if (isCancelled || latestAvailabilityRequestRef.current !== requestId) return;
        setRawAvailabilityBlocks([]);
        setError(error.message);
      } finally {
        if (!isCancelled && latestAvailabilityRequestRef.current === requestId) {
          setLoading(false);
        }
      }
    };
    fetchGroupEvents();
    
    // Cleanup function runs if the component unmounts or dependencies change mid-fetch
    return () => { isCancelled = true; };
  }, [refreshTrigger, groupId, weekStart]);

  // EFFECT 3: Fetch Current User details for Petitions
  useEffect(() => {
    apiGet('/api/me')
      .then(res => setCurrentUserId(res?.user?.user_id ? Number(res.user.user_id) : null))
      .catch(() => setCurrentUserId(null));
  }, []);

  // EFFECT 4: Fetch Petitions 
  useEffect(() => {
    const fetchVisiblePetitions = async() => {
      // If looking at a group, fetch just that group's petitions. Otherwise, fetch all.
      const endpoint = groupId ? `/api/groups/${groupId}/petitions` : '/api/petitions';

      try {
        const response = await apiGet(endpoint);
        if (!Array.isArray(response)) {
          setVisiblePetitions([]);
          return;
        }
        // Run the DB response through our mapper utility
        const mappedPetitions = response.map((p) => mapPetitionToCalendarEvent(p, groupId, weekStart)).filter(Boolean);
        setVisiblePetitions(mappedPetitions);
      } catch (error) {
        setVisiblePetitions([]);
        setError(error.message);
      }
    };
    fetchVisiblePetitions();
  }, [groupId, weekStart, petitionActionRefreshKey, petitionDraftActive, refreshTrigger]);

  // --- EVENT HANDLERS ---
  
  const handleAvailabilityViewChange = (viewKey) => {
    if (!selectedGroupKey || !AVAILABILITY_VIEWS.includes(viewKey)) return;
    setAvailabilityViewByGroup((currentMap) => ({ ...currentMap, [selectedGroupKey]: viewKey }));
  };

  const handleEventClick = (event) => {
    if (event.mode === 'petition') {
      setSelectedPetition(event);
      setIsPetitionModalOpen(true);
    } else {
      setSelectedEvent(event);
    }
  };

  const handleNextWeek = () => setWeekStart(new Date(weekStart.setDate(weekStart.getDate() + 7)));
  const handlePrevWeek = () => setWeekStart(new Date(weekStart.setDate(weekStart.getDate() - 7)));

  // --- DATA PROCESSING FOR RENDER ---
  
  // Inject the draft event (drag-and-drop preview) into the raw array if it exists
  const finalRawEvents = [...rawEvents];
  if (draftEvent) finalRawEvents.push({ ...draftEvent });

  const hasMultiViewAvailability = rawAvailabilityBlocks.some(
    b => b && typeof b.views === 'object' && b.views !== null
  );
  const effectiveAvailabilityView = hasMultiViewAvailability && AVAILABILITY_VIEWS.includes(selectedAvailabilityView)
    ? selectedAvailabilityView : FALLBACK_VIEW;

  // 1. Process the raw backend blocks
  const rawProjectedAvailability = (groupId ? rawAvailabilityBlocks : []).map((block, i) => {
    const { availableCount } = getViewStatsFromBlock(block, effectiveAvailabilityView);
    return { title: '', availLvl: availableCount, start: block.start, end: block.end, event_id: `avail-${i}`, mode: 'avail' };
  });

  // 2. Filter the backend blocks against the user's personal calendar
  const projectedAvailability = filterAvailabilityAgainstPersonalEvents(
      rawProjectedAvailability, 
      rawEvents, 
      effectiveAvailabilityView
  );

  // Merge adjacent 15-minute blocks for DOM performance
  const consolidatedAvailability = mergeAvailabilityBlocks(projectedAvailability);
  const groupAvailability = consolidatedAvailability.map((event, i) => ({ ...event, event_id: `avail-merged-${i}` }));

  // Find the absolute highest availability count to scale the legend colors
  const availabilityLegendMeta = (groupId ? rawAvailabilityBlocks : []).reduce((meta, block) => {
    const { availableCount, totalCount } = getViewStatsFromBlock(block, effectiveAvailabilityView);
    if (availableCount > meta.maxVisibleCount) meta.maxVisibleCount = availableCount;
    if (totalCount > meta.maxTotalCount) meta.maxTotalCount = totalCount;
    return meta;
  }, { maxVisibleCount: 0, maxTotalCount: 0 });

  let legendMaxCount = availabilityLegendMeta.maxVisibleCount;
  if (availabilityLegendMeta.maxTotalCount > 0) {
    legendMaxCount = Math.min(legendMaxCount, availabilityLegendMeta.maxTotalCount);
  }
  
  const legendCounts = legendMaxCount > 0 ? Array.from({ length: legendMaxCount }, (_, idx) => idx + 1) : [];

  // Finally, run all arrays through the core date processor to handle midnight splits
  const allEvents = processEvents(finalRawEvents).concat(processEvents(groupAvailability), processEvents(visiblePetitions));

  // Build the array of 7 days for the column headers
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });
  // Build the array of 24 hours for the row labels
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const today = new Date();
  const weekRangeLabel = formatWeekRange(days[0], days[days.length - 1]);

  // --- RENDER ---
  return (
    <div id="calendar-container">
      
      {/* 1. CALENDAR HERO (Navigation & Controls) */}
      <div className="calendar-hero">
        <div className="calendar-header">
          <button className="calendar-nav-btn" onClick={handlePrevWeek} disabled={isCurrentWeek(weekStart)}>← Prev</button>
          <div className="calendar-title-block">
            <h2 className="calendar-month-title">{weekStart.toLocaleString("default", { month: "long", year: "numeric" })}</h2>
            <p className="calendar-week-range">{weekRangeLabel}</p>
          </div>
          <button className="calendar-nav-btn" onClick={handleNextWeek}>Next →</button>
        </div>

        {groupId ? (
          <div className="availability-controls">
            
            {/* View Toggle Buttons */}
            <div className="availability-view-toggle">
              {AVAILABILITY_VIEWS.map((viewKey) => {
                const isActive = effectiveAvailabilityView === viewKey;
                const isDisabled = !hasMultiViewAvailability && viewKey !== FALLBACK_VIEW;
                return (
                  <button
                    key={viewKey}
                    type="button"
                    aria-pressed={isActive}
                    disabled={isDisabled}
                    onClick={() => handleAvailabilityViewChange(viewKey)}
                    className={`availability-view-btn ${isActive ? 'availability-view-btn-active' : ''}`}
                  >
                    {AVAILABILITY_VIEW_LABELS[viewKey]}
                  </button>
                );
              })}
            </div>

            {/* Dynamic Legend */}
            <div className="availability-legend">
              <span className="availability-legend-label">Available people</span>
              <div className="availability-legend-swatches">
                {legendCounts.map((count) => (
                  <span key={count} className="availability-legend-item">
                    <span
                      className="availability-legend-swatch"
                      style={{
                        backgroundColor: getAvailabilityColor(count, legendMaxCount),
                        opacity: getAvailabilityOpacity(count, legendMaxCount)
                      }}
                    />
                    <span className="availability-legend-count">{count}</span>
                  </span>
                ))}
              </div>
              <span className="availability-legend-note">Empty = no availability</span>
            </div>
          </div>
        ) : null}
      </div>

      {/* 2. CALENDAR GRID SHELL (The scrollable container) */}
      <div className="calendar-grid-shell">
        <div className="calendar-grid">
          
          {/* Top-Left empty sticky corner */}
          <div className="corner-cell"></div>
          
          {/* Top sticky column headers (Mon, Tue, Wed...) */}
          {days.map((day, i) => (
            <div key={i} className={`day-header${isSameLocalDay(day, today) ? ' is-today' : ''}`}>
              {day.toLocaleDateString("default", { weekday: "short", month: "numeric", day: "numeric" })}
            </div>
          ))}

          {/* Render the 24 rows */}
          {hours.map(hour => (
            <React.Fragment key={hour}>
              
              {/* Left sticky row label (1am, 2am, 3am...) */}
              <div className="time-label">
                {`${hour === 0 || hour === 12 ? 12 : hour % 12}:00${hour < 12 ? 'am' : 'pm'}`}
              </div>

              {/* Render the 7 cells for this specific hour row */}
              {days.map((day, i) => (
                <div 
                  key={i} 
                  className={`calendar-cell${isSameLocalDay(day, today) ? ' is-today' : ''}`}
                  // Fire the handler when the empty cell is clicked
                  onClick={() => onCellClick && onCellClick(day, hour, 'blocking')}
                    
                  // Allow things to be dropped here
                  onDragOver={(e) => e.preventDefault()} 
                  
                  // Handle the math when the draft block is dropped
                  onDrop={(e) => {
                    e.preventDefault();
                    
                    try {
                    // 1. Get the JSON payload (trying both formats)
                    const transferData = e.dataTransfer.getData('application/json') || e.dataTransfer.getData('text/plain');
                    if (!transferData) return;
                    
                    const data = JSON.parse(transferData);
                    
                    // Verify this is our draft block
                    if (data.type === 'draft' && onDraftDrop) {
                        const rect = e.currentTarget.getBoundingClientRect();
                        
                        // 2. Find where the mouse is relative to the top of THIS specific hour cell
                        const mousePixelY = e.clientY - rect.top;
                        
                        // 3. Subtract the user's drag offset to find where the TOP of the event actually is
                        const actualEventTopPixelY = mousePixelY - data.offsetY;
                        
                        // 4. Convert to a percentage. 
                        // Note: This might be negative if the top of the event is in the cell above the mouse!
                        const percent = actualEventTopPixelY / rect.height;
                        
                        // 5. Convert to minutes and snap to 15-minute intervals
                        const exactMinute = percent * 60;
                        const snappedMinute = Math.round(exactMinute / 15) * 15;
                        
                        // 6. Send it back to Main.jsx
                        onDraftDrop(day, hour, snappedMinute);
                    }
                    } catch (err) {
                      console.error("Failed to parse drag-and-drop data:", err);
                    }
                }}
                >
        
                  
                  {/* Filter allEvents to find events that belong exactly in this Day AND Hour cell */}
                  {allEvents
                    .filter(e => e.start.toDateString() === day.toDateString() && e.start.getHours() === hour)
                    .map((event, idx) => (
                      <CalendarEventBlock
                        key={idx}
                        event={event}
                        legendMaxCount={legendMaxCount}
                        effectiveAvailabilityView={effectiveAvailabilityView}
                        onEventClick={handleEventClick}

                        onCellClick={(overrideDay, overrideHour) => 
                          onCellClick && onCellClick(overrideDay || day, overrideHour ?? hour, 'petition')
                        }

                        onTooltipEnter={(mouseEvent, count) => setAvailabilityTooltip({ count, x: mouseEvent.clientX + 12, y: mouseEvent.clientY + 10 })}
                        onTooltipLeave={() => setAvailabilityTooltip(null)}
                      />
                    ))}
                </div>
              ))}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* 3. MODALS AND PORTALS */}
      
      {/* Tooltip Portal (renders outside the DOM flow so it doesn't get cut off by overflow:hidden containers) */}
      {availabilityTooltip && typeof document !== 'undefined' ? createPortal(
        <div
          className="availability-tooltip"
          style={{ left: `${availabilityTooltip.x}px`, top: `${availabilityTooltip.y}px` }}
        >
          {formatAvailabilityTooltip(availabilityTooltip.count)}
        </div>, document.body
      ) : null}

      {/* Standard Event Click Modal */}
      {selectedEvent && (
        <EventClickModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onRefresh={refreshPersonalEvents}
        />
      )}
      
      {/* Petition Action Modal */}
      <PetitionActionModal
        open={isPetitionModalOpen}
        petition={selectedPetition}
        currentUserId={currentUserId}
        onClose={() => { setIsPetitionModalOpen(false); setSelectedPetition(null); }}
        onActionComplete={() => { setIsPetitionModalOpen(false); setSelectedPetition(null); setPetitionActionRefreshKey(v => v + 1); }}
      />
    </div>
  );
}