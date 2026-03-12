import React, { useState, useEffect } from 'react';
import '../../css/eventSidebar.css';
import { apiGetWithMeta, apiPost, apiPostWithMeta } from '../../api.js';

const DAYS_OF_WEEK = [
    { label: 'S', value: 0 },
    { label: 'M', value: 1 },
    { label: 'T', value: 2 },
    { label: 'W', value: 3 },
    { label: 'T', value: 4 },
    { label: 'F', value: 5 },
    { label: 'S', value: 6 }
];

export default function EventSidebar({ 
    setDraftEvent, 
    onFinalize,
    mode,
    setMode,
    petitionGroupId,
    setPetitionGroupId,
    groupsList,
    clickedCellDetails
}) {
    const [title, setTitle] = useState('');
    const [date, setDate] = useState('');
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [selectedBlockingLevel, setSelectedBlockingLevel] = useState('B2');
    
    // --- NEW: Recurrence State ---
    const [isRecurring, setIsRecurring] = useState(false);
    const [selectedDays, setSelectedDays] = useState([]); // Array of ints: 0 = Sun, 6 = Sat
    const [recurrenceWeeks, setRecurrenceWeeks] = useState(1);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [petitionPreflightState, setPetitionPreflightState] = useState('idle');
    const [petitionPreflightMessage, setPetitionPreflightMessage] = useState('');

    // Update the live preview whenever inputs change
    // (Note: To keep the calendar performance fast, we only preview the base start date)
    useEffect(() => {
        const trimmedTitle = title.trim();
        const previewTitle = trimmedTitle || (mode === 'blocking' ? 'Busy Block' : 'Petition');

        if (previewTitle && date && startTime && endTime) {
            const start = new Date(`${date}T${startTime}`);
            const end = new Date(`${date}T${endTime}`);
            
            setDraftEvent({
                title: previewTitle,
                start,
                end,
                mode,
                blockingLevel: selectedBlockingLevel,
                isPreview: true
            });
        } else {
            setDraftEvent(null);
        }
    }, [title, date, startTime, endTime, mode, selectedBlockingLevel, setDraftEvent]);

    // ... Keep your existing runPreflight useEffect exactly the same ...
    useEffect(() => {
        let cancelled = false;
        const runPreflight = async() => {
            if (mode !== 'petition') {
                setPetitionPreflightState('idle');
                setPetitionPreflightMessage('');
                return;
            }
            if (!petitionGroupId) {
                setPetitionPreflightState('idle');
                setPetitionPreflightMessage('Select a group to verify petition access.');
                return;
            }

            setPetitionPreflightState('loading');
            setPetitionPreflightMessage('Checking petition access...');

            try {
                const response = await apiGetWithMeta(`/api/groups/${petitionGroupId}/petitions/preflight`);
                if (cancelled) return;

                if (response.ok && response.status === 200 && response.data?.ok) {
                    setPetitionPreflightState('ok');
                    setPetitionPreflightMessage('');
                    return;
                }

                const traceId = response?.traceId || response?.data?.traceId;
                const details = traceId ? ` (traceId: ${traceId})` : '';
                const errorMessage = response?.data?.error || 'Unable to verify petition access.';
                setPetitionPreflightState('error');
                setPetitionPreflightMessage(`${errorMessage}${details}`);
            } catch (error) {
                if (cancelled) return;
                setPetitionPreflightState('error');
                setPetitionPreflightMessage('Unable to verify petition access. Please retry.');
            }
        };

        runPreflight();
        return () => { cancelled = true; };
    }, [mode, petitionGroupId]);

    useEffect(() => {
        if (clickedCellDetails) {
            setDate(clickedCellDetails.date);
            setStartTime(clickedCellDetails.startTime);
            setEndTime(clickedCellDetails.endTime);
            // Pre-select the day of the week based on the clicked calendar cell
            const clickedDateObj = new Date(clickedCellDetails.date + "T00:00:00");
            setSelectedDays([clickedDateObj.getDay()]);
        }
    }, [clickedCellDetails]);

    const toggleDay = (val) => {
        setSelectedDays(prev => 
            prev.includes(val) ? prev.filter(d => d !== val) : [...prev, val].sort()
        );
    };

    const handleSubmit = async () => {
        const trimmedTitle = title.trim();
        if (!trimmedTitle || !date || !startTime || !endTime) {
            alert("Please fill in all fields.");
            return;
        }

        if (mode === 'petition' && !petitionGroupId) {
            alert("Please select a group for the petition.");
            return;
        }

        // --- NEW: Generate Occurrences ---
        const occurrences = [];
        const [year, month, day] = date.split('-');
        const baseDate = new Date(year, month - 1, day); // Safe local midnight

        if (isRecurring) {
            if (selectedDays.length === 0) {
                alert("Please select at least one day to repeat the event.");
                return;
            }
            
            const totalDaysToCheck = recurrenceWeeks * 7;
            for (let i = 0; i < totalDaysToCheck; i++) {
                const currDate = new Date(baseDate);
                currDate.setDate(baseDate.getDate() + i);

                // If this date matches a selected day of the week
                if (selectedDays.includes(currDate.getDay())) {
                    const y = currDate.getFullYear();
                    const m = String(currDate.getMonth() + 1).padStart(2, '0');
                    const d = String(currDate.getDate()).padStart(2, '0');
                    const dateString = `${y}-${m}-${d}`;

                    const start = new Date(`${dateString}T${startTime}`);
                    const end = new Date(`${dateString}T${endTime}`);
                    occurrences.push({ start, end });
                }
            }
            
            if (occurrences.length === 0) {
                alert("No occurrences found for the selected days.");
                return;
            }
        } else {
            // Single event
            const start = new Date(`${date}T${startTime}`);
            const end = new Date(`${date}T${endTime}`);
            occurrences.push({ start, end });
        }

        // Validate times on all generated occurrences
        for (const occ of occurrences) {
            if (!Number.isFinite(occ.start.getTime()) || !Number.isFinite(occ.end.getTime())) {
                alert("Invalid date/time calculation.");
                return;
            }
            if (occ.end.getTime() <= occ.start.getTime()) {
                alert("End time must be after start time for all occurrences.");
                return;
            }
        }

        try {
            setIsSubmitting(true);

            if (mode === 'petition') {
                // For petitions, we send them sequentially to the existing endpoint
                let firstCreatedPetition = null;
                for (let i = 0; i < occurrences.length; i++) {
                    const occ = occurrences[i];
                    const createMeta = await apiPostWithMeta(`/api/groups/${petitionGroupId}/petitions`, {
                        title: trimmedTitle,
                        start: occ.start.getTime(),
                        end: occ.end.getTime(),
                        blocking_level: selectedBlockingLevel
                    });

                    if (createMeta.status !== 201) {
                        alert(`Created ${i} petitions, but failed on occurrence ${i+1}. Check the console.`);
                        return;
                    }
                    if (!firstCreatedPetition) firstCreatedPetition = createMeta.data;
                }

                onFinalize({ mode: 'petition', createdPetition: firstCreatedPetition });
            } else {
                // For blocking events, we map the occurrences into the array payload format
                const eventsPayload = occurrences.map((occ, idx) => ({
                    title: trimmedTitle,
                    start: occ.start.toISOString(),
                    end: occ.end.toISOString(),
                    event_id: `manual-${Date.now()}-${idx}`, // Unique ID for each occurrence
                    priority: selectedBlockingLevel === 'B1' ? 1 : selectedBlockingLevel === 'B2' ? 2 : 3
                }));

                await apiPost('/api/add-events', { events: eventsPayload });

                onFinalize({ mode: 'blocking', createdPetition: null });
            }

            // Reset Form
            setTitle('');
            setDate('');
            setStartTime('');
            setEndTime('');
            setSelectedBlockingLevel('B2');
            setIsRecurring(false);
            setRecurrenceWeeks(1);
        } catch (error) {
            console.error("Error saving event:", error);
            alert("There was an error saving the event. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const missingBasicInfo = !title.trim() || !date || !startTime || !endTime;
    const petitionBlocked = mode === 'petition' && (petitionPreflightState === 'loading' || petitionPreflightState === 'error' || !petitionGroupId);
    const submitDisabled = isSubmitting || petitionBlocked || missingBasicInfo;
    
    const submitLabel = isSubmitting
        ? 'Saving...'
        : (mode === 'petition' && petitionPreflightState === 'loading')
            ? 'Checking Access...'
            : 'Finalize Event'; 

    return (
        <div className="event-sidebar-container">
            <h2>Create Event</h2>
            
            <div className="mode-toggle">
                <button id="blockingBtn"
                        style={{
                          transform: mode === 'blocking' ? 'scale(1.1)' : 'scale(1)',
                          border: mode === 'blocking' ? '3px solid #ffffff' : '1px solid #ffffff',
                          boxShadow: '0 2px 6px rgba(0, 0, 0, 0.2)',
                          zIndex: mode === 'blocking' ? 1 : 0
                        }}
                    onClick={() => setMode('blocking')}
                >
                    Blocking
                </button>
                <button id="petitionBtn" 
                    style={{
                      transform: mode === 'petition' ? 'scale(1.1)' : 'scale(1)',
                      border: mode === 'petition' ? '3px solid #ffffff' : '1px solid #ffffff',
                    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.2)',
                      zIndex: mode === 'petition' ? 1 : 0
                    }}
                    onClick={() => setMode('petition')}
                >
                    Petition
                </button>
            </div>

            <label>Event Name</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} />
            
            {mode === 'petition' && (
                <>
                    <label>Select Group</label>
                    <select 
                        value={petitionGroupId} 
                        onChange={(e) => setPetitionGroupId(e.target.value)}
                        className="group-select-dropdown"
                    >
                        <option value="">-- Choose a Group --</option>
                        {groupsList.map(group => (
                            <option key={group.group_id} value={group.group_id}>
                                {group.group_name}
                            </option>
                        ))}
                    </select>
                    <p className={`preflight-message ${petitionPreflightState === 'error' ? 'preflight-error' : ''}`}>
                        {petitionPreflightMessage}
                    </p>
                </>
            )}
            
            <label>Priority</label>
            <select
                value={selectedBlockingLevel}
                onChange={(e) => setSelectedBlockingLevel(e.target.value)}
                className="priority-select-dropdown"
            >
                <option value="B1">Low</option>
                <option value="B2">Med</option>
                <option value="B3">High</option>
            </select>
            
            <label>Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} />
            
            <label>Time</label>
            <div id="timeEntry">
                    <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
                    <span style={{ fontWeight: 'bold' }}> - </span>
                    <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
            </div>

            {/* --- NEW: RECURRENCE UI --- */}
            <label style={{display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginTop: '15px', fontWeight: 'bold', color: '#2d3436'}}>
                <input 
                    type="checkbox" 
                    checked={isRecurring} 
                    onChange={e => setIsRecurring(e.target.checked)} 
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                Repeat Event
            </label>

            {isRecurring && (
                <div style={{ marginTop: '10px', padding: '12px', backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e5e5e5', width: '100%', boxSizing: 'border-box' }}>
                    <label style={{ fontSize: '0.9rem', color: '#6f6e76', marginTop: 0 }}>Repeat on days:</label>
                    <div style={{ display: 'flex', gap: '4px', marginTop: '8px', marginBottom: '15px' }}>
                        {DAYS_OF_WEEK.map(day => (
                            <button 
                                key={day.value}
                                type="button"
                                onClick={() => toggleDay(day.value)}
                                style={{
                                    flex: 1, padding: '6px 0', border: 'none', borderRadius: '6px', cursor: 'pointer',
                                    backgroundColor: selectedDays.includes(day.value) ? '#00b894' : '#f4f5f7',
                                    color: selectedDays.includes(day.value) ? '#ffffff' : '#2d3436',
                                    fontWeight: 'bold', fontSize: '0.9rem', transition: '0.1s'
                                }}
                            >
                                {day.label}
                            </button>
                        ))}
                    </div>
                    
                    <label style={{ fontSize: '0.9rem', color: '#6f6e76' }}>For how many weeks?</label>
                    <select 
                        value={recurrenceWeeks} 
                        onChange={e => setRecurrenceWeeks(Number(e.target.value))}
                        style={{ width: '100%', marginTop: '8px', padding: '10px', borderRadius: '6px', border: '1px solid #e5e5e5' }}
                    >
                        <option value={1}>1 Week</option>
                        <option value={2}>2 Weeks</option>
                        <option value={3}>3 Weeks</option>
                        <option value={4}>4 Weeks</option>
                        <option value={5}>5 Weeks (Max)</option>
                    </select>
                </div>
            )}
            
            <button className="submit-btn" onClick={handleSubmit} disabled={submitDisabled} style={{ marginTop: '20px' }}>
                {submitLabel}
            </button>
        </div>
    );
}