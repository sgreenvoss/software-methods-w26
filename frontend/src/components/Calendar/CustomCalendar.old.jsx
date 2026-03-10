import React, { useState, useEffect, useRef, useContext } from 'react';
import { createPortal } from 'react-dom';
import { apiGet, apiPost } from '../../api'; // Adjust path based on your folder structure
import PetitionActionModal from '../Petitions/PetitionActionModal';
import { ErrorContext } from '../../ErrorContext';
import '../../css/calendar.css';

const AVAILABILITY_VIEWS = ['StrictView', 'FlexibleView', 'LenientView'];
const DEFAULT_GROUP_VIEW = 'FlexibleView';
const FALLBACK_VIEW = 'StrictView';
const DEEMPHASIZED_EVENT_OPACITY = 0.5;
const AVAILABILITY_MIN_OPACITY = 0.35;
const AVAILABILITY_MAX_OPACITY = 0.82;
const DAY_MS = 24 * 60 * 60 * 1000;
const BLOCKING_LEVELS = Object.freeze({
  B1: 'B1',
  B2: 'B2',
  B3: 'B3'
});
const AVAILABILITY_VIEW_LABELS = {
  StrictView: 'Strict',
  FlexibleView: 'Flexible',
  LenientView: 'Lenient'
};

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

function isSameLocalDay(left, right) {
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();
}

function formatWeekRange(start, end) {
  if (!Number.isFinite(start?.getTime?.()) || !Number.isFinite(end?.getTime?.())) {
    return '';
  }

  const startMonth = start.toLocaleString('default', { month: 'long' });
  const endMonth = end.toLocaleString('default', { month: 'long' });
  const startDay = start.getDate();
  const endDay = end.getDate();
  const startYear = start.getFullYear();
  const endYear = end.getFullYear();
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  const sameYear = start.getFullYear() === end.getFullYear();

  if (sameMonth) {
    return `${startMonth} ${startDay} - ${endDay}, ${startYear}`;
  }

  if (sameYear) {
    return `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${startYear}`;
  }

  return `${startMonth} ${startDay}, ${startYear} - ${endMonth} ${endDay}, ${endYear}`;
}

function getAvailabilityColor(availableCount, maxVisibleCount) {
  if (availableCount <= 0) {
    return 'transparent';
  }
  if (maxVisibleCount <= 1) {
    return 'hsl(145, 78%, 42%)';
  }

  const t = (availableCount - 1) / (maxVisibleCount - 1);
  const saturation = 60 + (18 * t);
  const lightness = 84 - (42 * t);
  return `hsl(145, ${saturation}%, ${lightness}%)`;
}

function getAvailabilityOpacity(availableCount, maxVisibleCount) {
  if (availableCount <= 0) {
    return 0;
  }
  if (maxVisibleCount <= 1) {
    return AVAILABILITY_MAX_OPACITY;
  }

  const t = (availableCount - 1) / (maxVisibleCount - 1);
  return AVAILABILITY_MIN_OPACITY + ((AVAILABILITY_MAX_OPACITY - AVAILABILITY_MIN_OPACITY) * t);
}

function formatAvailabilityTooltip(count) {
  return count === 1 ? '1 person available' : `${count} people available`;
}

function spansMultipleLocalDays(start, end) {
  if (!Number.isFinite(start?.getTime?.()) || !Number.isFinite(end?.getTime?.()) || end <= start) {
    return false;
  }

  const inclusiveEnd = new Date(end.getTime() - 1);
  return start.getFullYear() !== inclusiveEnd.getFullYear()
    || start.getMonth() !== inclusiveEnd.getMonth()
    || start.getDate() !== inclusiveEnd.getDate();
}

function shouldDeEmphasizeEventSegment(event) {
  return event?.mode !== 'avail' && (event?.isAllDay || event?.spansMultipleDays);
}

function isDateOnlyText(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isLocalMidnight(date) {
  return Number.isFinite(date?.getTime?.())
    && date.getHours() === 0
    && date.getMinutes() === 0
    && date.getSeconds() === 0
    && date.getMilliseconds() === 0;
}

function getLocalCalendarDayNumber(date) {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS;
}

function isWholeLocalDayRange(start, end) {
  if (!Number.isFinite(start?.getTime?.()) || !Number.isFinite(end?.getTime?.()) || end <= start) {
    return false;
  }

  return isLocalMidnight(start)
    && isLocalMidnight(end)
    && getLocalCalendarDayNumber(end) > getLocalCalendarDayNumber(start);
}

function getViewStatsFromBlock(block, viewKey) {
  if (!block || typeof block !== 'object') {
    return { availableCount: 0, totalCount: 0 };
  }

  const strictView = block?.views?.StrictView;
  const selectedView = block?.views?.[viewKey];

  const availableCount = Number.isFinite(selectedView?.availableCount)
    ? selectedView.availableCount
    : Number.isFinite(strictView?.availableCount)
      ? strictView.availableCount
      : Number.isFinite(block?.count)
        ? block.count
        : 0;

  const totalCount = Number.isFinite(selectedView?.totalCount)
    ? selectedView.totalCount
    : Number.isFinite(strictView?.totalCount)
      ? strictView.totalCount
      : Number.isFinite(block?.totalCount)
        ? block.totalCount
        : 0;

  return { availableCount, totalCount };
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

function EventClickModal({ event, onClose, onRefresh }) {
  const initialPriority = Number.isFinite(Number(event?.priority)) ? Number(event.priority) : 1;
  const [newPriority, setNewPriority] = useState(initialPriority);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await apiPost('/api/change-blocking-lvl', {
        event_id: event.id,
        priority: parseInt(newPriority, 10)
      });
      onRefresh();
      onClose();
    } catch (error) {
      console.error("Failed to update priority", error);
      alert("Failed to update blocking level.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    const confirmDelete = window.confirm(`Are you sure you want to delete "${event.title}"?`);
    if (!confirmDelete) return;

    setIsSaving(true);
    try {
      await apiPost('/api/delete-event', { event_id: event.id });
      onRefresh();
      onClose();
    } catch (error) {
      console.error("Failed to delete event", error);
      alert("Failed to delete the event.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '350px' }}>
        <h2 style={{ marginTop: 0 }}>{event.title}</h2>
        <p><strong>Start:</strong> {event.start.toLocaleString()}</p>
        <p><strong>End:</strong> {event.end.toLocaleString()}</p>
        <p><strong>Priority:</strong> {
          initialPriority.toLocaleString() == 3 ?
          "High" :
            initialPriority.toLocaleString() == 2 ?
            "Med" :
              initialPriority.toLocaleString() == 1 ?
              "Low" :
                initialPriority.toLocaleString()
        }</p>

        <div style={{ margin: '15px 0' }}>
          <label><strong>Blocking Level:</strong></label>
          <select
            value={newPriority}
            onChange={(e) => setNewPriority(e.target.value)}
            style={{ width: '100%', padding: '8px', marginTop: '5px' }}
          >
            <option value={1}>Low (Optional)</option>
            <option value={2}>Medium (Flexible)</option>
            <option value={3}>High (Immovable)</option>
          </select>
        </div>

        <div className="modal-actions">
          <button
            onClick={handleDelete}
            disabled={isSaving}
            style={{
              backgroundColor: '#d63031',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Delete Event
          </button>
          <button onClick={onClose} disabled={isSaving}>
            Cancel
          </button>
          <button className="primary-btn" onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
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
  const status = computedStatus;
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


export default function CustomCalendar({ refreshTrigger, groupId, draftEvent }) {
  // --- STATE (The "Controller" Data) ---
  const [weekStart, setWeekStart] = useState(getStartOfWeek(new Date()));
  const [rawEvents, setRawEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rawAvailabilityBlocks, setRawAvailabilityBlocks] = useState([]);
  const [availabilityViewByGroup, setAvailabilityViewByGroup] = useState({});
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [visiblePetitions, setVisiblePetitions] = useState([]);
  const [selectedPetition, setSelectedPetition] = useState(null);
  const [isPetitionModalOpen, setIsPetitionModalOpen] = useState(false);
  const [petitionActionRefreshKey, setPetitionActionRefreshKey] = useState(0);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [availabilityTooltip, setAvailabilityTooltip] = useState(null);
  const petitionDraftActive = draftEvent?.mode === 'petition';
  const selectedGroupKey = groupId == null ? null : String(groupId);
  const selectedAvailabilityView = selectedGroupKey
    ? (availabilityViewByGroup[selectedGroupKey] || DEFAULT_GROUP_VIEW)
    : DEFAULT_GROUP_VIEW;
  const latestAvailabilityRequestRef = useRef(0);

  // error handling
  const { setError } = useContext(ErrorContext);

  const refreshPersonalEvents = async () => {
    const personalEvents = await apiGet('/api/get-events');
    if (Array.isArray(personalEvents)) {
      setRawEvents(personalEvents);
    }
  };

  // --- EFFECT 1: Fetch Personal Events ---

  // TEAMNOTE[refresh-trigger]: Restore legacy refreshTrigger wiring removed during petition rewiring.
  useEffect(() => {
    const fetchPersonalEvents = async () => {
      setLoading(true);
      try {

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
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };
    
    fetchPersonalEvents();
  }, [weekStart, refreshTrigger]); 

  // --- EFFECT 2: Fetch Group Availability ---

  // TEAMNOTE[refresh-trigger]: Restore legacy refreshTrigger wiring removed during petition rewiring.
  useEffect(() => {
    let isCancelled = false;

    const fetchGroupEvents = async () => {
      // If the user clicked "Hide", groupId will be null.
      // We just clear the state and exit early. No network call needed.
      if (!groupId || groupId === 0) {
        latestAvailabilityRequestRef.current += 1;
        setRawAvailabilityBlocks([]);
        setLoading(false);
        return; 
      }

      const requestId = latestAvailabilityRequestRef.current + 1;
      latestAvailabilityRequestRef.current = requestId;

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

        if (isCancelled || latestAvailabilityRequestRef.current !== requestId) {
          return;
        }

        if (response && response.ok && Array.isArray(availabilityBlocks)) {
          setRawAvailabilityBlocks(availabilityBlocks);
        } else {
          setRawAvailabilityBlocks([]);
        }
      } catch (error) {
        if (isCancelled || latestAvailabilityRequestRef.current !== requestId) {
          return;
        }
        console.error('Failed to fetch group availability:', error);
        setRawAvailabilityBlocks([]);
        setError(error.message);
      } finally {
        if (!isCancelled && latestAvailabilityRequestRef.current === requestId) {
          setLoading(false);
        }
      }
    };
    
    fetchGroupEvents();

    return () => {
      isCancelled = true;
    };
  }, [refreshTrigger, groupId, weekStart]);

  useEffect(() => {
    const fetchCurrentUser = async() => {
      try {
        const response = await apiGet('/api/me');
        const userId = response?.user?.user_id;
        setCurrentUserId(userId != null ? Number(userId) : null);
      } catch (error) {
        console.error('Failed to load current user for petition actions:', error);
        setCurrentUserId(null);
        setError(error.message);
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
        setError(error.message);
      }
    };

    fetchVisiblePetitions();
  }, [groupId, weekStart, petitionActionRefreshKey, petitionDraftActive]);

  const handleAvailabilityViewChange = (viewKey) => {
    if (!selectedGroupKey || !AVAILABILITY_VIEWS.includes(viewKey)) {
      return;
    }

    setAvailabilityViewByGroup((currentMap) => ({
      ...currentMap,
      [selectedGroupKey]: viewKey
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

  const handleRegularEventActionComplete = () => {
    refreshPersonalEvents();
  };

  const updateAvailabilityTooltip = (mouseEvent, count) => {
    setAvailabilityTooltip({
      count,
      x: mouseEvent.clientX + 12,
      y: mouseEvent.clientY + 10
    });
  };

  const handleAvailabilityTooltipLeave = () => {
    setAvailabilityTooltip(null);
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

  const hasMultiViewAvailability = rawAvailabilityBlocks.some(
    (block) => block && typeof block.views === 'object' && block.views !== null
  );
  const effectiveAvailabilityView = hasMultiViewAvailability && AVAILABILITY_VIEWS.includes(selectedAvailabilityView)
    ? selectedAvailabilityView
    : FALLBACK_VIEW;

  const projectedAvailability = (groupId ? rawAvailabilityBlocks : []).map((block, i) => {
    const { availableCount } = getViewStatsFromBlock(block, effectiveAvailabilityView);

    return {
      title: '',
      availLvl: availableCount,
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

  const availabilityLegendMeta = (groupId ? rawAvailabilityBlocks : []).reduce((meta, block) => {
    const { availableCount, totalCount } = getViewStatsFromBlock(block, effectiveAvailabilityView);
    if (availableCount > meta.maxVisibleCount) {
      meta.maxVisibleCount = availableCount;
    }
    if (totalCount > meta.maxTotalCount) {
      meta.maxTotalCount = totalCount;
    }
    return meta;
  }, { maxVisibleCount: 0, maxTotalCount: 0 });

  let legendMaxCount = availabilityLegendMeta.maxVisibleCount;
  if (availabilityLegendMeta.maxTotalCount > 0) {
    legendMaxCount = Math.min(legendMaxCount, availabilityLegendMeta.maxTotalCount);
  }
  const legendCounts = legendMaxCount > 0
    ? Array.from({ length: legendMaxCount }, (_, idx) => idx + 1)
    : [];

  useEffect(() => {
    setAvailabilityTooltip(null);
  }, [groupId, weekStart, rawAvailabilityBlocks, effectiveAvailabilityView]);

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
  const today = new Date();
  const weekRangeLabel = formatWeekRange(days[0], days[days.length - 1]);

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

  const getPetitionStyle = (event) => {
    switch (event.status) {
      case 'FAILED':
        return {
          backgroundColor: '#9ea3a8',
          textColor: '#1f1f1f',
          opacity: 0.72
        };
      case 'ACCEPTED_ALL':
        return {
          backgroundColor: '#f97316',
          textColor: '#ffffff',
          opacity: 0.72
        };
      default:
        return {
          backgroundColor: '#f4d35e',
          textColor: '#1f1f1f',
          opacity: 0.72
        };
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
      <div className="calendar-hero">
        {/* 1. CALENDAR HEADER (Navigation) */}
        <div className="calendar-header">
          <button className="calendar-nav-btn" onClick={handlePrevWeek} disabled={isCurrentWeek(weekStart)}>← Prev</button>
          <div className="calendar-title-block">
            <h2 className="calendar-month-title">
              {weekStart.toLocaleString("default", { month: "long", year: "numeric" })}
            </h2>
            <p className="calendar-week-range">{weekRangeLabel}</p>
          </div>
          <button className="calendar-nav-btn" onClick={handleNextWeek}>Next →</button>
        </div>

        {groupId ? (
          <div className="availability-controls">
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

      {/* 2. CALENDAR GRID (View) */}
      <div className="calendar-grid-shell">
        <div className="calendar-grid">
          <div className="corner-cell"></div>
          {days.map((day, i) => (
            <div key={i} className={`day-header${isSameLocalDay(day, today) ? ' is-today' : ''}`}>
              {day.toLocaleDateString("default", { weekday: "short", month: "numeric", day: "numeric" })}
            </div>
          ))}

          {hours.map(hour => (
            <React.Fragment key={hour}>
              <div className="time-label">
                {`${hour === 0 || hour === 12 ? 12 : hour % 12}:00${hour < 12 ? 'am' : 'pm'}`}
              </div>

              {days.map((day, i) => (
                <div key={i} className={`calendar-cell${isSameLocalDay(day, today) ? ' is-today' : ''}`}>
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
                        const petitionStyle = getPetitionStyle(event);
                        backgroundColor = petitionStyle.backgroundColor;
                        textColor = petitionStyle.textColor;
                        opacity = petitionStyle.opacity;
                        zIndex = 4;
                      } else if (event.mode === 'avail') {
                        backgroundColor = getAvailabilityColor(event.availLvl, legendMaxCount);
                        opacity = getAvailabilityOpacity(event.availLvl, legendMaxCount);
                        zIndex = 3;
                      } else {
                        const normalizedBlockingLevel = normalizeBlockingLevelFromEvent(event);
                        const isAboveAvailability = shouldRenderRegularEventAboveAvailability(
                          effectiveAvailabilityView,
                          normalizedBlockingLevel
                        );
                        zIndex = isAboveAvailability ? 4 : 2;
                        opacity = event.mode === 'blocking' ? 0.6 : 1;

                        backgroundColor = event.backgroundColor
                          || (typeof event.color === 'string' ? event.color : null)
                          || (event.mode === 'blocking' ? '#34333c' : '#6395ee');
                        textColor = event.backgroundColor && typeof event.color === 'string' ? event.color : undefined;
                      }
                      if (!event.isPreview && typeof event.id === 'string' && event.id.startsWith('manual-')) {
                        backgroundColor = '#6f6e76';
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
                      const shouldDeEmphasize = shouldDeEmphasizeEventSegment(event);
                      const isRegularEventClickable = event.mode !== 'avail' && event.mode !== 'petition' && !event.isPreview;
                      // TEAMNOTE[event-editing]: Restore legacy regular-event click/edit flow removed during petition rewiring.
                      const handleEventClick = () => {
                        if (event.mode === 'petition') {
                          handlePetitionClick(event);
                          return;
                        }
                        if (isRegularEventClickable) {
                          setSelectedEvent(event);
                        }
                      };
                      return (
                        <div
                          key={idx}
                          className={combinedClassName}
                          onClick={(event.mode === 'petition' || isRegularEventClickable) ? handleEventClick : undefined}
                          onMouseEnter={event.mode === 'avail' ? (mouseEvent) => updateAvailabilityTooltip(mouseEvent, event.availLvl) : undefined}
                          onMouseMove={event.mode === 'avail' ? (mouseEvent) => updateAvailabilityTooltip(mouseEvent, event.availLvl) : undefined}
                          onMouseLeave={event.mode === 'avail' ? handleAvailabilityTooltipLeave : undefined}
                          data-event-mode={event.mode}
                          data-availability-count={event.mode === 'avail' ? event.availLvl : undefined}
                          style={{
                            height: `${Math.max(1, visualHeight)}px`,
                            top: `${startMins}px`,
                            opacity: shouldDeEmphasize ? Math.min(opacity, DEEMPHASIZED_EVENT_OPACITY) : opacity,
                            zIndex: shouldDeEmphasize ? 1 : zIndex,
                            backgroundColor: backgroundColor,
                            color: textColor,
                            border: borderStyle,
                            cursor: (event.mode === 'petition' || isRegularEventClickable) ? 'pointer' : 'default'
                            
                          }}
                        >
                          {event.mode === 'avail' ? null : getDisplayTitle(event)}
                        </div>
                      );
                    })}
                </div>
              ))}
            </React.Fragment>
          ))}
        </div>
      </div>
      {availabilityTooltip && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="availability-tooltip"
              data-testid="availability-tooltip"
              style={{
                left: `${availabilityTooltip.x}px`,
                top: `${availabilityTooltip.y}px`
              }}
            >
              {formatAvailabilityTooltip(availabilityTooltip.count)}
            </div>,
            document.body
          )
        : null}
      {loading && <p>Loading events...</p>}
      {selectedEvent && (
        <EventClickModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onRefresh={handleRegularEventActionComplete}
        />
      )}
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
    const normalizedRange = normalizeEventRange(event);
    let start = normalizedRange.start;
    let end = normalizedRange.end;
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) return;

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
        event_id: event.event_id,
        isAllDay: normalizedRange.isAllDay,
        spansMultipleDays: normalizedRange.spansMultipleDays,
        isEndOfDay: effectiveEnd.getTime() === nextDayStart.getTime(),
        isPreview: event.isPreview || false,
        availLvl: event.availLvl || 0, // for group availability heatmap
        mode: event.mode || 'normal', // 'normal', 'blocking', 'petition', 'avail'
        priority: Number.isFinite(Number(event.priority)) ? Number(event.priority) : null,
        blockingLevel: event.blockingLevel ?? null,
        backgroundColor: event.backgroundColor ?? null,
        color: event.color ?? null,
        borderColor: event.borderColor ?? null,
        className: event.className ?? '',
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
        // isAvail: event.isAvail || false
      });
      current = nextDayStart;
    }
  });
  return processed;
}

function normalizeEventRange(event) {
  const hasDateOnlyInputs = isDateOnlyText(event?.start) && isDateOnlyText(event?.end);

  if (event?.isAllDay || hasDateOnlyInputs) {
    const startDateText = event.allDayStartDate || (hasDateOnlyInputs ? event.start : formatUtcDateOnly(event.start));
    const endDateText = event.allDayEndDate || (hasDateOnlyInputs ? event.end : formatUtcDateOnly(event.end));
    const start = parseLocalDateOnly(startDateText);
    const end = parseLocalDateOnly(endDateText);
    return {
      start,
      end,
      isAllDay: true,
      spansMultipleDays: spansMultipleLocalDays(start, end)
    };
  }

  const start = parseEventInstant(event?.start);
  const end = parseEventInstant(event?.end);
  const isAllDay = isWholeLocalDayRange(start, end);
  return {
    start,
    end,
    isAllDay,
    spansMultipleDays: spansMultipleLocalDays(start, end)
  };
}

function parseLocalDateOnly(dateInput) {
  if (typeof dateInput === 'string' && dateInput.length === 10) {
    const [y, m, d] = dateInput.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(NaN);
}

function parseEventInstant(dateInput) {
  return new Date(dateInput);
}

function formatUtcDateOnly(dateInput) {
  const parsed = parseEventInstant(dateInput);
  if (!Number.isFinite(parsed.getTime())) {
    return '';
  }
  return parsed.toISOString().slice(0, 10);
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
