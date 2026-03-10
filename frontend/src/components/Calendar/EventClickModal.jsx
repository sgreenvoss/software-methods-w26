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

  // Fires when the user clicks "Save Changes"
  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Send the update request to the backend
      await apiPost('/api/change-blocking-lvl', {
        event_id: event.id,
        priority: parseInt(newPriority, 10)
      });
      // Tell the parent calendar to re-fetch the database
      onRefresh();
      // Close this modal
      onClose();
    } catch (error) {
      console.error("Failed to update priority", error);
      alert("Failed to update blocking level.");
    } finally {
      setIsSaving(false);
    }
  };

  // Fires when the user clicks "Delete Event"
  const handleDelete = async () => {
    // Native browser prompt to prevent accidental deletions
    const confirmDelete = window.confirm(`Are you sure you want to delete "${event.title}"?`);
    if (!confirmDelete) return;

    setIsSaving(true);
    try {
      // Send delete request to backend
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
      <div className="modal-content" style={{ maxWidth: '500px', width: '90%', padding: '24px' }}>
        
        {/* Header and Details */}
        <h2 style={{ marginTop: 0 }}>{event.title}</h2>
        <p><strong>Start:</strong> {event.start.toLocaleString()}</p>
        <p><strong>End:</strong> {event.end.toLocaleString()}</p>
        
        {/* Human-readable Priority display */}
        <p><strong>Current Priority:</strong> {
          initialPriority === 3 ? "High" :
          initialPriority === 2 ? "Med" :
          initialPriority === 1 ? "Low" : initialPriority
        }</p>

        {/* The Dropdown Menu */}
        <div style={{ margin: '15px 0' }}>
          <label><strong>Change Blocking Level:</strong></label>
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

        {/* The Action Buttons */}
        <div className="modal-actions" style={{ display: 'flex', justifyContent: 'space-between' }}>
          <button
            onClick={handleDelete}
            disabled={isSaving}
            style={{ backgroundColor: '#d63031', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}
          >
            Delete Event
          </button>
          
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={onClose} disabled={isSaving}>Cancel</button>
            <button className="primary-btn" onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}