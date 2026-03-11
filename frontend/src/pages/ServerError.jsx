/*
ServerError.jsx
Error page for server error
Created on 2026-3-6 by Anna Norris
*/

import React from 'react';

// error page for server error
export default function ServerError({ message }) {
  return (
    <div className="error-page">
      <div className="error-container">
        <h1>500</h1>
        <h2>Server Error</h2>
        <p>{message || 'Something went wrong on the server.'}</p>
        <a href="/" className="error-button">Go Home</a>
      </div>
    </div>
  );
}