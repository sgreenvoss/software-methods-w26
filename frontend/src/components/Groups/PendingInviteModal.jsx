import React from "react";

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
