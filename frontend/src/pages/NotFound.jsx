/*
NotFound.jsx
Error page for no existing page
Created on 2026-3-6 by Anna Norris
*/

import React from 'react';

// page for 404 error
export default function NotFound() {
    return (
        <div className="error-page">
        <div className="error-container">
            <h1>404</h1>
            <h2>Page Not Found</h2>
            <p>The page you're looking for doesn't exist.</p>
            <a href="/" className="error-button">Go Home</a>
        </div>
        </div>
  );
}