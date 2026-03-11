/*
NotAuthenticated.jsx
Error page for authentication error
Created on 2026-3-6 by Anna Norris
*/

import React from 'react';

// page for authentication error
export default function ServerError({ message }) {
  return (
    <div className="error-page">
      <div className="error-container">
        <h1>401</h1>
        <h2>Authentication Error</h2>
        <p>{message || 'Something went wrong with Authentication.'}</p>
        <a href="/" className="error-button">Go Home</a>
      </div>
    </div>
  );
}