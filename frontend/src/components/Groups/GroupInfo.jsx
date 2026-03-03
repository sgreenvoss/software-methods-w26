import React, { useState, useEffect } from 'react';
import { apiGet, apiPost } from '../../api.js';
// Reuse the same modal CSS you already have
import '../../css/groupsModal.css'; 

export default function GroupInfoModal({ groupId, groupName, onClose }) {
    const [loading, setLoading] = useState(true);
    const [members, setMembers] = useState([]);
    const [inviteLink, setInviteLink] = useState("");
    const [copyStatus, setCopyStatus] = useState("idle"); // "idle", "success", "error"
    
    useEffect(() => {
        const loadGroupDetails = async () => {
            setLoading(true);
            try {
                await makeInviteLink();
                const response = await apiGet(`/group/${groupId}`);
                if (response && response.success) {
                    setMembers(response.members);
                }
            } catch (error) {
                console.error("Error loading group details:", error);
            } finally {
                setLoading(false);
            }
        };

        if (groupId) {
            loadGroupDetails();
        }
    }, [groupId]);

    useEffect(() => {
        let timeoutId;
        if (copyStatus === 'success' || copyStatus === 'error') {
            timeoutId = setTimeout(() => {
                setCopyStatus('idle');
            }, 2000); // Reset status after 2 seconds -- also allows for cutoff if close modal
        }
        return () => {
            if (timeoutId) clearTimeout(timeoutId);
        };
    }, [copyStatus]);

    // this is copied from the GroupCreator.
    const handleCopyClick = async () => {
        if (!inviteLink) {
            setCopyStatus("error");
            return;
        }

        setCopyStatus("copying");
        try {
            await navigator.clipboard.writeText(inviteLink);
            setCopyStatus("success");
        } catch (err) {
            console.error("Failed to copy!", err);
            setCopyStatus("error");
        }
    };

    const makeInviteLink = async () => {
        setCopyStatus("idle");
        const inviteResponse = await apiPost("/group/invite", {
            group_id: groupId
        });

        if (inviteResponse.invite) {
            setInviteLink(inviteResponse.invite)
        } 

    }

    return (
        <div className="modal-overlay">
            <div className="modal-content modal-content-scrollable">
                <div className="modal-header sticky-modal-header">
                    <h2>{groupName || 'Group'} Info</h2>
                    <button className="modal-close-btn" onClick={onClose} aria-label="Close group info">
                        ×
                    </button>
                </div>

                <div className="modal-scroll-body">
                    <h3>Members:</h3>
                    {loading ? (
                        <p>Loading members...</p>
                    ) : (
                        <ul style={{ paddingLeft: '20px', margin: '10px 0' }}>
                            {members.length > 0 ? (
                                members.map((member) => (
                                    <li key={member.user_id} style={{ marginBottom: '5px' }}>
                                        {member.username}
                                    </li>
                                ))
                            ) : (
                                <p>No members found.</p>
                            )}
                        </ul>
                    )}
                    <div className="invite-link-container" style={{ display: 'flex', gap: '10px', margin: '20px 0' }}>
                        <input
                            type="text"
                            value={inviteLink}
                            readOnly
                            style={{ flex: 1, padding: '8px' }}
                        />
                        <button
                            onClick={handleCopyClick}
                            disabled={!inviteLink || copyStatus === 'copying'}
                        >
                            {copyStatus === 'success' ? 'Copied!' : 
                            copyStatus === 'error' ? 'Error' : 'Copy'}
                        </button>
                    </div>

                    <h3>How availability works:</h3>
                    <div style={{ margin: '10px 0' }}>
                        <p>Availability View affects what counts as busy when computing availability.</p>
                        <p>Priority affects how an event or petition is treated under each view.</p>
                        <p>Lenient respects Hard only, Flexible respects Important + Hard, Strict respects Soft + Important + Hard.</p>
                    </div>

                    <h3>Invites and syncing:</h3>
                    <div style={{ margin: '10px 0' }}>
                        <p>Inviting new members can temporarily change availability results until their calendars sync.</p>
                        <p>If results look wrong after inviting someone, refresh after sync completes.</p>
                        <p>Availability depends on each member’s synced calendar events, petitions, and future event blocks.</p>
                    </div>
                </div>

                <div className="modal-actions">
                    <button className="primary-btn" onClick={onClose}>
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
