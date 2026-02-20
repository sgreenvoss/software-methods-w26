import React, { useState } from 'react';
import { apiPost } from '../../api';
import CreateGroupModal from './GroupCreator';

// We add 'refreshGroups' to the props so the child can tell the parent to update
    // added setView fix 02-20 1.2
    // changed to setMainView fix 02-20 1.4
export default function Groups({ setSelectedGroup, groups = [], refreshGroups, setMainView }) {
    const safeGroups = Array.isArray(groups) ? groups : [];
    const [view, setView] = useState('list');

    const handleLeaveGroup = async (groupId) => {
        try {
            await apiPost('/group/leave', { groupId: groupId });
            // Instead of fetchGroups(), we call the prop from Main.jsx
            if (refreshGroups) refreshGroups(); 
        } catch (error) {
            console.error('Error leaving group:', error);
        }
    }

// Adjust the call to match your groups.js backend
    const handleGroupCreation = async (name) => {
        try {
            // Your backend uses req.query, so the name goes in the URL
            const response = await apiPost(`/group/creation?group_name=${name}`);
            if (response.success) {
                refreshGroups(); // Refresh the list in Main.jsx
            }
        } catch (error) {
            console.error("Group creation failed", error);
        }
    };

    // DELETE: useEffect(() => { fetchGroups(); }, []);
    // DELETE: const fetchGroups = async () => { ... }

    return (
        <div className="groups-container">
            <button onClick={() => setView('creategroupmodal')}>Create New Group</button>
            {groups.map(group => (
                <div key={group.group_id} className="group-item">
                    <h3>{group.group_name}</h3>
                    <button onClick={() => {
                        console.log("RAW GROUP OBJECT:", group);
                        setSelectedGroup(group.group_id);
                        setMainView('calendar'); // Switch to calendar view after selecting a group fix 02-20 1.4
                    }}>
                        View Availability
                    </button>
                    <button onClick={() => handleLeaveGroup(group.group_id)}>
                        Leave
                    </button>
                </div>
            ))}

            {view === 'creategroupmodal' && (
                <CreateGroupModal 
                    isOpen={view === 'creategroupmodal'}
                    onClose={() => setView('list')}
                    onGroupCreated={handleGroupCreation}
                />
            )}
        </div>
    );
}