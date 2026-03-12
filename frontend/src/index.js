/*
File: index.js
Purpose: Bootstraps the React frontend by creating the root mount point and rendering the top-level App component.
Creation Date: 2026-02-12
Initial Author(s): Anna Norris

System Context:
This file is part of the Social Schedule frontend entrypoint layer. It is the
browser startup file that connects the React component tree to the DOM element
provided by the static HTML shell.
*/

/*
Library: react
Purpose: Provides core React runtime and `StrictMode` wrapper for development checks.
Reason Included: Needed to render the JSX component tree and enable strict-mode diagnostics.
*/
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

// Create a React root bound to the HTML container node with id="root".
const root = ReactDOM.createRoot(document.getElementById('root'));
// Render the application tree wrapped in StrictMode for additional development checks.
root.render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
)