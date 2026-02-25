import React, { useState, useEffect } from 'react';
import { apiGet } from '../../api.js';
// Reuse the same modal CSS you already have
import '../../css/groupsModal.css'; 

export default function GroupInfoModal({ groupId, groupName, onClose }) {
    const [loading, setLoading] = useState(true);
    const [members, setMembers] = useState([]);

    useEffect(() => {
        const loadGroupDetails = async () => {
            setLoading(true);
            try {
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

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                {/* Fallback to 'Group' if name isn't passed */}
                <h2>{groupName || 'Group'} Info</h2> 
                
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

                <div className="modal-actions">
                    <button className="primary-btn" onClick={onClose}>
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}