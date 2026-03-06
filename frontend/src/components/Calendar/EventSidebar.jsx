import React, { useState, useEffect } from 'react';
import '../../css/eventSidebar.css';
import { apiGetWithMeta, apiPost, apiPostWithMeta } from '../../api.js';

export default function EventSidebar({ 
    setDraftEvent, 
    onFinalize,
    mode,
    setMode,
    petitionGroupId,
    setPetitionGroupId,
    groupsList
}) {
    const [title, setTitle] = useState('');
    const [date, setDate] = useState('');
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [selectedBlockingLevel, setSelectedBlockingLevel] = useState('B2');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [petitionPreflightState, setPetitionPreflightState] = useState('idle'); // idle | loading | ok | error
    const [petitionPreflightMessage, setPetitionPreflightMessage] = useState('');

    // Update the live preview whenever inputs change
    useEffect(() => {
        const trimmedTitle = title.trim();
        const previewTitle = trimmedTitle || (mode === 'blocking' ? 'Busy Block' : '');

        if (previewTitle && date && startTime && endTime) {
            // Construct full Date objects for the calendar to read
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
            setDraftEvent(null); // Clear preview if form is incomplete
        }
    }, [title, date, startTime, endTime, mode, selectedBlockingLevel, setDraftEvent]);

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
                const details = traceId
                    ? ` (traceId: ${traceId})`
                    : '';
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
        return () => {
            cancelled = true;
        };
    }, [mode, petitionGroupId]);

    const handleSubmit = async () => {
        const trimmedTitle = title.trim();
        if (!trimmedTitle || !date || !startTime || !endTime) {
            alert("Please fill in all fields.");
            return;
        }

        const start = new Date(`${date}T${startTime}`);
        const end = new Date(`${date}T${endTime}`);
        if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
            alert("Invalid date/time.");
            return;
        }

        if (end.getTime() <= start.getTime()) {
            alert("End time must be after start time.");
            return;
        }

        if (mode === 'petition' && !petitionGroupId) {
            alert("Please select a group for the petition.");
            return;
        }

        if (mode === 'petition' && petitionPreflightState === 'loading') {
            alert('Still checking petition access. Please wait.');
            return;
        }

        if (mode === 'petition' && petitionPreflightState === 'error') {
            alert(petitionPreflightMessage || 'Petition access check failed. Please retry.');
            return;
        }

        if (mode === 'petition' && petitionPreflightState !== 'ok') {
            alert('Petition access is not verified yet.');
            return;
        }

        try {
            setIsSubmitting(true);

            if (mode === 'petition') {
                const createMeta = await apiPostWithMeta(`/api/groups/${petitionGroupId}/petitions`, {
                    title: trimmedTitle,
                    start: start.getTime(),
                    end: end.getTime(),
                    blocking_level: selectedBlockingLevel
                });

                if (createMeta.status !== 201) {
                    const traceId = createMeta?.traceId || createMeta?.data?.traceId;
                    const traceText = traceId ? ` (traceId: ${traceId})` : '';
                    const msg = (createMeta?.data?.error || 'Failed to create petition.') + traceText;
                    alert(msg);
                    return;
                }

                onFinalize({
                    mode: 'petition',
                    createdPetition: createMeta.data
                });
                setTitle('');
                setDate('');
                setStartTime('');
                setEndTime('');
                setSelectedBlockingLevel('B2');
                return;
            }

            const tempEventId = `manual-${Date.now()}`;
            const payload = {
                events: [
                    {
                        title: trimmedTitle,
                        start: start.toISOString(),
                        end: end.toISOString(),
                        event_id: tempEventId
                    }
                ]
            };

            if (mode === 'blocking') {
                await apiPost('/api/add-events', payload);
            }

            onFinalize({
                mode: 'blocking',
                createdPetition: null
            });

            setTitle('');
            setDate('');
            setStartTime('');
            setEndTime('');
            setSelectedBlockingLevel('B2');
        } catch (error) {
            console.error("Error saving event:", error);
            alert("There was an error saving the event. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const petitionBlocked =
        mode === 'petition' && (
            petitionPreflightState === 'loading' ||
            petitionPreflightState === 'error' ||
            !petitionGroupId
        );
    const submitDisabled = isSubmitting || petitionBlocked;
    const submitLabel = isSubmitting
        ? 'Saving...'
        : (mode === 'petition' && petitionPreflightState === 'loading')
            ? 'Checking Access...'
            : 'Finalize Event';

    return (
        <div className="event-sidebar-container">
            <h2>Create Event</h2>
            
            {/* Mode Toggle */}
            <div className="mode-toggle">
                <button id="blockingBtn"
                        style={{
                          transform: mode === 'blocking' ? 'scale(1.1)' : 'scale(1)',
                          zIndex: mode === 'blocking' ? 1 : 0

                        }}
                    onClick={() => setMode('blocking')}
                >
                    Blocking
                </button>
                <button id="petitionBtn" 
                    style={{
                      transform: mode === 'petition' ? 'scale(1.1)' : 'scale(1)',
                      zIndex: mode === 'petition' ? 1 : 0
                    }}
                    onClick={() => setMode('petition')}
                >
                    Petition
                </button>
            </div>

            <label>Event Name</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} />
                    <br />
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
            <br />
            <label>Priority</label>
            <select
                value={selectedBlockingLevel}
                onChange={(e) => setSelectedBlockingLevel(e.target.value)}
                className="priority-select-dropdown"
            >
                <option value="B1">Soft (B1)</option>
                <option value="B2">Important (B2)</option>
                <option value="B3">Hard (B3)</option>
            </select>
            <br />
            <label>Date & Time</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} />
                    <br />
            <div id="timeEntry">
                    <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
                    <span style={{ margin: '0 5px' }}> - </span>
                    <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
            </div>
                    <br />
            <button className="submit-btn" onClick={handleSubmit} disabled={submitDisabled}>
                {submitLabel}
            </button>
        </div>
    );
}
