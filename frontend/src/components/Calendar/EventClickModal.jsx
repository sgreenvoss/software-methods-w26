// --- EventClickModal.jsx ---

/*
  This handles the popup when a user clicks 
  a personal event to change its priority or 
  delete it. Keeping it separate makes the 
  main calendar file much easier to read.
*/

import React, { useState } from 'react';
import { apiPost } from '../../api';

export default function EventClickModal({ event, onClose, onRefresh }) {
  // Extract priority, defaulting to 1 (Low) if it's missing or corrupted
  const initialPriority = Number.isFinite(Number(event?.priority)) ? Number(event.priority) : 1;
  
  // State to hold the value of the dropdown menu
  const [newPriority, setNewPriority] = useState(initialPriority);
  // State to disable buttons while waiting for the backend to respond
  const [isSaving, setIsSaving] = useState(false);
  const [inlineError, setInlineError] = useState('');

  // should this apply to duplicate events
  const [applyToAll, setApplyToAll] = useState(false);

  // Fires when the user clicks "Save Changes"
  const handleSave = async () => {
    setInlineError('');
    setIsSaving(true);
    try {
      // Send the update request to the backend WITH the new variables!
      await apiPost('/api/change-blocking-lvl', {
        event_id: event.id,
        priority: parseInt(newPriority, 10),
        apply_to_all: applyToAll, // Tell the backend if we are updating duplicates
        title: event.title        // Send the title to match against
      });
      
      // Tell the parent calendar to re-fetch the database
      onRefresh();
      // Close this modal
      onClose();
    } catch (error) {
      console.error("Failed to update priority", error);
      setInlineError('Failed to update blocking level.');
    } finally {
      setIsSaving(false);
    }
  };

  // Fires when the user clicks "Delete Event"
  const handleDelete = async () => {
    // Native browser prompt to prevent accidental deletions
    const confirmDelete = window.confirm(`Are you sure you want to delete "${event.title}"?`);
    if (!confirmDelete) return;

  setInlineError('');
    setIsSaving(true);
    try {
      // Send delete request to backend
      await apiPost('/api/delete-event', { event_id: event.id });
      onRefresh();
      onClose();
    } catch (error) {
      console.error("Failed to delete event", error);
      setInlineError('Failed to delete the event.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-shell" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{event.title}</h2>
          <button onClick={onClose} disabled={isSaving} className="cancel-btn" aria-label="Close event modal">
            &times;
          </button>
        </div>

        <div className="modal-body">
          <p><strong>Start:</strong> {event.start.toLocaleString()}</p>
          <p><strong>End:</strong> {event.end.toLocaleString()}</p>
          <p><strong>Current Priority:</strong> {
            initialPriority === 3 ? 'High' :
            initialPriority === 2 ? 'Med' :
            initialPriority === 1 ? 'Low' : initialPriority
          }</p>

          <div className="event-modal-field">
            <label htmlFor="event-priority-select"><strong>Change Blocking Level:</strong></label>
            <select
              id="event-priority-select"
              value={newPriority}
              onChange={(e) => setNewPriority(e.target.value)}
              className="event-modal-select"
              disabled={isSaving}
            >
              <option value={1}>Low (Optional)</option>
              <option value={2}>Medium (Flexible)</option>
              <option value={3}>High (Immovable)</option>
            </select>
          </div>

          {/* Only show the "Apply to All" option for standard blocking events */}
          {event.mode === 'normal' && (
            <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input 
                type="checkbox" 
                id="applyToAll" 
                checked={applyToAll} 
                onChange={(e) => setApplyToAll(e.target.checked)} 
                style={{ cursor: 'pointer' }}
              />
              <label htmlFor="applyToAll" style={{ fontSize: '13px', color: '#4b5563', cursor: 'pointer' }}>
                Update all my events named <strong>"{event.title}"</strong>
              </label>
            </div>
          )}

          {inlineError ? <p className="modal-inline-error">{inlineError}</p> : null}
        </div>

        <div className="modal-actions-row">
          <button
            onClick={handleDelete}
            disabled={isSaving}
            className="modal-btn-muted"
          >
            Delete Event
          </button>
          <button className="modal-btn-success" onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}