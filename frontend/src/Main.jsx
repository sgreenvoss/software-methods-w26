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
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    const [eventMode, setEventMode] = useState('blocking');
    const [petitionGroupId, setPetitionGroupId] = useState('');
    

    // grab all of the events using api/events on login
    const fetchEvents = async () => {
        try {
            await apiGet('/api/events');
        } catch (error) {
            console.error('Error loading events:', error);
        }
    };

    const fetchGroups = async () => {
        try {
            const response = await apiGet('/user/groups'); 
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

    const toggleGroupsSidebar = () => {
        setIsGroupsSidebarOpen(!isGroupsSidebarOpen);
    };

    const toggleEventSidebar = () => {
        setIsEventSidebarOpen(!isEventSidebarOpen);
    };

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
            
            <section id="sidebarToggle">
                <button 
                    onClick={() => {
                        toggleGroupsSidebar();
                        // TEAMNOTE[availability-persistence]: Sidebar toggles must not clear selected group availability context.
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
                {isGroupsSidebarOpen && (
                    <aside className="groups-sidebar">
                        <Groups
                            selectedGroupId={selectedGroupId}
                            // TEAMNOTE[availability-persistence]: Only explicit group-row hide should clear this parent-owned selection.
                            onSelectGroup={(id) => setSelectedGroupId(id == null ? null : Number(id))}
                            onOpenPetition={handleOpenPetition} 
                            refreshSignal={groupsRefreshSignal}
                        />
                    </aside>
                )}

                <section className="calendar-main">
                    <Calendar 
                        draftEvent={draftEvent} 
                        groupId={selectedGroupId}
                        refreshTrigger={refreshTrigger}
                    />
                </section>

                {isEventSidebarOpen && (
                    <aside className="event-sidebar">
                        <EventSidebar 
                            setDraftEvent={setDraftEvent}
                            mode={eventMode}
                            setMode={setEventMode}
                            petitionGroupId={petitionGroupId}
                            setPetitionGroupId={setPetitionGroupId}
                            groupsList={groupsList}
                            onFinalize={() => {
                                setIsEventSidebarOpen(false);
                                setDraftEvent(null);
                                setRefreshTrigger(prev => prev + 1);
                            }}
                        />
                    </aside>
                )}

            </main>
        </div>
    );
}
