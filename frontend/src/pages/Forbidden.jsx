/*
Forbidden.jsx
Error page for 403 error
Created on 2026-3-6 by Anna Norris
*/

import React from 'react';

// displays the page for user attempting to access forbidden info
export default function Forbidden() {
  return (
    <div className="error-page">
      <div className="error-container">
        <h1>403</h1>
        <h2>Access Denied</h2>
        <p>You don't have permission to access this resource.</p>
        <a href="/" className="error-button">Go Home</a>
      </div>
    </div>
  );
}