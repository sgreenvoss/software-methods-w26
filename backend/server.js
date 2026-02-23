const express = require('express');
const cors = require('cors'); // gemini assisted fix for CORS issues
const { google } = require('googleapis');
const crypto = require('crypto');
const path = require("path");
// Local imports for DB and email and groups
const db = require("./db/index");
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
console.log("Frontend URL:", process.env.REACT_APP_FRONTEND_URL);

const frontend = process.env.REACT_APP_FRONTEND_URL || 'http://localhost:3000'; // Default to localhost if not set
const app = express();
const isProduction = process.env.NODE_ENV === 'production';

if (!isProduction) {
  app.use(cors({
    origin: 'http://localhost:3000',
    credentials: true
  }));
}

app.use(express.json());
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
  console.log("\n--- STARTING OAUTH FLOW ---");
  console.log("1. Reached /auth/google");
  
  try {
    const state = crypto.randomBytes(32).toString('hex');
    console.log("2. Generated state:", state);
    
    if (req.session) {
      req.session.state = state;
      console.log("3. Attempting to save session to DB...");
      
      await new Promise((resolve) => {
        req.session.save((err) => {
          if (err) console.error("Session Save Error pre-OAuth:", err);
          console.log("4. Session saved successfully!");
          resolve(); 
        });
      });
    } else {
      console.log("3. WARNING: No req.session found!");
    }

    console.log("5. Generating Auth URL...");
    const authorizationUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes, // Ensure 'scopes' is defined higher up in your file!
      include_granted_scopes: true,
      state: state,
      prompt: 'consent'
    });
    
    console.log("6. Sending Redirect command to Browser...");
    res.redirect(authorizationUrl);
    console.log("--- FINISHED OAUTH FLOW (Waiting on Google) ---\n");

  } catch (error) {
    console.error("CRASH IN /AUTH/GOOGLE:", error);
    res.status(500).send("Error generating auth URL");
  }
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

    // if there is a group token in the session, we should finish adding the user
    // to their group.
    if (req.session.pendingGroupToken) {
      await groupModule.resolveGroupInvite(req);
    }
    // Add a small delay to ensure DB write completes
    await new Promise(resolve => setTimeout(resolve, 100));
    console.log('session saved, redirecting.');
    res.redirect("frontend" + '/'); // Redirect to frontend home page after successful login  

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

    // FIX 3: Manually map the DB fields to what Google expects
    oauth2Client.setCredentials({
      refresh_token: user.refresh_token,
      access_token: user.access_token,
      expiry_date: expiryDate
    });

    try {
      // Attempt to refresh the token
      const { credentials } = await oauth2Client.getAccessToken(); // This will trigger a refresh if needed
      await db.updateTokens(
        req.session.userId,
        credentials.access_token,
        credentials.expiry_date
      );
      console.log("Token refreshed successfully.");
      // Update client credentials with new ones
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
    // Token is still valid, just set credentials so next call works
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

    calendarStart.setDate(calendarStart.getDate() - 14);

    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: calendarStart.toISOString(), // From now onwards
      maxResults: 50,
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
      console.log("calendar id is", calID);
      db.addEvents(calID.calendar_id, formattedEvents)
        .catch(err => console.error("events insert failed", err));
    } catch(error) {
      console.error('error storing: ', error);
    }
    res.json(formattedEvents);

  } catch (error) {
    console.error('Error fetching calendar', error);
    
    // If authentication failed, clear session
    if (error.code === 401 || error.code === 403) {
      req.session.destroy();
      return res.status(401).json({ error: "Authentication expired. Please log in again." });
    }
    
    res.status(500).json({ error: "Failed to fetch events" });
  }
});

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


