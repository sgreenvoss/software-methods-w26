import React, { useState, useEffect } from 'react';
import { apiGet } from '../../api'; // Adjust path based on your folder structure
import PetitionActionModal from '../Petitions/PetitionActionModal';
import '../../css/calendar.css';

const AVAILABILITY_VIEWS = ['StrictView', 'FlexibleView', 'LenientView'];
const DEFAULT_GROUP_VIEW = 'FlexibleView';
const BLOCKING_LEVELS = Object.freeze({
  B1: 'B1',
  B2: 'B2',
  B3: 'B3'
});

// --- HELPER LOGIC (The "Business Logic" or Model Helpers) ---
function getStartOfWeek(date) {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

// check if user is on present week
function isCurrentWeek(date) {
  const today = new Date();
  const currWeekStart = getStartOfWeek(today);
  return date.getTime() === currWeekStart.getTime();
}

function normalizeBlockingLevelFromEvent(event) {
  const rawLevel = typeof event?.blockingLevel === 'string'
    ? event.blockingLevel.trim().toUpperCase()
    : '';
  if (rawLevel === BLOCKING_LEVELS.B1 || rawLevel === BLOCKING_LEVELS.B2 || rawLevel === BLOCKING_LEVELS.B3) {
    return rawLevel;
  }

  const rawPriority = Number(event?.priority);
  if (rawPriority === 1) return BLOCKING_LEVELS.B1;
  if (rawPriority === 2) return BLOCKING_LEVELS.B2;
  return BLOCKING_LEVELS.B3;
}

function shouldRenderRegularEventAboveAvailability(view, blockingLevel) {
  if (view === 'StrictView') return true;
  if (view === 'FlexibleView') return blockingLevel === BLOCKING_LEVELS.B2 || blockingLevel === BLOCKING_LEVELS.B3;
  return blockingLevel === BLOCKING_LEVELS.B3;
}

function mapPetitionToCalendarEvent(petition, activeGroupId, weekStart) {
  if (!petition) return null;

  const petitionGroupId = Number(petition.group_id ?? petition.groupId);
  const petitionId = Number(petition.petition_id ?? petition.petitionId ?? petition.id);

  const startValue = petition.start_time ?? petition.start ?? petition.startMs;
  const endValue = petition.end_time ?? petition.end ?? petition.endMs;
  const startDate = typeof startValue === 'number'
    ? new Date(startValue)
    : new Date(Date.parse(startValue));
  const endDate = typeof endValue === 'number'
    ? new Date(endValue)
    : new Date(Date.parse(endValue));

  const startMs = startDate.getTime();
  const endMs = endDate.getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return null;

  if (activeGroupId && Number(activeGroupId) !== petitionGroupId) {
    return null;
  }

  const weekStartMs = weekStart.getTime();
  const weekEndMs = weekStartMs + (7 * 24 * 60 * 60 * 1000);
  if (endMs <= weekStartMs || startMs >= weekEndMs) {
    return null;
  }

  const acceptedCount = Number(petition.accepted_count ?? petition.acceptedCount ?? 0);
  const declinedCount = Number(petition.declined_count ?? petition.declinedCount ?? 0);
  const groupSize = Number(petition.group_size ?? petition.groupSize ?? 0);

  const computedStatus =
    declinedCount > 0
      ? 'FAILED'
      : (groupSize > 0 && acceptedCount === groupSize)
        ? 'ACCEPTED_ALL'
        : 'OPEN';
  const status = typeof petition.status === 'string' && petition.status.trim()
    ? petition.status
    : computedStatus;
  const titleRaw = petition.title || 'Petition';

  return {
    event_id: `petition-${petitionId}`,
    mode: 'petition',
    petitionId,
    groupId: petitionGroupId,
    createdByUserId: Number(petition.created_by_user_id ?? petition.createdByUserId ?? null),
    title: titleRaw,
    titleRaw,
    start: petition.start_time ?? petition.start ?? petition.startMs,
    end: petition.end_time ?? petition.end ?? petition.endMs,
    start_time: petition.start_time ?? petition.start ?? petition.startMs,
    end_time: petition.end_time ?? petition.end ?? petition.endMs,
    acceptedCount,
    declinedCount,
    groupSize,
    currentUserResponse: petition.current_user_response ?? petition.currentUserResponse ?? null,
    status,
    groupName: petition.group_name ?? petition.groupName ?? '',
    is_creator: typeof petition.is_creator === 'boolean' ? petition.is_creator : null,
    isCreator: typeof petition.is_creator === 'boolean' ? petition.is_creator : null
  };
}


export default function CustomCalendar({ groupId, draftEvent }) {
  // --- STATE (The "Controller" Data) ---
  const [weekStart, setWeekStart] = useState(getStartOfWeek(new Date()));
  const [rawEvents, setRawEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rawAvailabilityBlocks, setRawAvailabilityBlocks] = useState([]);
  const [availabilityViewByGroup, setAvailabilityViewByGroup] = useState({});
  const [visiblePetitions, setVisiblePetitions] = useState([]);
  const [selectedPetition, setSelectedPetition] = useState(null);
  const [isPetitionModalOpen, setIsPetitionModalOpen] = useState(false);
  const [petitionActionRefreshKey, setPetitionActionRefreshKey] = useState(0);
  const [currentUserId, setCurrentUserId] = useState(null);
  const petitionDraftActive = draftEvent?.mode === 'petition';
  const selectedGroupKey = groupId == null ? null : String(groupId);
  // TEAMNOTE[availability-modes]: Remember each group's in-session mode; first view defaults to FlexibleView.
  const availabilityView = selectedGroupKey
    ? (availabilityViewByGroup[selectedGroupKey] || DEFAULT_GROUP_VIEW)
    : DEFAULT_GROUP_VIEW;

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
      // TEAMNOTE[availability-persistence]: Clearing availability here is only for explicit group hide (groupId null), not sidebar/modal toggles.
      if (!groupId || groupId === 0) {
        setRawAvailabilityBlocks([]);
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

        if (response && response.ok && Array.isArray(availabilityBlocks)) {
          setRawAvailabilityBlocks(availabilityBlocks);
          return;
        }

        setRawAvailabilityBlocks([]);
      } catch (error) {
        console.error('Failed to fetch group availability:', error);
        setRawAvailabilityBlocks([]);
      } finally {
        setLoading(false);
      }
    };
    
    fetchGroupEvents();
  }, [groupId, weekStart]);

  useEffect(() => {
    const fetchCurrentUser = async() => {
      try {
        const response = await apiGet('/api/me');
        const userId = response?.user?.user_id;
        setCurrentUserId(userId != null ? Number(userId) : null);
      } catch (error) {
        console.error('Failed to load current user for petition actions:', error);
        setCurrentUserId(null);
      }
    };

    fetchCurrentUser();
  }, []);

  useEffect(() => {
    const fetchVisiblePetitions = async() => {
      const endpoint = groupId ? `/api/groups/${groupId}/petitions` : '/api/petitions';

      try {
        const response = await apiGet(endpoint);
        if (!Array.isArray(response)) {
          setVisiblePetitions([]);
          return;
        }

        const mappedPetitions = response
          .map((petition) => mapPetitionToCalendarEvent(petition, groupId, weekStart))
          .filter(Boolean);

        setVisiblePetitions(mappedPetitions);
      } catch (error) {
        console.error('Failed to fetch petitions:', error);
        setVisiblePetitions([]);
      }
    };

    fetchVisiblePetitions();
  }, [groupId, weekStart, petitionActionRefreshKey, petitionDraftActive]);

  const handleAvailabilityViewChange = (nextView) => {
    if (!selectedGroupKey || !AVAILABILITY_VIEWS.includes(nextView)) {
      return;
    }

    setAvailabilityViewByGroup((currentMap) => ({
      ...currentMap,
      // TEAMNOTE[availability-modes]: Persist the selected mode per group for this session only.
      [selectedGroupKey]: nextView
    }));
  };

  const handlePetitionClick = (petitionEvent) => {
    setSelectedPetition(petitionEvent);
    setIsPetitionModalOpen(true);
  };

  const handleClosePetitionModal = () => {
    setIsPetitionModalOpen(false);
    setSelectedPetition(null);
  };

  const handlePetitionActionComplete = () => {
    setIsPetitionModalOpen(false);
    setSelectedPetition(null);
    setPetitionActionRefreshKey((v) => v + 1);
  };

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

  // TEAMNOTE[availability-modes]: Mode switching reprojects already-fetched blocks and must not trigger a refetch.
  const projectedAvailability = (groupId ? rawAvailabilityBlocks : []).map((block, i) => {
    const strictCount = Number.isFinite(block?.count) ? block.count : 0;
    const strictView = block?.views?.StrictView;
    const selectedView = block?.views?.[availabilityView];
    const selectedCount = Number.isFinite(selectedView?.availableCount)
      ? selectedView.availableCount
      : Number.isFinite(strictView?.availableCount)
        ? strictView.availableCount
        : strictCount;

    return {
      title: `Avail: ${selectedCount}`,
      availLvl: selectedCount,
      start: block.start,
      end: block.end,
      event_id: `avail-${i}`,
      mode: 'avail'
    };
  });

  const consolidatedAvailability = mergeAvailabilityBlocks(projectedAvailability);
  const groupAvailability = consolidatedAvailability.map((event, i) => ({
    ...event,
    event_id: `avail-merged-${i}`
  }));

  // --- PREPARING THE VIEW ---
  const events = processEvents(finalRawEvents);
  const groupEvents = processEvents(groupAvailability);
  const petitionEvents = processEvents(visiblePetitions);
  const allEvents = events.concat(groupEvents, petitionEvents);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });
  const hours = Array.from({ length: 24 }, (_, i) => i);

  const getPetitionStatusClass = (event) => {
    if (event.mode !== 'petition') return '';

    switch (event.status) {
      case 'FAILED':
        return 'petition-failed';
      case 'ACCEPTED_ALL':
        return 'petition-accepted-all';
      default:
        return 'petition-open';
    }
  };

  const getDisplayTitle = (event) => {
    if (event.mode !== 'petition') {
      return event.title;
    }

    const baseTitle = event.titleRaw || event.title || 'Petition';
    if (groupId) {
      return baseTitle;
    }

    const groupLabel = event.groupName || (event.groupId ? `Group ${event.groupId}` : '');
    return groupLabel ? `${groupLabel}: ${baseTitle}` : baseTitle;
  };

  return (
    <div id="calendar-container">
      {/* 1. CALENDAR HEADER (Navigation) */}
      <div className="calendar-header">
        <button onClick={handlePrevWeek} disabled={isCurrentWeek(weekStart)}>← Prev</button>
        <h2>
          {weekStart.toLocaleString("default", { month: "long", year: "numeric" })}
        </h2>
        <button onClick={handleNextWeek}>Next →</button>
      </div>

      {groupId ? (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
          {AVAILABILITY_VIEWS.map((viewKey) => {
            const shortLabel = viewKey.replace('View', '');
            const isActive = availabilityView === viewKey;
            return (
              <button
                key={viewKey}
                type="button"
                aria-pressed={isActive}
                onClick={() => handleAvailabilityViewChange(viewKey)}
                style={{
                  padding: '6px 10px',
                  fontWeight: isActive ? 700 : 500,
                  background: isActive ? '#d9f99d' : '#f3f4f6',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
              >
                {shortLabel}
              </button>
            );
          })}
        </div>
      ) : null}

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
                    if (event.mode === 'avail' && event.availLvl === 0) {
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
                    let textColor;
                    let opacity;
                    let zIndex;

                    if (event.mode === 'petition') {
                      backgroundColor = '#ffa963';
                      opacity = 0.6;
                      zIndex = 5;
                    } else if (event.mode === 'avail') {
                      const calculatedLightness = Math.max(35, 90 - (event.availLvl * 12));
                      backgroundColor = `hsl(145, 65%, ${calculatedLightness}%)`;
                      opacity = 0.5;
                      zIndex = 3;
                    } else {
                      const normalizedBlockingLevel = normalizeBlockingLevelFromEvent(event);
                      const isAboveAvailability = shouldRenderRegularEventAboveAvailability(availabilityView, normalizedBlockingLevel);
                      zIndex = isAboveAvailability ? 4 : 2;
                      opacity = event.mode === 'blocking' ? 0.6 : 1;

                      // TEAMNOTE[availability-modes]: Selected mode determines whether regular events layer above or below availability.
                      backgroundColor = event.backgroundColor
                        || (typeof event.color === 'string' ? event.color : null)
                        || (event.mode === 'blocking' ? '#34333c' : '#6395ee');
                      // TEAMNOTE[availability-modes]: Preserve event-provided style fields and only fallback when absent.
                      textColor = event.backgroundColor && typeof event.color === 'string' ? event.color : undefined;
                    }

                    const borderStyle = event.isPreview
                      ? '2px dashed #333'
                      : (typeof event.borderColor === 'string' && event.borderColor ? `1px solid ${event.borderColor}` : 'none');
                    const combinedClassName = [
                      'calendar-event',
                      event.isAllDay ? 'all-day-event' : '',
                      event.mode === 'petition' ? `petition-event ${getPetitionStatusClass(event)}` : '',
                      event.className || ''
                    ].filter(Boolean).join(' ');
                    return (
                      <div
                        key={idx}
                        className={combinedClassName}
                        onClick={event.mode === 'petition' ? () => handlePetitionClick(event) : undefined}
                        style={{
                          height: `${Math.max(1, visualHeight)}px`,
                          top: `${startMins}px`,
                          opacity: event.isAllDay ? 0.6 : opacity,
                          zIndex: event.isAllDay ? 1 :zIndex,
                          backgroundColor: backgroundColor,
                          color: textColor,
                          border: borderStyle,
                          cursor: event.mode === 'petition' ? 'pointer' : 'default'
                          
                        }}
                      >
                        {getDisplayTitle(event)}
                      </div>
                    );
                  })}
              </div>
            ))}
          </React.Fragment>
        ))}
      </div>
      {loading && <p>Loading events...</p>}
      <PetitionActionModal
        open={isPetitionModalOpen}
        petition={selectedPetition}
        currentUserId={currentUserId}
        onClose={handleClosePetitionModal}
        onActionComplete={handlePetitionActionComplete}
      />
    </div>
  );
}

// --- KEEP YOUR PROCESSING FUNCTIONS OUTSIDE THE COMPONENT ---
// This keeps the "Business Logic" separate from the "View"
function processEvents(rawEvents) {
  if (!Array.isArray(rawEvents)) return [];
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
        ...event,
        // TEAMNOTE[availability-modes]: Preserve event metadata so rendering/layering can use priority and custom styles.
        title: event.title,
        start: new Date(current),
        end: new Date(effectiveEnd),
        id: event.event_id,
        event_id: event.event_id,
        isAllDay: (effectiveEnd - current) >= 24 * 60 * 60 * 1000,
        isEndOfDay: effectiveEnd.getTime() === nextDayStart.getTime(),
        isPreview: event.isPreview || false,
        availLvl: event.availLvl || 0, // for group availability heatmap
        mode: event.mode || 'normal', // 'normal', 'blocking', 'petition', 'avail'
        petitionId: event.petitionId ?? null,
        groupId: event.groupId ?? null,
        createdByUserId: event.createdByUserId ?? null,
        titleRaw: event.titleRaw ?? event.title,
        start_time: event.start_time ?? event.start,
        end_time: event.end_time ?? event.end,
        acceptedCount: event.acceptedCount ?? 0,
        declinedCount: event.declinedCount ?? 0,
        groupSize: event.groupSize ?? 0,
        currentUserResponse: event.currentUserResponse ?? null,
        status: event.status ?? null,
        groupName: event.groupName ?? '',
        is_creator: typeof event.is_creator === 'boolean' ? event.is_creator : null,
        isCreator: typeof event.isCreator === 'boolean' ? event.isCreator : null,
        priority: event.priority ?? null,
        blockingLevel: event.blockingLevel ?? null,
        backgroundColor: event.backgroundColor ?? null,
        borderColor: event.borderColor ?? null,
        color: event.color ?? null,
        className: event.className ?? '',
        resource: event.resource ?? null,
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
