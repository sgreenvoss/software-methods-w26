import React, { useState, useEffect } from 'react';
import Calendar from './components/Calendar/CustomCalendar';
import Groups from './components/Groups/Groups';
import PendingInviteModal from './components/Groups/PendingInviteModal';
import EventSidebar from './components/Calendar/EventSidebar';
import './css/main.css';
import {apiGet, apiPost} from './api';

export default function Main() {
    const [selectedGroupId, setSelectedGroupId] = useState(null);
    const [groupsList, setGroupsList] = useState([]); 
    const [groupsRefreshSignal, setGroupsRefreshSignal] = useState(0);
    // const [view, setView] = useState('calendar'); -- old 
    
    const [isGroupsSidebarOpen, setIsGroupsSidebarOpen] = useState(false);
    const [isEventSidebarOpen, setIsEventSidebarOpen] = useState(false);
    const [pendingInvite, setPendingInvite] = useState(null);
    const [inviteActionLoading, setInviteActionLoading] = useState(false);
    const [inviteError, setInviteError] = useState('');

    // live draft preview of event being created/edited.
    const [draftEvent, setDraftEvent] = useState(null);
  
    // 1. Move fetchGroups INSIDE so it can see setGroupsList
    const [eventMode, setEventMode] = useState('blocking');
    const [petitionGroupId, setPetitionGroupId] = useState('');
    

    // grab all of the events using api/events on login
    const fetchEvents = async () => {
        try {
            await apiGet('/api/events');
        } catch (error) {
            console.error('Error loading events:', error);
        }
    }

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

    const fetchPendingInvite = async () => {
        try {
            const response = await apiGet('/api/group-invite/pending');
            if (response && response.ok && response.hasPendingInvite && response.invite) {
                setPendingInvite(response.invite);
            } else {
                setPendingInvite(null);
            }
        } catch (err) {
            console.error("Pending invite fetch failed", err);
            setPendingInvite(null);
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

    useEffect(() => {
        fetchEvents();
        fetchGroups();
        fetchPendingInvite();
    }, []);

    console.log("2. Main.jsx current selectedGroupId:", selectedGroupId);


    // Toggle the sidebar open/closed
    const toggleGroupsSidebar = () => {
        setIsGroupsSidebarOpen(!isGroupsSidebarOpen);
    }
    const toggleEventSidebar = () => {
        setIsEventSidebarOpen(!isEventSidebarOpen);
    }

    const handleInviteDecision = async (decision) => {
        setInviteActionLoading(true);
        setInviteError('');
        try {
            const response = await apiPost('/api/group-invite/respond', { decision });
            if (response && response.ok) {
                setPendingInvite(null);
                if (decision === 'accept') {
                    fetchGroups();
                    setGroupsRefreshSignal((v) => v + 1);
                }
            } else {
                setInviteError(response?.error || 'Could not process invite decision.');
            }
        } catch (err) {
            console.error("Failed to submit invite decision", err);
            setInviteError('Could not process invite decision.');
        } finally {
            setInviteActionLoading(false);
        }
    };
    
    const handleOpenPetition = (groupId) => {
        setEventMode('petition');
        setPetitionGroupId(groupId);
        setIsGroupsSidebarOpen(false); // Close groups sidebar
        setIsEventSidebarOpen(true);   // Open event sidebar
    };

    // displays two buttons that will bring up either Calendar or Group
    return (
        <div id="app-wrapper">
            <PendingInviteModal
                invite={pendingInvite}
                loading={inviteActionLoading}
                error={inviteError}
                onAccept={() => handleInviteDecision('accept')}
                onDecline={() => handleInviteDecision('decline')}
            />
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
                        setSelectedGroupId(null);
                    }} 
                    id="groupsBtn"
                    className={isGroupsSidebarOpen ? 'active-btn' : ''}
                >
                    {isGroupsSidebarOpen ? 'Hide Groups' : 'Show Groups'}
                </button>

                <button 
                    onClick={() => {
                        toggleEventSidebar();
                        if (!isEventSidebarOpen) {
                            setEventMode('blocking');
                            setPetitionGroupId('');
                        }

                        if (isGroupsSidebarOpen) setIsGroupsSidebarOpen(false);
                    }} 
                    id="eventBtn"
                    className={isEventSidebarOpen ? 'active-btn' : ''}
                >
                    {isEventSidebarOpen ? 'Close Event' : 'Add Event'}
                </button>
            </section>

            <main className="main-layout">
                {/* The Groups sidebar. */}
                {isGroupsSidebarOpen && (
                    <aside className="groups-sidebar">
                        <Groups
                            onSelectGroup={(id) => setSelectedGroupId(Number(id))}
                            onOpenPetition={handleOpenPetition} 
                            refreshSignal={groupsRefreshSignal}
                        />
                    </aside>
                )}

                {/* The Calendar always renders.*/}
                <section className="calendar-main">
                    <Calendar draftEvent={draftEvent} groupId={selectedGroupId}/>
                </section>

                {/* The Event sidebar, which is used for both creating and editing events. */}
                {isEventSidebarOpen && (
                    <aside className="event-sidebar">
                        <EventSidebar 
                            setDraftEvent={setDraftEvent}
                            mode={eventMode}
                            setMode={setEventMode}
                            petitionGroupId={petitionGroupId}
                            setPetitionGroupId={setPetitionGroupId}
                            groupsList={groupsList} // pass groups for dorpdown
                            onFinalize={() => {
                                setIsEventSidebarOpen(false);
                                setDraftEvent(null);
                                // trigger a calendar refresh here
                                <Calendar draftEvent={draftEvent} selectedGroupId={selectedGroupId}/>
                            }}
                        />
                    </aside>
                )}

            </main>
        </div>
    );
}
