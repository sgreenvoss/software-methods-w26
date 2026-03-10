import React, { useState, useEffect } from 'react';
import { apiGet, apiPost } from '../../api.js';
// Reuse the same modal CSS you already have
import '../../css/groupsModal.css'; 

export default function GroupInfoModal({ groupId, groupName, onClose }) {
    const [loading, setLoading] = useState(true);
    const [members, setMembers] = useState([]);
    const [inviteLink, setInviteLink] = useState("");
    const [copyStatus, setCopyStatus] = useState("idle");
    

    useEffect(() => {
        const loadGroupDetails = async () => {
            setLoading(true);
            try {
                const response = await apiGet(`/group/${groupId}`);
                if (response && response.success) {
                    setMembers(response.members);
                }
                await makeInviteLink()
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
            setInviteLink('https://' + inviteResponse.invite)
        } 

    }


    return (
        <div className="modal-overlay">
            <div className="modal-content">
                {/* Fallback to 'Group' if name isn't passed */}
                <h2 className="modal-title">{groupName || 'Group'} Info</h2> 
                
                <h3 className="modal-label members-title">Members</h3>
                {loading ? (
                    <p className="modal-description">Loading members...</p>
                ) : (
                    <ul className="member-list">
                        {members.length > 0 ? (
                            members.map((member) => (
                                <li key={member.user_id} className="member-list-item">
                                    {member.username}
                                </li>
                            ))
                        ) : (
                            <li className="member-list-empty">No members found.</li>
                        )}
                    </ul>
                )}
                <h3 className="modal-label members-title">Invite new members</h3>
                <div className="invite-link-container">
                        <input
                            type="text"
                            value={inviteLink}
                            readOnly
                            className="invite-link-input"
                        />
                        <button
                            className="secondary-btn invite-copy-btn"
                            onClick={handleCopyClick}
                            disabled={!inviteLink || copyStatus === 'copying'}
                        >
                            {copyStatus === 'success' ? 'Copied!' : 
                            copyStatus === 'error' ? 'Error' : 'Copy'}
                        </button>
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