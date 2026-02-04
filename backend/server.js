// server.js
const express = require('express');
const { google } = require('googleapis');
import * as crypto from 'crypto';
const cors = require('cors')
require('dotenv').config();
const db = require("./db/index");
const session = require('express-session');


const app = express();
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave:false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    //sameSite: lax,
    maxAge: 24*60*60*1000
  }
}));

app.use(cors());
const PORT = process.env.PORT || 3000;
app.use(express.json());

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

const scopes = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile'
];

// Test route
app.get('/', (req, res) => {
  res.json({ message: 'Social Scheduler API is running!' });
});

// Database test route
app.get('/api/test-db', async (req, res) => {
  try {
    const result = await testConnection();
    res.json(result);
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

app.get('/auth/google', async (req, res) => {
//     // Generate a secure random state value.
  const state = crypto.randomBytes(32).toString('hex');
  // Store state in the session
  req.session.state = state;

  // Generate a url that asks permissions for the Drive activity and Google Calendar scope
  const authorizationUrl = oauth2Client.generateAuthUrl({

    access_type: 'offline',
    scope: scopes,
    // Enable incremental authorization. Recommended as a best practice.
    include_granted_scopes: true,
    // Include the state parameter to reduce the risk of CSRF attacks.
    state: state
  });
  res.redirect(authorizationUrl);
});

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
    res.redirect('https://scheduler-frontend-aasq.onrender.com/index.html'); 
  } catch (err) {
    console.error("Login failed", err);
    res.redirect('https://scheduler-frontend-aasq.onrender.com/error.html');
  }
});

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


app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  const res = db.getUsersWithName('stella');
  console.log(res);
  db.getUserWithID(2);
});