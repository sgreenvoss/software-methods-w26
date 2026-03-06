import React, { useEffect, useState } from 'react';
import '../../css/calendar.css';

function getJsonOrNull(response) {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return null;
  }
  return response.json();
}

function formatDateTimeRange(petition) {
  if (!petition) return '';

  const startVal = petition.start_time ?? petition.start ?? petition.startMs;
  const endVal = petition.end_time ?? petition.end ?? petition.endMs;

  const start = typeof startVal === 'number'
    ? new Date(startVal)
    : new Date(Date.parse(startVal));

  const end = typeof endVal === 'number'
    ? new Date(endVal)
    : new Date(Date.parse(endVal));

  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
    return '';
  }

  const sameDay = start.toDateString() === end.toDateString();
  if (sameDay) {
    return `${start.toLocaleDateString()} ${start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} - ${end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  }
  return `${start.toLocaleString()} - ${end.toLocaleString()}`;
}

export default function PetitionActionModal({
  open,
  petition,
  currentUserId,
  onClose,
  onActionComplete
}) {
  const [submitting, setSubmitting] = useState(false);
  const [inlineError, setInlineError] = useState('');

  useEffect(() => {
    if (!open) {
      setInlineError('');
    }
  }, [open, petition]);

  useEffect(() => {
    if (!open) return undefined;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !submitting) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, submitting, onClose]);

  if (!open || !petition) {
    return null;
  }

  const petitionId = Number(
    petition.petitionId ??
    petition.petition_id ??
    petition.id
  );

  const creatorId = Number(
    petition.createdByUserId ??
    petition.created_by_user_id ??
    petition.created_by_person_id
  );

  const currentUserIdNum = currentUserId == null ? NaN : Number(currentUserId);
  const isCreator = typeof petition.is_creator === 'boolean'
    ? petition.is_creator
    : typeof petition.isCreator === 'boolean'
      ? petition.isCreator
    : (Number.isFinite(currentUserIdNum) && Number.isFinite(creatorId) && creatorId === currentUserIdNum);

  const currentUserResponse =
    petition.currentUserResponse ??
    petition.current_user_response ??
    null;

  const normalizedCurrentUserResponse = String(currentUserResponse || '').toUpperCase();

  const acceptedCount = Number(
    petition.acceptedCount ??
    petition.accepted_count ??
    0
  );
  const declinedCount = Number(
    petition.declinedCount ??
    petition.declined_count ??
    0
  );
  const groupSize = Number(
    petition.groupSize ??
    petition.group_size ??
    0
  );

  const computedStatus =
    declinedCount > 0
      ? 'FAILED'
      : (groupSize > 0 && acceptedCount === groupSize)
        ? 'ACCEPTED_ALL'
        : 'OPEN';

  const status = typeof petition.status === 'string' && petition.status.trim()
    ? petition.status
    : computedStatus;

  const groupName = petition.groupName ?? petition.group_name ?? '';
  const title = petition.titleRaw ?? petition.title ?? 'Petition';

  const hasKnownGroupSize = Number.isFinite(groupSize) && groupSize > 0;
  const pendingCount = hasKnownGroupSize
    ? Math.max(groupSize - acceptedCount - declinedCount, 0)
    : null;

  const hasResponded =
    normalizedCurrentUserResponse === 'ACCEPTED' ||
    normalizedCurrentUserResponse === 'DECLINED' ||
    normalizedCurrentUserResponse === 'ACCEPT' ||
    normalizedCurrentUserResponse === 'DECLINE';

  const participantButtonsDisabled = submitting || status !== 'OPEN' || hasResponded;

  const currentResponseLabel = (() => {
    if (normalizedCurrentUserResponse === 'ACCEPTED' || normalizedCurrentUserResponse === 'ACCEPT') {
      return 'Accepted';
    }
    if (normalizedCurrentUserResponse === 'DECLINED' || normalizedCurrentUserResponse === 'DECLINE') {
      return 'Declined';
    }
    return '';
  })();

  const acceptLabel = currentResponseLabel === 'Accepted' ? 'Accept (Selected)' : 'Accept';
  const declineLabel = currentResponseLabel === 'Declined' ? 'Decline (Selected)' : 'Decline';

  const handleRespond = async(responseValue) => {
    try {
      setSubmitting(true);
      setInlineError('');

      const response = await fetch(`/api/petitions/${petitionId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ response: responseValue })
      });

      const data = await getJsonOrNull(response);
      if (!response.ok) {
        setInlineError(data?.error || 'Failed to update petition response.');
        return;
      }

      onActionComplete();
    } catch (error) {
      console.error('Petition response failed:', error);
      setInlineError('Failed to update petition response.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async() => {
    try {
      setSubmitting(true);
      setInlineError('');

      const response = await fetch(`/api/petitions/${petitionId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      const data = await getJsonOrNull(response);
      if (!response.ok) {
        setInlineError(data?.error || 'Failed to delete petition.');
        return;
      }

      onActionComplete();
    } catch (error) {
      console.error('Petition delete failed:', error);
      setInlineError('Failed to delete petition.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBackdropClose = () => {
    if (!submitting) {
      onClose();
    }
  };

  return (
    <div className="petition-modal-backdrop" onClick={handleBackdropClose}>
      <div className="petition-modal" onClick={(e) => e.stopPropagation()}>
        <div className="petition-modal-header">
          <h3>{title}</h3>
          <button className="petition-modal-close" onClick={onClose} disabled={submitting}>
            ×
          </button>
        </div>

        <div className="petition-modal-body">
          <p><strong>Group:</strong> {groupName || `Group ${petition.groupId ?? petition.group_id}`}</p>
          <p><strong>When:</strong> {formatDateTimeRange(petition)}</p>
          <p><strong>Status:</strong> {status}</p>
          <p><strong>Responses:</strong> {acceptedCount} accepted / {declinedCount} declined / {hasKnownGroupSize ? `${groupSize} total` : 'total unknown'}</p>
          <p><strong>Pending:</strong> {hasKnownGroupSize ? pendingCount : 'unknown'}</p>
          {currentResponseLabel ? (
            <p><strong>Your response:</strong> {currentResponseLabel}</p>
          ) : null}
          {inlineError ? (
            <p className="petition-inline-error">{inlineError}</p>
          ) : null}
        </div>

        <div className="petition-modal-actions">
          {isCreator ? (
            <button
              className="petition-danger-btn"
              onClick={handleDelete}
              disabled={submitting}
            >
              Delete Petition
            </button>
          ) : (
            <>
              <button
                className="petition-accept-btn"
                onClick={() => handleRespond('ACCEPT')}
                disabled={participantButtonsDisabled}
              >
                {acceptLabel}
              </button>
              <button
                className="petition-decline-btn"
                onClick={() => handleRespond('DECLINE')}
                disabled={participantButtonsDisabled}
              >
                {declineLabel}
              </button>
            </>
          )}
          <button className="petition-secondary-btn" onClick={onClose} disabled={submitting}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
