/**
 * File: PendingInviteModal.jsx
 * Purpose: Modal for presenting a pending group invitation and allowing the user to accept or decline it
 * Date Created: 2026-02-23
 * Initial Author(s): David Haddad
 *
 * System Context:
 * Renders as a blocking overlay when the application detects an outstanding group invitation for the
 * authenticated user. Displays the invited group's name, shows any invitation-processing error, and
 * exposes accept and decline actions passed in from the parent container.
 */

// React import - required for rendering the modal component and JSX
import React from "react";

/**
 * Displays a modal prompting the user to respond to a pending group invitation.
 * Hides itself when no invite is available and disables actions while a response is being processed.
 *
 * @param {Object} props - Component props
 * @param {Object|null} props.invite - Pending invite data object containing information about the invited group
 * @param {string} props.invite.groupName - Name of the group the user was invited to join
 * @param {boolean} props.loading - Whether the accept/decline request is currently in progress
 * @param {string|null} props.error - Error message to display if invite processing fails
 * @param {function} props.onAccept - Callback triggered when the user accepts the invitation
 * @param {function} props.onDecline - Callback triggered when the user declines the invitation
 * @returns {JSX.Element|null} Invitation modal overlay, or null when there is no pending invite
 */
export default function PendingInviteModal({
  invite,
  loading,
  error,
  onAccept,
  onDecline
}) {
  if (!invite) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 2000
      }}
    >
      <div
        style={{
          width: "min(460px, 92vw)",
          backgroundColor: "#fff",
          borderRadius: "12px",
          padding: "20px",
          boxShadow: "0 12px 28px rgba(0,0,0,0.25)"
        }}
      >
        <h2 style={{ marginTop: 0 }}>Group Invitation</h2>
        <p>
          You were invited to join <strong>{invite.groupName}</strong>.
        </p>
        {error ? (
          <p style={{ color: "red", marginTop: "8px" }}>{error}</p>
        ) : null}
        <div
          style={{
            display: "flex",
            gap: "10px",
            justifyContent: "flex-end",
            marginTop: "20px"
          }}
        >
          <button onClick={onDecline} disabled={loading}>
            Decline
          </button>
          <button onClick={onAccept} disabled={loading}>
            {loading ? "Working..." : "Accept"}
          </button>
        </div>
      </div>
    </div>
  );
}
