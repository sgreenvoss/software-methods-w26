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
  
    const [eventMode, setEventMode] = useState('blocking');
    const [eventRefreshSignal, setEventRefreshSignal] = useState(0);
    const [petitionGroupId, setPetitionGroupId] = useState('');
    const [petitionRefreshSignal, setPetitionRefreshSignal] = useState(0);
    const [lastCreatedPetition, setLastCreatedPetition] = useState(null);
    const activeGroup = groupsList.find((group) => Number(group.group_id) === Number(selectedGroupId)) || null;
    

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
        fetchGroups();
        fetchPendingInvite();
    }, []);


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
        setSelectedGroupId(Number(groupId));
        setPetitionGroupId(String(groupId));
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
                            selectedGroupId={selectedGroupId}
                            onSelectGroup={(id) => setSelectedGroupId(id == null ? null : Number(id))}
                            onOpenPetition={handleOpenPetition} 
                            refreshSignal={groupsRefreshSignal}
                            onGroupsLoaded={(nextGroups) => {
                                setGroupsList(Array.isArray(nextGroups) ? nextGroups : []);
                            }}
                        />
                    </aside>
                )}

                {/* The Calendar always renders.*/}
                <section className="calendar-main">
                    {selectedGroupId !== null ? (
                        <div className="active-group-context">
                            Viewing availability for: <strong>{activeGroup?.group_name || `Group ${selectedGroupId}`}</strong>
                        </div>
                    ) : null}
                    <Calendar
                        draftEvent={draftEvent}
                        groupId={selectedGroupId}
                        eventRefreshSignal={eventRefreshSignal}
                        onEventMutation={() => setEventRefreshSignal((v) => v + 1)}
                        petitionRefreshSignal={petitionRefreshSignal}
                        lastCreatedPetition={lastCreatedPetition}
                    />
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
                            onFinalize={({ mode, createdPetition, createdEvent }) => {
                                if (mode === 'petition' && createdPetition) {
                                    setLastCreatedPetition(createdPetition);
                                    setPetitionRefreshSignal((v) => v + 1);
                                }
                                if (mode === 'blocking' && createdEvent) {
                                    setEventRefreshSignal((v) => v + 1);
                                }
                                setIsEventSidebarOpen(false);
                                setDraftEvent(null);
                                fetchGroups();
                                setGroupsRefreshSignal((v) => v + 1);
                            }}
                        />
                    </aside>
                )}

            </main>
        </div>
    );
}
