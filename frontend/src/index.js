/*
index.js
The root of the React app so that frontend is built
Created 2026-2-12 by Anna Norris
*/

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

const root = ReactDOM.createRoot(document.getElementById('root'));
// renders the app in React
root.render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
)