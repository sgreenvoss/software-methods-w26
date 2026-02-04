// vibe coded with gemini

require("dotenv").config();

const express = require("express");
const path = require("path");
const { google } = require('googleapis');
const crypto = require('crypto');
const session = require('express-session');
const url = require('url');

const app = express();
const PORT = 8080;

// --- Configuration ---

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

const scopes = [
  'https://www.googleapis.com/auth/calendar.readonly'
];


// Serve frontend folder
app.use(express.static(path.join(__dirname, "..", "frontendv2")));

// Session setup (Critical for storing auth tokens per user)
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-key', 
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // Set to true if using https
}));

// --- Routes ---

// 1. Auth Trigger: Redirect user to Google
app.get('/auth/google', (req, res) => {
  const state = crypto.randomBytes(32).toString('hex');
  req.session.state = state;

  const authorizationUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline', // key for getting a refresh token
    scope: scopes,
    include_granted_scopes: true,
    state: state
  });

  res.redirect(authorizationUrl);
});

// 2. Auth Callback: Google redirects back here
app.get('/oauth2callback', async (req, res) => {
  const q = url.parse(req.url, true).query;

  // Security checks
  if (q.error) return res.redirect('/error.html');
  if (q.state !== req.session.state) return res.redirect('/error.html');

  try {
    const { tokens } = await oauth2Client.getToken(q.code);
    
    // IMPORTANT: Save tokens to the SESSION, not a global variable
    req.session.tokens = tokens; 

    // Redirect to your main app
    res.redirect('/index.html'); 
  } catch (err) {
    console.error("Login failed", err);
    res.redirect('/error.html');
  }
});

// 3. API Endpoint: Fetch and Format Calendar Data
app.get("/api/events", async (req, res) => {
  // Check if user is logged in
  if (!req.session.tokens) {
    return res.status(401).json({ error: "User not authenticated" });
  }

  // Set credentials for this specific request using session data
  oauth2Client.setCredentials(req.session.tokens);

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  try {
    // Fetch next 10 events from the primary calendar
    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: new Date().toISOString(), // From now onwards
      maxResults: 10,
      singleEvents: true, // Expands recurring events into individual instances
      orderBy: 'startTime',
    });

    const events = response.data.items;
    
    if (!events || events.length === 0) {
      return res.json([]);
    }

    // Map Google's complex object to your simple JSON format
    const formattedEvents = events.map((event) => {
      // Handle "All Day" events which use .date instead of .dateTime
      const start = event.start.dateTime || event.start.date;
      const end = event.end.dateTime || event.end.date;

      return {
        title: event.summary || "No Title",
        start: start,
        end: end
      };
    });

    // Send the transient JSON data to frontend
    res.json(formattedEvents);

  } catch (error) {
    console.error('Error fetching calendar', error);
    
    // If token expired/invalid, might want to clear session
    if (error.code === 401) {
        req.session.tokens = null;
    }
    res.status(500).json({ error: "Failed to fetch events" });
  }
});

// --- Server Start ---

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});