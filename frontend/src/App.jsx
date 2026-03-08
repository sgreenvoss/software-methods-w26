import React, { useState, useEffect, useContext } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react';
import { apiGet } from './api.js';
import Login from './Login.jsx';
import Main from './Main.jsx';
import UsernameCreation from './UsernameCreation.jsx';
import InviteHandler from './components/Groups/InviteHandler.jsx';
import { ErrorProvider, ErrorContext } from './ErrorContext.jsx';
import ServerError from './pages/ServerError.jsx';


// Inner component that uses ErrorContext
function AppContent() {
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
    // either go to login or to homepage
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