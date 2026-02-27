const express = require('express');
const cors = require('cors'); // gemini assisted fix for CORS issues
const { google } = require('googleapis');
const crypto = require('crypto');
const path = require("path");
const cookieParser = require("cookie-parser");
// Local imports for DB and email and groups
const db = require("./db/dbInterface");
const session = require('express-session');
const url = require('url');
const pgSession = require('connect-pg-simple')(session);
const email = require('./emailer'); 
const groupModule = require("./groups");

// Algoritihm inports
const { fetchAndMapGroupEvents } = require('./algorithm/algorithm_adapter');
const { computeAvailabilityBlocksAllViews } = require('./algorithm/algorithm');
// Load the .env file, determine whether on production or local dev
require('dotenv').config({
  path: process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development'
});
console.log("Database URL Check:", process.env.DATABASE_URL ? "Found it!" : "It is UNDEFINED");

console.log("ENV:", process.env.NODE_ENV);
console.log("Frontend URL:", process.env.FRONTEND_URL);

const frontend = process.env.FRONTEND_URL;
const app = express();
const isProduction = process.env.NODE_ENV === 'production';

if (!isProduction) {
  app.use(cors({
    origin: 'http://localhost:3000',
    credentials: true
  }));
}

app.use(express.json());
app.use(cookieParser(process.env.SESSION_SECRET));
app.set('trust proxy', 1); // must be set to allow render to work.

// creates a session, store in the "session" table in the db
app.use(session({
  store: new pgSession({
    pool:db.pool,
    tableName:'session'
  }),
  secret: process.env.SESSION_SECRET,
  resave:false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    maxAge: 24*60*60*1000,
    path: '/'
  }
}));

// use the modules
groupModule(app);

app.use(express.static(path.join(__dirname, "..", "frontend", "build")));

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

const PORT = process.env.PORT || 3000;

// ===================PAGES========================


app.get('/', (req, res) => {
  if (typeof req.session.userId !== "undefined") {
    res.sendFile(path.join(__dirname, "..", "frontend", "build", "index.html"));
  } else {
    res.redirect('/login');
  }
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, "..", "frontend", "build", "index.html"));
});

// ===================API=====================
app.get('/api/me', async (req, res) => {

  if (req.session.userId) {
    const person_info = await db.getUserByID(req.session.userId);
    console.log('User info from DB:', person_info); 
    res.json({ user: person_info });
  }
  else {
    res.json({ user: null });
  }
});

app.post('/api/create-username', async (req, res) => {
  /*
  const username = req.body.username
  db.updateUsername(req.session.userId, username) 
  checks for uniqueness in db
  */
  // ensure user is already authenticated
  const username = req.body.username;
  if (!req.session.userId) {
      return res.json({ success: false, error: 'Not authenticated' });
  }

  // backend checks if username is valid

  const errs = [];
  const usernameSize = /^.{4,16}$/;
  const usernameSymbols = /^.[a-zA-Z0-9_.]+$/
  if (!usernameSize.test(username)) {
    errs.push('Username must be between 4-16 characters' );
  }
  if (!usernameSymbols.test(username)) {
    errs.push('Username must only contain alphabetic letters, digits, and \'_\' and \'.\'');
  }
  if (errs > 0) {
    res.json({ sucesss: false, errors: errs })
  }

  // ensure username is unique
  const duplicate = await db.checkUsernameExists(username);
  if (!duplicate) {
    await db.updateUsername(req.session.userId, username);
    res.json({ success: true });
  } else {
    res.json({ success: false, errors: ['Username already taken'] });
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

  const authorizationUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: scopes,
    // Enable incremental authorization. Recommended as a best practice.
    include_granted_scopes: true,
    // Include the state parameter to reduce the risk of CSRF attacks.
    state: state,
    // Include consent to force refresh token
    prompt: 'consent'
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

  // if (q.state !== req.session.state) {
  //   return res.status(403).send('State mismatch. Possible CSRF attack.');
  // }

  try {
    const { tokens } = await oauth2Client.getToken(q.code);
    oauth2Client.setCredentials(tokens);

    const oauth2 = google.oauth2({version: 'v2', auth: oauth2Client});
    const {data: userInfo} = await oauth2.userinfo.get();

    console.log("expiry date is", tokens.expiry_date);

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    try {

    //grab calendar info (test)
    const responseCal = await calendar.calendarList.list({ maxResults: 10 });

    const calList = responseCal.data.items.map(cal => ({
      id: cal.id,
      summary: cal.summary,
      description: cal.description,
      primary: cal.primary
    }));


    } catch (error) {
      if (error.code === 403 || error.code === 401) {
        return res.redirect('/login?error=calendar_permissions_required');
      }
      throw error;
    }

    // need to include groups ids
    const userId = await db.insertUpdateUser(
      userInfo.id,
      userInfo.email, 
      userInfo.given_name, 
      userInfo.family_name, 
      null,
      tokens.refresh_token, 
      tokens.access_token, 
      tokens.expiry_date
    );

    req.session.userId = userId;
    req.session.isAuthenticated = true;

    delete req.session.state;

    await new Promise((resolve, reject) => {
      req.session.save((saveErr) => {
        if (saveErr) {
          console.error("Session Save Error:", saveErr);
          reject(saveErr);
        } else {
          resolve();
        }
      });
    });

    // Add a small delay to ensure DB write completes
    await new Promise(resolve => setTimeout(resolve, 100));
    console.log('session saved, redirecting.');
    res.redirect("/");

  } catch (authErr) {
    console.log("authorization error: ", authErr);
    res.redirect('/login'); // was /login fail - should we make that?
  }
});

app.get('/test-session', (req, res) => {
  res.json({
    sessionID: req.sessionID,
    userId: req.session.userId,
    isAuthenticated: req.session.isAuthenticated,
    fullSession: req.session
  });
});

async function ensureValidToken(req, res) {
  const user = await db.getUserByID(req.session.userId);
  
  if (!user || !user.access_token) {
    throw new Error('no user or user tokens');
  }

  const now = Date.now();
  const fiveMins = 5 * 60 * 1000;
  
  // FIX 1: Use 'token_expiry' (from DB) instead of 'expiry_date'
  // Convert to Number because DB might return it as a string
  const expiryDate = user.token_expiry ? Number(user.token_expiry) : 0;

  // FIX 2: Check if expiryDate is valid before doing math
  if (!expiryDate || now >= expiryDate - fiveMins) {
    console.log("Token expired or missing expiry. Refreshing...");
    console.log('User refresh token status:', user.refresh_token ? 'Present' : 'NULL');

    if (!user.refresh_token) {
      // If we need to refresh but have no token, we must fail gracefully
      // or rely on the caller to redirect to login.
      throw new Error('Access token expired and no refresh token available.');
    }

    oauth2Client.setCredentials({
      refresh_token: user.refresh_token
    });

    try {
      // Attempt to refresh the token
      const { credentials } = await oauth2Client.getAccessToken(); // This will trigger a refresh if needed
      const {access_token, expiry_date} = oauth2Client.credentials;
      await db.updateTokens(
        req.session.userId,
        access_token,
        expiry_date
      );
      console.log("Token refreshed successfully.");

      oauth2Client.setCredentials({credentials});
      return true; // Indicate successful refresh for route

    } catch (errRefresh) {
        if (errRefresh.response && errRefresh.response.data && errRefresh.response.data.error === 'invalid_grant') {
          console.warn("Google Refresh Token expired for user. Forcing re-authentication.", errRefresh);
          // Destroy user's session so frontend knkows they are logged out
          req.session.destroy((err) => {
            if (err) console.error("Could not destroy session after refresh failure:", err);
            return res.status(401).json({ error: "Session expired.  Please log in again." });
          });
          return false; // Stop execution don't keep trying to fetch events.
        }
        // If it is a different error, throw standard 500 error
        console.error("Failed to fetch Google API data:", errRefresh);
        res.status(500).json({ error: "Internal Server Error" });
        return false;
    }
  } else {
    // Token is still valid, just set credentials so the next call works
    oauth2Client.setCredentials({
      refresh_token: user.refresh_token,
      access_token: user.access_token,
      expiry_date: expiryDate
    });
    return true; // Token is valid, proceed with route
  }
}

app.get("/api/events", async (req, res) => {
  // TODO: add a way to pick which calendar to use
  // TODO: have the database cache the next month or so of events
  console.log('Session ID:', req.sessionID);
  console.log('Session data:', req.session);
  console.log('userid:', req.session.userId);
  console.log('isAuthenticated:', req.session.isAuthenticated);
  try {
    const isValid = await ensureValidToken(req, res);
    if (!isValid) return;
  } catch (tokenErr) {
      // Check if google is token is dead or not (no expiration crashing backend)
      if (tokenErr.response && tokenErr.response.data && tokenErr.response.data.error === 'invalid_grant') {
        console.error("Refresh Token Expired. Forcing re-authentication.");

        // Clear token from DB
        await db.updateTokens(req.session.userId, null, null);

        // Tell react user needs to log in again
        return res.status(401).json({ error: "Session expired.  Please log in with Google Again." });
      }
      // If it's a different error log it
      console.error("Failed to fetch events:", tokenErr);
      return res.status(500).json({ error: "Internal Server Error" });
  }
  
  // Check if user is logged in
  if (!req.session.userId || !req.session.isAuthenticated) {
    return res.status(401).json({ error: "User not authenticated" });
  }
  try {
    // Set credentials for this specific request using session data
    const user = await db.getUserByID(req.session.userId);
    console.log('user in /api/events: ', user);
    if (!user || !user.refresh_token) {
      return res.status(401).json({ error: "No tokens found. Please re-authenticate." });
    }
    const refreshToken = user.refresh_token; // TODO: encrypt this

    oauth2Client.setCredentials( {
      refresh_token: refreshToken,
      access_token: user.access_token,
      expiry_date: user.token_expiry ? new Date(user.token_expiry).getTime() : null
    });

    // add some updating tokens logic here

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const calendarStart = new Date();

    calendarStart.setDate(calendarStart.getDate() - 7);

    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: calendarStart.toISOString(), // From now onwards
      maxResults: 250,
      singleEvents: true, 
      orderBy: 'startTime',
    });

    const events = response.data.items;
    
    if (!events || events.length === 0) {
      return res.json([]);
    }

    const formattedEvents = events.map((event) => {
      const start = event.start.dateTime || event.start.date;
      const end = event.end.dateTime || event.end.date;

      return {
        title: event.summary || "No Title",
        start: start,
        end: end,
        // for stella/the db.addEvents function:
        event_id: event.id
      };
    });
    // TODO: add a check to see if their calendar is already in the db
    try {
      await db.addCalendar(req.session.userId, calendar.summary);
      const calID = await db.getCalendarID(req.session.userId);

      // grab existing events in calendar from db
      const existingEvents = await db.getEventsByCalendarID(calID.calendar_id);

      // check if there are new events
      const existingEventIds = new Set(existingEvents.map(event => event.gcal_event_id));
      const newEvents = formattedEvents.filter(event => !existingEventIds.has(event.event_id));

      // check if there are deleted events
      const googleEventIds = new Set(formattedEvents.map(event => event.event_id));
      const deletedEvents = existingEvents.filter(event => !googleEventIds.has(event.gcal_event_id));

      // check if there are modified events (time and name only)
      const modifiedEvents = [];
      for (const existingEvent of existingEvents) {
        const googleEvent = formattedEvents.find(event => event.event_id === existingEvent.gcal_event_id);
        
        if (googleEvent) {
          // Compare key properties that might have changed
          const existingStart = new Date(existingEvent.start_time).getTime();
          const existingEnd = new Date(existingEvent.end_time).getTime();
          const googleStart = new Date(googleEvent.start).getTime();
          const googleEnd = new Date(googleEvent.end).getTime();
          
          // Check if duration changed or times changed
          const existingDuration = existingEnd - existingStart;
          const googleDuration = googleEnd - googleStart;
          
          if (existingDuration !== googleDuration || 
              existingStart !== googleStart || 
              existingEnd !== googleEnd ||
              existingEvent.title !== googleEvent.title) {
            modifiedEvents.push({
              id: existingEvent.gcal_event_id,
              oldEvent: existingEvent,
              newEvent: googleEvent,
              durationChanged: existingDuration !== googleDuration
            });
          }
        }
    }

    // update the calendar in the database
    // clean the old events (> 7 days)
    await db.cleanEvents(calID.calendar_id, calendarStart.toISOString());

    // add new events to db
    if (newEvents.length > 0) {
      await db.addEvents(calID.calendar_id, newEvents);
    }

    // remove events deleted in google calendar
    if (deletedEvents.length > 0) {
      const deletedEventIds = deletedEvents.map(event => event.gcal_event_id);
      await db.deleteEventsByIds(calID.calendar_id, deletedEventIds);
    }

    // update modified events (only time and name)
    if (modifiedEvents.length > 0) {
      for (const mod of modifiedEvents) {
        await db.updateEvent(calID.calendar_id, mod.id, mod.newEvent);
      }
    }

    } catch(error) {
      console.error('error storing: ', error);
    }
    res.json(formattedEvents);

  } catch (error) {
    console.error('Error updating calendar', error);
    
    // If authentication failed, clear session
    if (error.code === 401 || error.code === 403) {
      req.session.destroy();
      return res.status(401).json({ error: "Authentication expired. Please log in again." });
    }
    
    res.status(500).json({ error: "Failed to fetch events" });
  }
});

app.get('/api/get-events', async (req, res) => {
  try {
    if (!req.session.userId || !req.session.isAuthenticated) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    // get calendar and then retrieve events from db
    const calID = await db.getCalendarID(req.session.userId);
    const events = await db.getEventsByCalendarID(calID.calendar_id);
    
    // transform db format to frontend format
    const formattedEvents = events.map(event => ({
      title: event.event_name,
      start: event.event_start,
      end: event.event_end,
      event_id: event.gcal_event_id
    }));
    
    return res.json(formattedEvents);

  } catch (error) {
    console.error('Error fetching calendar from db', error);
    
    // If authentication failed, clear session
    if (error.code === 401 || error.code === 403) {
      req.session.destroy();
      return res.status(401).json({ error: "Authentication expired. Please log in again." });
    }
    
    res.status(500).json({ error: "Failed to fetch events" });
  }
})

app.get('/api/email-send-test', async(req,res) => {
  try {
    email.groupRequest("sgreenvoss@gmail.com", "stellag",
      "test_from", "testusername"
    );
    res.json({success: true, message: "email send"});
  } catch (error) {
    console.error("route error: ", error);
    res.status(500).json({error: error.message});
  }
});

app.get('/api/users/search', async(req, res) => {
  const {q} = req.query;
  try {
    const users = await db.searchFor(q);
    res.json(users.rows);
  } catch(error) {
    console.error('search error: ', error);
    res.status(500).json({error: 'Search failed'});
  }
});

// ALGORITHM ROUTE: SEE docs/AVAILABILITY_ARCHITECTURE.md for documentation of how this works and what files have been changed.
  // availability_service.js
  // availability_adapter.js
  // availability_controller.js
  // algorithm.js
  // algolrithm_types.js
const availabilityController = require('./availability_controller');
// This one line tells Express: 
// "When someone hits this URL, hand the request over to the Controller"
app.get('/api/groups/:groupId/availability', availabilityController.getAvailability);



// Catch-all route for React Router - must be after all API routes
app.get('*', (req, res) => {
  // Serve React app for all unmatched routes
  if (req.session.userId) {
    res.sendFile(path.join(__dirname, "..", "frontend", "build", "index.html"));
  } else {
    res.redirect('/login');
  }
});

app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
});

