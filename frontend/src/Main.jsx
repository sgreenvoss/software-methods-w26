/*
Main.jsx
Handles the main page of the app, parent of calendar component
Initially created 2026-2-12 by Anna Norris
Updated extensively to handle petitions, group, and time blocks by all developers
*/

import React, { useState, useEffect, useContext } from 'react';
import Calendar from './components/Calendar/CustomCalendar';
import Groups from './components/Groups/Groups';
import PendingInviteModal from './components/Groups/PendingInviteModal';
import EventSidebar from './components/Calendar/EventSidebar';
import { ErrorContext } from './ErrorContext';
import './css/main.css';
import {apiGet, apiPost} from './api';
import ResizableSidebar from './components/ResizeableSidebar';

export default function Main() {
    // groups
    const [selectedGroupId, setSelectedGroupId] = useState(null);
    const [groupsList, setGroupsList] = useState([]); 

    // refresh signals
    const [groupsRefreshSignal, setGroupsRefreshSignal] = useState(0);
    const [calRefreshSignal, setCalRefreshSignal] = useState(0);
    
    //sidebars
    const [isGroupsSidebarOpen, setIsGroupsSidebarOpen] = useState(false);
    const [isEventSidebarOpen, setIsEventSidebarOpen] = useState(false);

    //invites
    const [pendingInvite, setPendingInvite] = useState(null);
    const [inviteActionLoading, setInviteActionLoading] = useState(false);
    const [inviteError, setInviteError] = useState('');

    // live draft preview of event being created/edited.
    const [draftEvent, setDraftEvent] = useState(null);

    // State to hold the autofill data from a calendar click
    const [clickedCellDetails, setClickedCellDetails] = useState(null);

    // username info
    const [username, setUsername] = useState(null);

    // Move fetchGroups INSIDE so it can see setGroupsList
    const [eventMode, setEventMode] = useState('blocking');
    const [petitionGroupId, setPetitionGroupId] = useState('');

    // error handling
    const { setError } = useContext(ErrorContext);


    const handleCalendarCellClick = (clickedDate, hour) => {
        /*
        The handler we will pass down to the Calendar
        Arguments are the date user clicks and the hour they clicked on
        Opens group sidebar and sets the details of clicked cell
        */

        // Format the date as YYYY-MM-DD
        const year = clickedDate.getFullYear();
        const month = String(clickedDate.getMonth() + 1).padStart(2, '0');
        const day = String(clickedDate.getDate()).padStart(2, '0');
        const dateString = `${year}-${month}-${day}`;

        // Format the hours as HH:00
        const startHour = String(hour).padStart(2, '0');
        // If they click 11 PM (23), make the end time 00:00 (Midnight)
        const endHour = String((hour + 1) % 24).padStart(2, '0');

        setClickedCellDetails({
            date: dateString,
            startTime: `${startHour}:00`,
            endTime: `${endHour}:00`
        });

        // targetMode is undefined, removing for now
        // setEventMode(targetMode);

        // instantly auto-fill the dropdown with that group's ID!
        if (selectedGroupId) {
            setPetitionGroupId(selectedGroupId);
        }

        // If the sidebar is closed, snap it open!
        if (!isEventSidebarOpen) {
            setIsEventSidebarOpen(true);
            setIsGroupsSidebarOpen(false);
        }
    };

    const handleDraftDrop = (droppedDate, startHour, startMin) => {
        /* 
        Handles the drag-and-drop of the draft event
        Arguments are the date, start hour and minute
        Overwrites sidebar inputs with clicked event
        */
        if (!draftEvent) return;

        // Calculate the current duration of the event in milliseconds
        const durationMs = draftEvent.end.getTime() - draftEvent.start.getTime();

        // Create the exact new Start Date object
        const newStart = new Date(droppedDate);
        newStart.setHours(startHour, startMin, 0, 0);

        // Create the new End Date object by adding the duration to the new start time
        const newEnd = new Date(newStart.getTime() + durationMs);

        // Format everything back into the strings the EventSidebar requires
        const year = newStart.getFullYear();
        const month = String(newStart.getMonth() + 1).padStart(2, '0');
        const day = String(newStart.getDate()).padStart(2, '0');
        
        const sHour = String(newStart.getHours()).padStart(2, '0');
        const sMin = String(newStart.getMinutes()).padStart(2, '0');
        
        const eHour = String(newEnd.getHours()).padStart(2, '0');
        const eMin = String(newEnd.getMinutes()).padStart(2, '0');

        // Instantly overwrite the sidebar form inputs!
        setClickedCellDetails({
            date: `${year}-${month}-${day}`,
            startTime: `${sHour}:${sMin}`,
            endTime: `${eHour}:${eMin}`,
            _ts: Date.now() // Force the update
        });
    };

    const fetchEvents = async () => {
        /* 
        grab all of the events using api/events on login
        no arguments, gets events and refreshes calendar
        */
        try {
            // get events from endpoint
            await apiGet('/api/events');
            // refresh the calednar
            setCalRefreshSignal((prev) => prev + 1);
        } catch (error) {
            // set error if fails
            console.error('Error loading events:', error);
            setError(err.message);
        }
    }

    const fetchGroups = async () => {
        /*
        fetch all of the groups for user
        no arguments, updates the list of groups for user
        */
        try {
            // Hit the ACTUAL endpoint
            const response = await apiGet('/user/groups'); 
            
            // The backend returns { success: true, groups: [...] }
            // We need to extract the groups array specifically.
            if (response && response.success && Array.isArray(response.groups)) {
                setGroupsList(response.groups);
            } else {
                setGroupsList([]);
            }
        } catch (err) {
            // error if fail to group fails
            console.error("Groups fetch failed", err);
            setGroupsList([]);
            setError(err.message);
        }
    };

    const fetchPendingInvite = async () => {
        /*
        fetch any pending invites from clicking on shared link
        no arguments, sets pending invite based on json response
        */
        try {
            // find if user has a pending invite
            const response = await apiGet('/api/group-invite/pending');
            // if user does, set the invitation
            if (response && response.ok && response.hasPendingInvite && response.invite) {
                setPendingInvite(response.invite);
            } else {
                setPendingInvite(null);
            }
        } catch (err) {
            // handle any errors
            console.error("Pending invite fetch failed", err);
            setPendingInvite(null);
            setError(err.message);
        }
    };

    const handleLogout = async () => {
        /*
        handle user logging out by clicking button
        no arguments, user's window redirected using logout
        */
        try {
            await apiPost('/logout'); 
            window.location.href = '/logout'; 
        } catch (err) {
           window.location.href = '/login';
        }
    };

    // fetch user info
    const fetchUsername = async () => {
        /*
        handle fetching username to display on main page
        no arguments, sets the username for main page to display
        */
        try {
            // get username and set it to display
            const me = await apiGet('/api/me');
            setUsername(me.user.username);
        } catch (err) {
            // handle errors
            console.error("Fetching user info failed:", err);
            setError(err.message);
        }
    };

    useEffect(() => {
        /*
        Immediately upon page load, fetch all existing user events, groups, invites, and username
        */
        fetchUsername();
        fetchEvents();
        fetchGroups();
        fetchPendingInvite();
    }, []);


    useEffect(() => {
        // Automatically clear the ghost draft event if the sidebar gets closed
        if (!isEventSidebarOpen) {
            setDraftEvent(null);
            setClickedCellDetails(null); // Clear the autofill data too!
        }
    }, [isEventSidebarOpen]);

    // Toggle the sidebar open/closed
    const toggleGroupsSidebar = () => {
        setIsGroupsSidebarOpen(!isGroupsSidebarOpen);
    }
    const toggleEventSidebar = () => {
        setIsEventSidebarOpen(!isEventSidebarOpen);
    }

    const handleInviteDecision = async (decision) => {
        /* 
        handles whether a user accepts or declines an invitation
        argument is accept or decline
        if accept, app refetches groups
        */
        setInviteActionLoading(true);
        setInviteError('');
        try {
            // get the response from user
            const response = await apiPost('/api/group-invite/respond', { decision });
            if (response && response.ok) {
                setPendingInvite(null);
                // if user accepts, refetch groups with new group added and refresh
                if (decision === 'accept') {
                    fetchGroups();
                    setGroupsRefreshSignal((v) => v + 1);
                }
            } else {
                // handle errors
                setInviteError(response?.error || 'Could not process invite decision.');
            }
        } catch (err) {
            console.error("Failed to submit invite decision", err);
            setInviteError('Could not process invite decision.');
        } finally {
            setInviteActionLoading(false);
        }
    };
    
    const handleOpenPetition = async (groupId) => {
        // Keep petition target and rendered availability group in sync.
        await fetchGroups();

        setSelectedGroupId(Number(groupId));
        setEventMode('petition');
        setPetitionGroupId(groupId);
        setIsGroupsSidebarOpen(false); // Close groups sidebar
        setIsEventSidebarOpen(true);   // Open event sidebar
    };

    const handleSyncCals = async () => {
        /*
        Synchronize google calendar events and existing events, and petitions/timeblocks 
        no arguments, refreshes calendar after resyncing with api/events endpoint
        */
        try {
            await apiGet('/api/events');
        } catch (error) {
            console.warn('Sync calendars endpoint failed; forcing UI refresh anyway.', error);
        } finally {
            setCalRefreshSignal((prev) => prev + 1);
        }
    }


    // displays two buttons that will bring up either Calendar or Group
    return (
        <div id="app-wrapper">
            {/* invite modal is loaded with shareable link*/}
            <PendingInviteModal
                invite={pendingInvite}
                loading={inviteActionLoading}
                error={inviteError}
                onAccept={() => handleInviteDecision('accept')}
                onDecline={() => handleInviteDecision('decline')}
            />
            
            {/* management buttons and username display*/}
            <section id="manButtons">
                <p>It's {username}'s schedule!</p>
                <button id="syncCals" onClick={handleSyncCals}>Sync Calendars</button>
                <button id="logout" onClick={handleLogout}>Logout</button>
            </section>

            {/* logo */}
            <header>
                <p id="logo">Social Schedule</p>
                <p id="beta">beta</p>
            </header>

            {/* Toggle for groups and events sidebars */}
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
                    <ResizableSidebar side="left" defaultWidth={320} minWidth={250} maxWidth={600} className="main-sidebar">
                        <Groups
                            selectedGroupId={selectedGroupId}
                            onSelectGroup={(id) => setSelectedGroupId(id == null ? null : Number(id))}
                            onOpenPetition={handleOpenPetition} 
                            refreshSignal={groupsRefreshSignal}
                        />
                    </ResizableSidebar>
                )}

                {/* The Calendar always renders.*/}
                <section className="calendar-main">
            <div className="calendar-home-panel">
                <Calendar 
                    refreshTrigger={calRefreshSignal} 
                    draftEvent={draftEvent} 
                    groupId={selectedGroupId}
                    onCellClick={handleCalendarCellClick}
                    onDraftDrop={handleDraftDrop}
                />
            </div>
        </section>

                {/* The Event sidebar, which is used for both creating and editing events. */}
                {isEventSidebarOpen && (
                    <ResizableSidebar side="right" defaultWidth={350} minWidth={280} maxWidth={600} className="main-sidebar">
                        <EventSidebar 
                            setDraftEvent={setDraftEvent}
                            mode={eventMode}
                            setMode={setEventMode}
                            petitionGroupId={petitionGroupId}
                            setPetitionGroupId={setPetitionGroupId}
                            groupsList={groupsList} // pass groups for dorpdown
                            clickedCellDetails={clickedCellDetails}
                            onFinalize={() => {
                                setIsEventSidebarOpen(false);
                                setDraftEvent(null);
                                setCalRefreshSignal((prev) => prev + 1);
                            }}
                        />
                    </ResizableSidebar>
                )}

            </main>
        </div>
    );
}
