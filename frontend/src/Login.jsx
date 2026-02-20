import React, { useState } from 'react';
import './css/login.css';

// handles login
export default function Login() {
    const [error, setError] = useState('');
    
    const handleLogin = () => {
        window.location.href = `/auth/google`;
    };

    return (
        <>
        <div className="login-container">
          <header>
            <p id="logo">Social Scheduler</p>
            <p id="beta">beta</p>
          </header>

          <section id="signUp">
            <label htmlFor="username">Username:</label>
            {error && <p style={{color: 'red'}}>{error}</p>}
          </section>

          <section id="auth">
            <button id="loginBtn" onClick={handleLogin}>Continue with Google</button>
          </section>
        </div>
        </>
    );
}