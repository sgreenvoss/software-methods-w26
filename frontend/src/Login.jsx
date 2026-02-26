import React, { useState, useEffect } from 'react';
import './css/login.css';
// handles login
export default function Login() {
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get('error');

    if (error === "calendar_permissions_required") {
      setErrorMsg("Please grant calendar permissions to access this app.")
    }
  }, []);

  const handleLogin = () => {
      // fix localhost redirect issues with different frontend/backend ports
      const baseURL = process.env.BACKEND_URL || '';
      window.location.href = `${baseURL}/auth/google`;
  };

  return (
      <>
      <div className="login-container">
        {errorMsg && <p style={{color: 'red'}}>{errorMsg}</p>}
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