import React, { useState, useEffect } from 'react'
import { apiGet } from './api.js'
import Login from './Login.jsx'

export default function App() {
    // states
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState(null);

    // check if user is logged in
    useEffect(() => {
        const checkUser = async () => {
            try {
                const data = await apiGet('/api/me');
                if (data.user) {
                    console.log(data.user.username);
                    console.log(data.user.email);
                }
                setUser(data.user);
                setLoading(false); 
            } catch (error) {
                console.error('Error fetching user:', error);
                setLoading(false);
            }
        };
        checkUser();
    }, []);

    // check if we have to load
    // either go to login or to homepage
    if (user === null) {
        return <Login />
    } else {
        return <h1>Welcome, {user.username}!</h1>
    }
}