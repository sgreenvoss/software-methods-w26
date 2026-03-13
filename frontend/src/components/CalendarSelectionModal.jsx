/*
File: CalendarSelectionModal.jsx
Purpose: Provides the modal to select calendars after users 
        have submitted a valid username
Creation Date: 2026-03-06
Initial Author(s): Anna Norris

System Context:
Presented on login page for onboarding, selected calendars are
used in endpoints to synchronize user's calendars.
*/

import React from 'react';
import '../css/calendarSelectModal.css';

/**
 * Renders onboarding modal for selecting which calendars to import.
 *
 * @param {object} props - Component props.
 * @param {boolean} props.isOpen - Controls whether the modal is visible.
 * @param {Array<{id: string|number, displayName: string}>} props.calendars - List of available calendars.
 * @param {Array<{id: string|number}>} props.selectedCals - Currently selected calendars.
 * @param {Function} props.onSelectCalendar - Called with a calendar when a checkbox is toggled.
 * @param {Function} props.onConfirm - Called when user confirms calendar choices.
 * @param {Function} props.onBack - Called when user returns to previous onboarding step.
 * @param {boolean} props.isLoading - Disables actions while onboarding requests are in progress.
 * @param {string[]} props.errors - Validation or API errors to display inside the modal.
 * @returns {JSX.Element|null} Calendar selection modal markup, or null when closed.
 */
export default function CalendarSelectionModal({ 
    isOpen, 
    calendars, 
    selectedCals, 
    onSelectCalendar,
    onConfirm,
    onBack,
    isLoading,
    errors
}) {
    if (!isOpen) return null;

    return (
        // uses basic framework of modal
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
                                {/* when item is checked/unchecked, add to selected calendars*/}
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
