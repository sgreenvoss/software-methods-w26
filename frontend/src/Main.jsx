import React, { useState, useEffect } from 'react';
import { apiGet, apiPost } from './api'; // Ensure apiPost is imported
import CustomCalendar from './components/Calendar/CustomCalendar';
import Groups from './components/Groups/Groups';

export default function Main() {
    const [view, setView] = useState('calendar');
    const [selectedGroupId, setSelectedGroupId] = useState(null);
    const [groupsList, setGroupsList] = useState([]); 

    // 1. Move fetchGroups INSIDE so it can see setGroupsList
    const fetchGroups = async () => {
        try {
            // 1. Hit your ACTUAL endpoint
            const response = await apiGet('/user/groups'); 
            
            // 2. Your backend returns { success: true, groups: [...] }
            // We need to extract the groups array specifically.
            if (response && response.success && Array.isArray(response.groups)) {
                setGroupsList(response.groups);
            } else {
                setGroupsList([]);
            }
        } catch (err) {
            console.error("Groups fetch failed", err);
            setGroupsList([]);
        }
    };

    // 2. Move handleLogout INSIDE
    const handleLogout = async () => {
        try {
            await apiPost('/api/logout'); 
            window.location.href = '/login'; 
        } catch (err) {
            window.location.href = '/login'; 
        }
    };

    // 3. Effect calls the internal function
    useEffect(() => {
        fetchGroups();
    }, []);

    return (
        <div>
            <nav className="main-nav">
                <button onClick={() => setView('calendar')}>My Calendar</button>
                <button onClick={() => setView('groups')}>Group View</button>
                <button onClick={() => handleLogout()}>Logout</button> 
            </nav>

            {view === 'calendar' ? (
                <CustomCalendar groupId={selectedGroupId} /> 
            ) : (
                <Groups 
                    groups={groupsList} 
                    setSelectedGroup={setSelectedGroupId}
                    refreshGroups={fetchGroups} 
                />
            )}
        </div>
    );
}