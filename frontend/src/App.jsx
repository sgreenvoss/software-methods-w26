/*
App.jsx
This app connects the user login, creation, and main page and determines which to present to the user
Created 2026-2-12 by Anna Norris
This file is part of the frontend
The Username Creation redirect was added after initial file creation
*/

import React, { useState, useEffect, useContext } from 'react';
import { apiGet } from './api.js';
import Login from './Login.jsx';
import Main from './Main.jsx';
import UsernameCreation from './UsernameCreation.jsx';
import { ErrorProvider, ErrorContext } from './ErrorContext.jsx';
import ServerError from './pages/ServerError.jsx';


function AppContent() {
    /* 
    Manager that loads the pages presented to the user.
    */

    // states
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState(null);
    const { error, setError } = useContext(ErrorContext);

    // check if user is logged in
    useEffect(() => {
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

// Main App component with ErrorProvider wrapper
export default function App() {
    return (
        <ErrorProvider>
            <AppContent />
        </ErrorProvider>
    );
}