// requirements
const express = require('express');
const { google } = require('googleapis');
const crypto = require('crypto');
const path = require("path");
const db = require("./db/index");
const session = require('express-session');
const url = require('url');
const pgSession = require('connect-pg-simple')(session);
const email = require('./emailer');

// .env config
require('dotenv').config({
  path: process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development'
});
console.log("Database URL Check:", process.env.DATABASE_URL ? "Found it!" : "It is UNDEFINED");

console.log("ENV:", process.env.NODE_ENV);
console.log("Frontend URL:", process.env.FRONTEND_URL);

const frontend = process.env.FRONTEND_URL;
const app = express();

const isProduction = process.env.NODE_ENV === 'production';

app.use(express.json());
app.set('trust proxy', 1);


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


app.use(express.static(path.join(__dirname, "..", "frontend"), { index: false }));

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
    res.sendFile(path.join(__dirname, "..", "frontend", "index.html"));
  } else {
    res.redirect('/login');
  }
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, "..", "frontend", "login.html"));
});

// ===================API=====================
app.get('/api/me', async (req, res) => {
  if (req.session.userId) {
    const person_info = await db.getUserByID(req.session.userId);
    res.json(person_info);
  }
  else {
    res.json("");
  }
}) 

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
  const username = req.query.username;
  console.log('in first callback, username is ' + username);
  const state = crypto.randomBytes(32).toString('hex');
  // Store state in the session
  req.session.state = state;
  req.session.pending_username = username;

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

  // if (q.state !== req.session.state) {
  //   return res.status(403).send('State mismatch. Possible CSRF attack.');
  // }

  try {
    const { tokens } = await oauth2Client.getToken(q.code);
    oauth2Client.setCredentials(tokens);

    const oauth2 = google.oauth2({version: 'v2', auth: oauth2Client});
    const {data: userInfo} = await oauth2.userinfo.get();

    console.log('in the callback, username is ' + req.session.pending_username);

    // need to include groups ids
    const userId = await db.insertUpdateUser(
      userInfo.id,
      userInfo.email, 
      userInfo.given_name, 
      userInfo.family_name, 
      req.session.pending_username,
      tokens.refresh_token, 
      tokens.access_token, 
      tokens.expiry_date
    );

    req.session.userId = userId;
    req.session.isAuthenticated = true;

    delete req.session.state;
    delete req.session.pending_username;

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
    console.error("Login failed", authErr);
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

app.get("/api/events", async (req, res) => {
  // TODO: add a way to pick which calendar to use
  // TODO: have the database cache the next month or so of events
  console.log('Session ID:', req.sessionID);
  console.log('Session data:', req.session);
  console.log('userid:', req.session.userId);
  console.log('isAuthenticated:', req.session.isAuthenticated);
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
    await email.groupRequest("sgreenvoss@gmail.com", "stellag",
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

app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  
});