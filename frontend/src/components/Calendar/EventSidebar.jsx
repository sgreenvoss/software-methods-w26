import React, { useState, useEffect } from 'react';
import { apiPostWithMeta } from '../../api';
import '../../css/eventSidebar.css';

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
                mode: mode === 'petition' ? 'petition' : 'event',
                isBlockingPreview: mode === 'blocking',
                blockingLevel: selectedBlockingLevel,
                isPreview: true
            });
        } else {
            setDraftEvent(null); // Clear preview if form is incomplete
        }
    }, [title, date, startTime, endTime, mode, selectedBlockingLevel, setDraftEvent]);

    const handleSubmit = async () => {
        const trimmedTitle = title.trim();
        if (mode === 'petition' && !trimmedTitle) {
            alert("Please enter a title.");
            return;
        }

        if (!date || !startTime || !endTime) {
            alert("Please provide date, start time, and end time.");
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
                    const msg = createMeta?.data?.error || 'Failed to create petition.';
                    alert(msg);
                    return;
                }

                const createdPetition = createMeta.data;

                onFinalize({
                    mode: 'petition',
                    createdPetition
                });

                setTitle('');
                setDate('');
                setStartTime('');
                setEndTime('');
                setSelectedBlockingLevel('B2');
                return;
            }

            const createMeta = await apiPostWithMeta('/api/events/manual', {
                title: trimmedTitle,
                start: start.getTime(),
                end: end.getTime(),
                blockingLevel: selectedBlockingLevel
            });

            if (createMeta.status !== 201) {
                const msg = createMeta?.data?.error || 'Failed to create busy block.';
                alert(msg);
                return;
            }

            const createdEvent = createMeta?.data?.event || null;

            onFinalize({
                mode: 'blocking',
                createdPetition: null,
                createdEvent
            });

            setTitle('');
            setDate('');
            setStartTime('');
            setEndTime('');
            setSelectedBlockingLevel('B2');
        } catch (error) {
            console.error("Finalize failed:", error);
            alert("Failed to finalize. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

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
                    <br />
                </>
            )}
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
            <button className="submit-btn" onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Finalize Event'}
            </button>
        </div>
    );
}
