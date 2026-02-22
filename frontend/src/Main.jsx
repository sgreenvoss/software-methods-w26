import React, { useState, useEffect } from 'react';
import Calendar from './components/Calendar/CustomCalendar';
import Groups from './components/Groups/Groups';
import EventSidebar from './components/Calendar/EventSidebar';
import './css/main.css';
import {apiGet, apiPost} from './api';

export default function Main() {
    const [selectedGroupId, setSelectedGroupId] = useState(null);
    const [groupsList, setGroupsList] = useState([]); 
    // const [view, setView] = useState('calendar'); -- old 
    
    const [isGroupsSidebarOpen, setIsGroupsSidebarOpen] = useState(false);
    const [isEventSidebarOpen, setIsEventSidebarOpen] = useState(false);

    // live draft preview of event being created/edited.
    const [draftEvent, setDraftEvent] = useState(null);

    // 1. Move fetchGroups INSIDE so it can see setGroupsList
    const fetchGroups = async () => {
        try {
            // 1. Hit the ACTUAL endpoint
            const response = await apiGet('/user/groups'); 
            
            // 2. The backend returns { success: true, groups: [...] }
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
            await apiPost('/logout'); 
            window.location.href = '/logout'; 
        } catch (err) {
            window.location.href = '/logout'; 
        }
    };

    // 3. Effect calls the internal function
    useEffect(() => {
        fetchGroups();
    }, []);

    console.log("2. Main.jsx current selectedGroupId:", selectedGroupId);

    
    // Toggle the sidebar open/closed
    const toggleGroupsSidebar = () => {
        setIsGroupsSidebarOpen(!isGroupsSidebarOpen);
    }
    const toggleEventSidebar = () => {
        setIsEventSidebarOpen(!isEventSidebarOpen);
    }

    // displays two buttons that will bring up either Calendar or Group
    return (
        <div id="app-wrapper">
            <section id="logout">
                <button onClick={handleLogout} id="logoutBtn">Logout</button>
            </section>
            <header>
                <p id="logo">Social Schedule</p>
                <p id="beta">beta</p>
            </header>

            {/* <header>
                <button onClick={() => setView('groups')} id="groupsBtn">Group View</button>
                <button onClick={() => setView('calendar')} id="calendarBtn">Calendar View</button>
            </header> */}
            
            <section id="sidebarToggle">
                <button 
                    onClick={() => {
                        toggleGroupsSidebar();
                        if (isEventSidebarOpen) setIsEventSidebarOpen(false);
                    }} 
                    id="groupsBtn"
                    className={isGroupsSidebarOpen ? 'active-btn' : ''}
                >
                    {isGroupsSidebarOpen ? 'Hide Groups' : 'Show Groups'}
                </button>

                <button 
                    onClick={() => {
                        toggleEventSidebar();
                        if (isGroupsSidebarOpen) setIsGroupsSidebarOpen(false);
                    }} 
                    id="eventBtn"
                    className={isEventSidebarOpen ? 'active-btn' : ''}
                >
                    {isEventSidebarOpen ? 'Close Event' : 'Add Event'}
                </button>
            </section>

            {/* {view === 'calendar' ? <Calendar /> : <Groups />} */}
            <main className="main-layout">
                {/* The Groups sidebar. */}
                {isGroupsSidebarOpen && (
                    <aside className="groups-sidebar">
                        <Groups onSelectGroup={(id) => setSelectedGroupId(Number(id))}/>
                    </aside>
                )}

                {/* The Calendar always renders.*/}
                <section className="calendar-main">
                    <Calendar draftEvent={draftEvent} selectedGroupId={selectedGroupId}/>
                </section>

                {/* The Event sidebar, which is used for both creating and editing events. */}
                {isEventSidebarOpen && (
                    <aside className="event-sidebar">
                        <EventSidebar 
                            setDraftEvent={setDraftEvent} 
                            onFinalize={() => {
                                setIsEventSidebarOpen(false);
                                setDraftEvent(null);
                                // likely trigger a calendar refresh here
                                <Calendar draftEvent={draftEvent} selectedGroupId={selectedGroupId}/>
                            }}
                        />
                    </aside>
                )}

            </main>
        </div>
    );
}