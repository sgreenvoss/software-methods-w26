/*
PetitionActionModal.jsx
Renders and controls the petition action modal, allowing users to view 
petition details, submit accept/decline responses, or delete a petition 
when they are the creator.
Created on 2026-03-01 by David Haddad

This file is part of the frontend petition feature in the application.
Presents petition information to users.
*/

/*
Library: react
Purpose: Provides component rendering and React Hooks used for local state and lifecycle side effects.
Reason Included: This file is a functional React UI component that needs `useState` and `useEffect`.
*/
import React, { useEffect, useState } from 'react';

/*
Stylesheet: ../../css/calendar.css
Purpose: Provides shared modal and calendar-related styling classes used by this component.
Reason Included: Petition modal class names in this file rely on CSS rules defined in this stylesheet.
*/
import '../../css/calendar.css';

/**
 * Safely reads JSON from a fetch Response only when the response is JSON.
 *
 * @param {Response} response - Fetch response object to inspect and parse.
 * @returns {Promise<object|null>|null} Parsed JSON payload (possibly as a Promise) when content type is JSON; otherwise null.
 */
function getJsonOrNull(response) {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return null;
  }
  return response.json();
}

/**
 * Builds a user-friendly date/time range string from petition time fields.
 *
 * @param {object} petition - Petition object containing start/end values (`start_time`, `start`, `startMs`, `end_time`, `end`, `endMs`).
 * @returns {string} Formatted date/time range, or an empty string when dates are missing/invalid.
 */
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

/**
 * Petition action modal component for viewing details and taking petition actions.
 *
 * @param {object} props - Component props.
 * @param {boolean} props.open - Controls whether the modal is visible.
 * @param {object|null} props.petition - Petition payload used to render metadata and current status.
 * @param {number|string|null} props.currentUserId - Current authenticated user id, used to determine creator privileges.
 * @param {Function} props.onClose - Callback invoked when the modal should close.
 * @param {Function} props.onActionComplete - Callback invoked after a successful accept/decline/delete action.
 * @returns {JSX.Element|null} Modal JSX when open with a petition; otherwise null.
 */
export default function PetitionActionModal({
  open,
  petition,
  currentUserId,
  onClose,
  onActionComplete
}) {
  const [submitting, setSubmitting] = useState(false);
  const [inlineError, setInlineError] = useState('');

  /**
   * Clears inline error state whenever the modal closes or petition context changes.
   *
   * @returns {void}
   */
  useEffect(() => {
    if (!open) {
      setInlineError('');
    }
  }, [open, petition]);

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

  /**
   * Derives the current user's response label from normalized response values.
   *
   * @returns {string} "Accepted", "Declined", or an empty string when no response is present.
   */
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

  /**
   * Sends an accept/decline response for the current petition.
   *
   * @param {'ACCEPT'|'DECLINE'} responseValue - Participant decision submitted to the API.
   * @returns {Promise<void>} Resolves after updating UI state and invoking completion callback on success.
   */
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

  /**
   * Deletes the current petition when invoked by its creator.
   *
   * @returns {Promise<void>} Resolves after API completion and UI state updates.
   */
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

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-shell" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="cancel-btn" onClick={onClose} disabled={submitting}>
            ×
          </button>
        </div>

        <div className="modal-body">
          <p><strong>Group:</strong> {groupName || `Group ${petition.groupId ?? petition.group_id}`}</p>
          <p><strong>When:</strong> {formatDateTimeRange(petition)}</p>
          <p><strong>Status:</strong> {status}</p>
          <p><strong>Responses:</strong> {acceptedCount} accepted / {declinedCount} declined / {hasKnownGroupSize ? `${groupSize} total` : 'total unknown'}</p>
          <p><strong>Pending:</strong> {hasKnownGroupSize ? pendingCount : 'unknown'}</p>
          {currentResponseLabel ? (
            <p><strong>Your response:</strong> {currentResponseLabel}</p>
          ) : null}
          {inlineError ? (
            <p className="modal-inline-error">{inlineError}</p>
          ) : null}
        </div>

        <div className="modal-actions-row">
          {isCreator ? (
            <button
              className="modal-btn-muted"
              onClick={handleDelete}
              disabled={submitting}
            >
              Delete Petition
            </button>
          ) : (
            <>
              <button
                className="modal-btn-success"
                onClick={() => handleRespond('ACCEPT')}
                disabled={participantButtonsDisabled}
              >
                {acceptLabel}
              </button>
              <button
                className="modal-btn-danger"
                onClick={() => handleRespond('DECLINE')}
                disabled={participantButtonsDisabled}
              >
                {declineLabel}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
