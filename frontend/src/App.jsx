/*
File: App.jsx
Purpose: Determines which top-level screen to render (login, username creation,
main app, or server error) based on authenticated user state and global errors.
Creation Date: 2026-02-12
Initial Author(s): Anna Norris

System Context:
This file is part of the Social Schedule frontend application shell. It is the
application composition root that wires global error context and conditionally
routes users through authentication/onboarding into the main product interface.

Significant Modifications:
- Added username-creation redirect path for newly authenticated users.
*/

/*
Library: react
Purpose: Provides component rendering and Hooks for state, effects, and context.
Reason Included: This file defines functional React components that manage app-level rendering state.
*/
import React, { useState, useEffect, useContext } from 'react';

/* API helper for fetching the currently authenticated user profile. */
import { apiGet } from './api.js';

/* Top-level page components rendered conditionally by user/app state. */
import Login from './Login.jsx';
import Main from './Main.jsx';
import UsernameCreation from './UsernameCreation.jsx';

/* Global error context provider and consumer used for cross-app error routing. */
import { ErrorProvider, ErrorContext } from './ErrorContext.jsx';

/* Error page rendered when an unrecoverable app-level error is present. */
import ServerError from './pages/ServerError.jsx';


/**
 * Internal app router/content component that resolves the correct page to display.
 *
 * @returns {JSX.Element} Login, onboarding, main app, loading, or server error UI.
 */
function AppContent() {
    // states
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState(null);
    const { error, setError } = useContext(ErrorContext);

    /**
     * Loads current user once and updates local/auth error state.
     *
     * @returns {void}
     */
    useEffect(() => {
        /**
         * Fetches `/api/me` and stores the authenticated user payload.
         *
         * @returns {Promise<void>} Resolves after user loading and loading-state cleanup.
         */
        const checkUser = async () => {
            try {
                const data = await apiGet('/api/me');
                setUser(data.user);
            } catch (error) {
                console.error('Error fetching user:', error);
                setError(error.message || 'Failed to load user');
            } finally {
                setLoading(false);
            }
        };
        checkUser();
    }, [setError]);

    // Show error page if there's an error
    if (error) {
        return <ServerError message={error} />;
    }

    // check if we have to load
    // either go to login, homepage, or username creation
    if (loading) {
        return <div>Loading...</div>
    }
    if (!user) {
        return <Login />
    }
    if (user.username === "New user!") {
        return <UsernameCreation />
    }
    return <Main />
}

/**
 * App entry component that wraps routed content in the global error provider.
 *
 * @returns {JSX.Element} Provider-wrapped application content.
 */
export default function App() {
    return (
        <ErrorProvider>
            <AppContent />
        </ErrorProvider>
    );
}