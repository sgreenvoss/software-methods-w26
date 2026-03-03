import React, { useEffect, useState } from 'react';
import { apiDeleteWithMeta, apiPostWithMeta } from '../../api';
import '../../css/calendar.css';

function formatDateTimeRange(event) {
  if (!event) return '';

  const start = new Date(event.start_time ?? event.start);
  const end = new Date(event.end_time ?? event.end);

  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
    return '';
  }

  const sameDay = start.toDateString() === end.toDateString();
  if (sameDay) {
    return `${start.toLocaleDateString()} ${start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} - ${end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  }

  return `${start.toLocaleString()} - ${end.toLocaleString()}`;
}

const LEVEL_OPTIONS = [
  { value: 'B1', label: 'Soft (B1)', help: 'Blocks only in Strict Availability' },
  { value: 'B2', label: 'Important (B2)', help: 'Blocks in Strict and Flexible' },
  { value: 'B3', label: 'Hard (B3)', help: 'Blocks in Strict, Flexible, and Lenient' }
];

export default function GoogleEventPriorityModal({
  open,
  event,
  onClose,
  onActionComplete
}) {
  const [selectedLevel, setSelectedLevel] = useState('B2');
  const [submitting, setSubmitting] = useState(false);
  const [inlineError, setInlineError] = useState('');

  useEffect(() => {
    if (open) {
      setSelectedLevel(event?.blockingLevel || 'B2');
      setInlineError('');
    }
  }, [open, event]);

  if (!open || !event) {
    return null;
  }

  const eventId = event.event_id ?? event.id;
  const currentLevel = event.blockingLevel ?? 'B2';
  const isManualBlock = event.isManualBlock === true;

  const handleSave = async () => {
    try {
      setSubmitting(true);
      setInlineError('');

      const result = await apiPostWithMeta(`/api/events/${eventId}/priority`, {
        blockingLevel: selectedLevel
      });

      if (result.status !== 200) {
        setInlineError(result?.data?.error || 'Failed to update event priority.');
        return;
      }

      onActionComplete();
    } catch (error) {
      console.error('Failed to save event priority:', error);
      setInlineError('Failed to update event priority.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    try {
      setSubmitting(true);
      setInlineError('');

      const result = await apiDeleteWithMeta(`/api/events/${eventId}`);
      if (result.status !== 200) {
        setInlineError(result?.data?.error || 'Failed to delete busy block.');
        return;
      }

      onActionComplete();
    } catch (error) {
      console.error('Failed to delete busy block:', error);
      setInlineError('Failed to delete busy block.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="event-priority-modal-backdrop" onClick={onClose}>
      <div className="event-priority-modal" onClick={(e) => e.stopPropagation()}>
        <div className="event-priority-modal-header">
          <h3>{event.titleRaw || event.title || 'Event Priority'}</h3>
          <button className="event-priority-modal-close" onClick={onClose} disabled={submitting}>
            ×
          </button>
        </div>

        <div className="event-priority-modal-body">
          <p><strong>When:</strong> {formatDateTimeRange(event)}</p>
          <p><strong>Current priority:</strong> {LEVEL_OPTIONS.find((option) => option.value === currentLevel)?.label || currentLevel}</p>

          <div className="event-priority-options">
            {LEVEL_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`event-priority-option ${selectedLevel === option.value ? 'active' : ''}`}
                onClick={() => setSelectedLevel(option.value)}
                disabled={submitting}
              >
                <span>{option.label}</span>
                <small>{option.help}</small>
              </button>
            ))}
          </div>

          {inlineError ? (
            <p className="event-priority-inline-error">{inlineError}</p>
          ) : null}
        </div>

        <div className="event-priority-modal-actions">
          <button className="petition-secondary-btn" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          {isManualBlock ? (
            <button className="petition-danger-btn" onClick={handleDelete} disabled={submitting}>
              {submitting ? 'Deleting...' : 'Delete'}
            </button>
          ) : null}
          <button className="petition-accept-btn" onClick={handleSave} disabled={submitting}>
            {submitting ? 'Saving...' : 'Save Priority'}
          </button>
        </div>
      </div>
    </div>
  );
}
