import React, { useState } from 'react';
import './css/login.css';
// handles login
export default function Login() {
    
    const handleLogin = () => {
      const back_url = process.env.REACT_APP_BACKEND_URL || '';
      window.location.href = `${back_url}/auth/google`;
    };

    return (
        <>
        <div className="login-container">
          <header>
            <p id="logo">Social Scheduler</p>
            <p id="beta">beta</p>
          </header>

          <section id="auth">
            <button id="loginBtn" onClick={handleLogin}>Continue with Google</button>
          </section>
        </div>
        </>
    );
}