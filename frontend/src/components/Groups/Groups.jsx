import React, { useState, useEffect } from 'react';
import { apiGet, apiPost } from '../../api.js';
import GroupCreatorModal from './GroupCreator.jsx';
import '../../css/groups.css';
import '../../css/groupsModal.css';

export default function Groups( {onSelectGroup} ) {
    const [groups, setGroups] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [loading, setLoading] = useState(true);

    // Function to fetch groups (replaces the initial apiGet)
    const fetchGroups = async () => {
        setLoading(true);
        try {
            const response = await apiGet('/user/groups');
            if (response && response.groups) {
                setGroups(response.groups);
            } else {
                setGroups([]);
            }
        } catch (error) {
            console.error("Failed to fetch groups", error);
            setGroups([]);
        } finally {
            setLoading(false);
        }
    };

    // Load groups when component mounts
    useEffect(() => {
        fetchGroups();
    }, []);

    const handleLeaveGroup = async (groupId) => {
        console.log("leaving group", groupId);
        try {
            await apiPost("/group/leave", { groupId: groupId });
            // Refresh list after leaving
            fetchGroups();
        } catch (error) {
            console.error("Failed to leave group", error);
        }
    };

    const handleCreateSuccess = () => {
        // Refresh immediately after create success; modal remains open for invite sharing.
        fetchGroups();
    };

    const handleModalDone = () => {
        setShowModal(false);
    };

    return (
        // ID "groups" is crucial for matching css/groups.css selectors
        <section id="groups">
            <h2>My Groups</h2>

            <button onClick={() => setShowModal(true)}>
                + Create New Group
            </button>

            {loading ? <p>Loading...</p> : null}

            {groups.map((group) => (
                <div key={group.group_id} className="group-row">
                    <span>{group.group_name}</span>
                    
                    <div>
                        <button 
                            id="viewBtn" 
                            onClick={() => onSelectGroup(group.group_id)}
                        >
                            View
                        </button>
                        <button 
                            id="leaveBtn" 
                            onClick={() => handleLeaveGroup(group.group_id)}
                        >
                            Leave
                        </button>
                        <button 
                            id="availBtn" 
                            onClick={() => console.log("View availability for group", group.group_id)}
                        >
                            Calendar
                        </button>
                        <button 
                            id="petitionBtn" 
                            onClick={() => console.log("Create petition for group", group.group_id)}
                        >
                            Petition
                        </button>
                    </div>
                </div>
            ))}

            {/* Conditionally render the modal */}
            {showModal && (
                <GroupCreatorModal 
                    onClose={() => setShowModal(false)} 
                    onGroupCreated={handleCreateSuccess}
                    onDone={handleModalDone}
                />
            )}
        </section>
    );
}
