// requirements
const express = require('express');
const { google } = require('googleapis');
const crypto = require('crypto');
const path = require("path");
const db = require("./db/index");
const session = require('express-session');
const url = require('url');
const cors = require('cors')

// .env config
require('dotenv').config({
  path: process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development'
});
console.log("ENV:", process.env.NODE_ENV);
console.log("Frontend URL:", process.env.FRONTEND_URL);

const frontend = process.env.FRONTEND_URL;
const app = express();


app.use(cors({
  credentials:true, 
  origin: process.env.FRONTEND_URL
}));

// Serve frontend in development mode
if (process.env.NODE_ENV !== "production") {
  app.use(express.static(path.join(__dirname, "..", "frontend"), { index: false }));
}


const isProduction = process.env.NODE_ENV === 'production';
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave:false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'none',
    secure: isProduction,
    domain: '.onrender.com',
    maxAge: 24*60*60*1000
  }
}));

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

app.get('/login', (req, res) => {
  // If already logged in, send them to the app
  if (req.session.tokens) {
    return res.redirect('/');
  }
  res.sendFile(path.join(__dirname, "..", "frontend", "login.html"));
});


app.get('/', (req, res) => {
  // Check if user has tokens
  if (req.session.tokens) {
    // Authorized: Serve the main app
    res.sendFile(path.join(__dirname, "..", "frontend", "index.html"));
  } else {
    // Unauthorized: Send them to login
    res.redirect('/login');
  }
});


app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return console.log(err);
    }
    res.redirect('/login');
  });
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
// Generate a secure random state value.
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
  if (q.error) {
    console.log(q);
    return res.redirect(frontend + '/error.html');
  }

  console.log(q);
  console.log(q.code);

  try {
    const { tokens } = await oauth2Client.getToken(q.code);
    
    // IMPORTANT: Save tokens to the SESSION, not a global variable
    req.session.tokens = tokens; 

    // Redirect to your main app
    req.session.save((saveErr) => {
      if (saveErr) {
        // Something went wrong (e.g., database died, session store full)
        console.error("Session Save Error:", saveErr);
        return res.redirect('/login?error=save_failed');
      }

      // everything worked!
      res.redirect('/');
    });
     
  } catch (authErr) {
    console.error("Login failed", authErr);
    res.redirect('/error.html');
  }
});

app.get("/api/events", async (req, res) => {
  console.log('Session ID:', req.sessionID);
  console.log('Session data:', req.session);
  console.log('Tokens in session:', req.session.tokens);
  // Check if user is logged in
  if (!req.session.tokens) {
    return res.status(401).json({ error: "User not authenticated" });
  }

  // Set credentials for this specific request using session data
  oauth2Client.setCredentials(req.session.tokens);

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  try {
    // Fetch next 50 events from the primary calendar

    const calendarStart = new Date();

    calendarStart.setDate(calendarStart.getDate() - 14);

    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: calendarStart.toISOString(), // From now onwards
      maxResults: 50,
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



app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  
});