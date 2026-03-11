import React from 'react';

export default function HelpModal() {
    if (!isOpen) return null;

    return (
        <div className="calendar-modal-overlay">
            <div className="calendar-modal-content">
                <h2>Select Your Calendars</h2>
                <p className="calendar-modal-description">
                    Choose the calendars you want to import. <strong>This cannot be changed later.</strong>
                </p>

                <div className="calendar-items-container">
                    {calendars.map((calendar) => (
                        <div key={calendar.id} className="calendar-item">
                            <label>
                                <input
                                    type="checkbox"
                                    checked={selectedCals.some(cal => cal.id === calendar.id)}
                                    onChange={() => onSelectCalendar(calendar)}
                                    disabled={isLoading}
                                />
                                <span>{calendar.displayName}</span>
                            </label>
                        </div>
                    ))}
                </div>

                {errors && (
                    <div className="calendar-modal-errors">
                        {errors.map((err, idx) => (
                            <p key={idx}>{err}</p>
                        ))}
                    </div>
                )}

                <div className="calendar-modal-buttons">
                    <button
                        className="calendar-modal-btn-back"
                        onClick={onBack}
                        disabled={isLoading}
                    >
                        Back
                    </button>
                    <button
                        className="calendar-modal-btn-confirm"
                        onClick={onConfirm}
                        disabled={isLoading || selectedCals.length === 0}
                    >
                        {isLoading ? 'Loading...' : 'Finish'}
                    </button>
                </div>
            </div>
        </div>
    );
}
