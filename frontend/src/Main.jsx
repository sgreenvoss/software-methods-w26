/*
File: Main.jsx
Purpose: Defines the primary authenticated application view and coordinates calendar,
groups, invitations, and event-creation sidebars.
Creation Date: 2026-02-12
Initial Author(s): Anna Norris

System Context:
This file is part of the Social Schedule frontend application. It acts as the
container/orchestrator page that wires together major UI modules (calendar,
group management, petition flow, and invite handling) and shared state updates.
*/

/*
Library: react
Purpose: Provides component rendering and state/effect/context hooks.
Reason Included: Main is a React functional component that manages app-level UI state.
*/
import React, { useState, useEffect, useContext } from 'react';

/* UI modules used by Main to compose the primary page layout and flows. */
import Calendar from './components/Calendar/CustomCalendar';
import Groups from './components/Groups/Groups';
import PendingInviteModal from './components/Groups/PendingInviteModal';
import EventSidebar from './components/Calendar/EventSidebar';
import { ErrorContext } from './ErrorContext';

/* Global page styles for main layout, sidebars, and controls. */
import './css/main.css';
import './css/zindex.css';
import {apiGet, apiPost} from './api';

/* Reusable container that provides draggable width adjustment for sidebars. */
import ResizableSidebar from './components/ResizeableSidebar';

/**
 * Main authenticated application container.
 *
 * @returns {JSX.Element} Full page layout containing management controls,
 * groups sidebar, calendar, and event sidebar.
 */
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


    /**
     * Handles calendar cell selection and pre-fills event form values.
     *
     * @param {Date} clickedDate - Date value for the selected calendar cell.
     * @param {number} hour - Hour-of-day (0-23) selected in the calendar grid.
     * @returns {void}
     */
    const handleCalendarCellClick = (clickedDate, hour) => {

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

        setEventMode(targetMode);

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

    /**
     * Repositions the in-progress draft event and syncs sidebar form fields.
     *
     * @param {Date} droppedDate - Target date where the draft event was dropped.
     * @param {number} startHour - New start hour for the draft event.
     * @param {number} startMin - New start minute for the draft event.
     * @returns {void}
     */
    const handleDraftDrop = (droppedDate, startHour, startMin) => {
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

    /**
     * Loads calendar events from the backend and triggers a calendar refresh.
     *
     * @returns {Promise<void>} Resolves after the fetch attempt and refresh handling.
     */
    const fetchEvents = async () => {
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

    /**
     * Loads the current user's groups and stores them in local state.
     *
     * @returns {Promise<void>} Resolves after group state is updated or reset on error.
     */
    const fetchGroups = async () => {
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

    /**
     * Fetches any pending invite associated with the current user session.
     *
     * @returns {Promise<void>} Resolves after pending invite state is set or cleared.
     */
    const fetchPendingInvite = async () => {
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

    /**
     * Logs out the current user and redirects to logout/login routes.
     *
     * @returns {Promise<void>} Resolves when logout flow and redirect decision are complete.
     */
    const handleLogout = async () => {
        try {
            await apiPost('/logout'); 
            window.location.href = '/logout'; 
        } catch (err) {
           window.location.href = '/login';
        }
    };

    /**
     * Retrieves the authenticated user's profile and stores display username.
     *
     * @returns {Promise<void>} Resolves after username state is updated.
     */
    const fetchUsername = async () => {
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

    /**
     * Initial data bootstrap effect for username, events, groups, and pending invites.
     *
     * @returns {void}
     */
    useEffect(() => {
        fetchUsername();
        fetchEvents();
        fetchGroups();
        fetchPendingInvite();
    }, []);


    /**
     * Clears transient draft UI state when the event sidebar closes.
     *
     * @returns {void}
     */
    useEffect(() => {
        // Automatically clear the ghost draft event if the sidebar gets closed
        if (!isEventSidebarOpen) {
            setDraftEvent(null);
            setClickedCellDetails(null); // Clear the autofill data too!
        }
    }, [isEventSidebarOpen]);

    /**
     * Toggles the groups sidebar open/closed state.
     *
     * @returns {void}
     */
    const toggleGroupsSidebar = () => {
        setIsGroupsSidebarOpen(!isGroupsSidebarOpen);
    }

    /**
     * Toggles the event sidebar open/closed state.
     *
     * @returns {void}
     */
    const toggleEventSidebar = () => {
        setIsEventSidebarOpen(!isEventSidebarOpen);
    }

    /**
     * Submits an invitation response and updates invite/group state accordingly.
     *
     * @param {'accept'|'decline'} decision - User's invitation decision.
     * @returns {Promise<void>} Resolves after API processing and UI state updates.
     */
    const handleInviteDecision = async (decision) => {
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
    
    /**
     * Opens petition creation flow for a selected group and syncs dependent state.
     *
     * @param {number|string} groupId - Group identifier to associate with the petition.
     * @returns {Promise<void>} Resolves after state synchronization and sidebar transitions.
     */
    const handleOpenPetition = async (groupId) => {
        // Keep petition target and rendered availability group in sync.
        await fetchGroups();

        setSelectedGroupId(Number(groupId));
        setEventMode('petition');
        setPetitionGroupId(groupId);
        setIsGroupsSidebarOpen(false); // Close groups sidebar
        setIsEventSidebarOpen(true);   // Open event sidebar
    };

    /**
     * Synchronizes calendar data and forces a calendar refresh regardless of API outcome.
     *
     * @returns {Promise<void>} Resolves after sync attempt and refresh signal update.
     */
    const handleSyncCals = async () => {
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
