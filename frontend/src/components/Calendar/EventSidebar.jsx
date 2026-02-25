import React, { useState, useEffect } from 'react';
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
    // const [mode, setMode] = useState('blocking'); // 'blocking' or 'petition'
    const [title, setTitle] = useState('');
    const [date, setDate] = useState('');
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');

    // Update the live preview whenever inputs change
    useEffect(() => {
        if (title && date && startTime && endTime) {
            // Construct full Date objects for the calendar to read
            const start = new Date(`${date}T${startTime}`);
            const end = new Date(`${date}T${endTime}`);
            
            setDraftEvent({
                title,
                start,
                end,
                mode,
                isPreview: true
            });
        } else {
            setDraftEvent(null); // Clear preview if form is incomplete
        }
    }, [title, date, startTime, endTime, mode, setDraftEvent]);

    const handleSubmit = async () => {
        if (mode === 'petition' && !petitionGroupId) {
            alert("Please select a group for the petition.");
            return;
        }

        // TODO: apiPost to save the event to the DB
        console.log("Saving event:", { title, date, startTime, endTime, mode });
        // Once successful, clear the form and close sidebar
        onFinalize(); 
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
                </>
            )}
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
            <button className="submit-btn" onClick={handleSubmit}>Finalize Event</button>
        </div>
    );
}