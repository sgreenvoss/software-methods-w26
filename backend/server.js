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
const petitionRoutes = require("./routes/petition_routes");

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


app.post('/', (req, res) => {
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
  if (errs.length > 0) {
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

app.post('/api/select-calendars', async (req, res) => {
  try {

    const { calendars } = req.body;
    if (!req.session.userId) {
      return res.json({ success: false, error: 'Not authenticated'});
    }

    // add each calendar selected (calendars contains objects with id and summary)
    for (const cal of calendars) {
      await db.addCalendar(req.session.userId, cal.summary, cal.id);
    }

    res.json({ success: true }); 
  } catch (error) {
    console.error('Error selecting calendars');
    res.status(500).json({ success: false, error: 'Failed to select calendars'})
  }
});

app.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json( {success: false, error: 'Failed to logout'})
    }
    res.json({ success: true });
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

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const calendarStart = new Date();
    calendarStart.setDate(calendarStart.getDate() - 7);

    // Get all calendars saved for this user
    const userCalendars = await db.getCalendarsByUserID(req.session.userId);
    
    if (!userCalendars || userCalendars.length === 0) {
      return res.json([]);
    }

    let allFormattedEvents = [];

    // Sync events for each calendar
    for (const userCal of userCalendars) {
      try {
        const response = await calendar.events.list({
          calendarId: userCal.google_calendar_id,
          timeMin: calendarStart.toISOString(),
          maxResults: 250,
          singleEvents: true,
          orderBy: 'startTime',
        });

        const events = response.data.items;
        
        if (!events || events.length === 0) {
          continue;
        }

        const formattedEvents = events.map((event) => {
          const start = event.start.dateTime || event.start.date;
          const end = event.end.dateTime || event.end.date;

          return {
            title: event.summary || "No Title",
            start: start,
            end: end,
            event_id: event.id
          };
        });

        // Process this calendar's events
        const existingEvents = await db.getEventsByCalendarID(userCal.calendar_id);
        
        const existingEventIds = new Set(existingEvents.map(event => event.gcal_event_id));
        const newEvents = formattedEvents.filter(event => !existingEventIds.has(event.event_id));

        const googleEventIds = new Set(formattedEvents.map(event => event.event_id));
        const deletedEvents = existingEvents.filter(event => {
          if (event.gcal_event_id && event.gcal_event_id.startsWith('manual-')) {
            return false;
          }
          return !googleEventIds.has(event.gcal_event_id);
        });

        // Check for modified events
        const modifiedEvents = [];
        for (const existingEvent of existingEvents) {
          const googleEvent = formattedEvents.find(event => event.event_id === existingEvent.gcal_event_id);
          
          if (googleEvent) {
            const existingStart = new Date(existingEvent.event_start).getTime();
            const existingEnd = new Date(existingEvent.event_end).getTime();
            const googleStart = new Date(googleEvent.start).getTime();
            const googleEnd = new Date(googleEvent.end).getTime();
            
            const existingDuration = existingEnd - existingStart;
            const googleDuration = googleEnd - googleStart;
            
            if (existingDuration !== googleDuration || 
                existingStart !== googleStart || 
                existingEnd !== googleEnd ||
                existingEvent.event_name !== googleEvent.title) {
              modifiedEvents.push({
                id: existingEvent.gcal_event_id,
                newEvent: googleEvent
              });
            }
          }
        }

        // Clean old events
        await db.cleanEvents(userCal.calendar_id, calendarStart.toISOString());

        // Add new events
        if (newEvents.length > 0) {
          await db.addEvents(userCal.calendar_id, newEvents);
        }

        // Delete removed events
        if (deletedEvents.length > 0) {
          const deletedEventIds = deletedEvents.map(event => event.gcal_event_id);
          await db.deleteEventsByIds(userCal.calendar_id, deletedEventIds);
        }

        // Update modified events
        if (modifiedEvents.length > 0) {
          for (const mod of modifiedEvents) {
            await db.updateEvent(userCal.calendar_id, mod.id, mod.newEvent);
          }
        }

        allFormattedEvents = allFormattedEvents.concat(formattedEvents);

      } catch(calError) {
        console.error(`Error syncing calendar ${userCal.calendar_name}:`, calError);
      }
    }

    res.json(allFormattedEvents);

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

    // get all calendars for this user
    const userCalendars = await db.getCalendarsByUserID(req.session.userId);
    
    if (!userCalendars || userCalendars.length === 0) {
      return res.json([]);
    }

    let allFormattedEvents = [];

    // Fetch events from each calendar
    for (const userCal of userCalendars) {
      const events = await db.getEventsByCalendarID(userCal.calendar_id);
      
      // transform db format to frontend format
      const formattedEvents = events.map(event => ({
        title: event.event_name,
        start: event.event_start,
        end: event.event_end,
        event_id: event.gcal_event_id,
        priority: event.priority != null && Number.isFinite(Number(event.priority))
          ? Number(event.priority)
          : null
      }));

      allFormattedEvents = allFormattedEvents.concat(formattedEvents);
    }
    
    return res.json(allFormattedEvents);

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

app.post("/api/add-events", async (req, res) => {
  try {
    const { events } = req.body;

    if (!events || !Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ error: "Invalid events data" });
    }

    const userId = req.session.userId; 
    
    if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    const calResult = await db.getCalendarID(userId);
    
    if (!calResult || !calResult.calendar_id) {
       return res.status(404).json({ error: "Calendar not found for user" });
    }
    
    const cal_id = calResult.calendar_id;

    await db.addEvents(cal_id, events);

    return res.status(201).json({ success: true, message: `Added ${events.length} event(s)` });
  }
  catch (error) {
    console.error("Error adding events:", error);
    return res.status(500).json({ error: "Failed to add events" });
  }
});

app.post('/api/change-blocking-lvl', async (req, res) => {
  try {
    const { event_id, priority } = req.body;

    if (!event_id || priority === undefined) {
      return res.status(400).json({ error: "Missing event_id or priority" });
    }
    await db.updateEventPriority(event_id, parseInt(priority, 10));
    return res.status(200).json({ success: true, message: "Blocking level updated" });
  } catch (error) {
    console.error("Error updating blocking level:", error);
    return res.status(500).json({ error: "Failed to update blocking level" });
  }
});

app.post('/api/delete-event', async (req, res) => {
  try {
    const { event_id } = req.body;
    if (!event_id) {
      return res.status(400).json({ error: "Missing event_id" });
    }

    await db.deleteEventByGcalEventId(event_id);
    return res.status(200).json({ success: true, message: "Event deleted" });
  } catch (error) {
    console.error("Error deleting event:", error);
    return res.status(500).json({ error: "Failed to delete event" });
  }
});

app.post("/api/add-petition", async (req, res) => {
  function normalizeLegacyBlockingLevel(rawValue) {
    if (rawValue == null) return undefined;

    const text = String(rawValue).trim().toUpperCase();
    if (text === "1" || text === "B1") return "B1";
    if (text === "2" || text === "B2") return "B2";
    if (text === "3" || text === "B3") return "B3";
    return rawValue;
  }

  function normalizeLegacyPetitionPayload(body) {
    const firstEvent = Array.isArray(body?.events) ? body.events[0] : null;

    return {
      groupId: body?.groupId ?? body?.group_id ?? body?.petitionGroupId ?? body?.group,
      title: body?.title ?? body?.event_name ?? firstEvent?.title ?? firstEvent?.event_name,
      start: body?.start ?? body?.startMs ?? body?.start_time ?? firstEvent?.start ?? firstEvent?.start_time,
      end: body?.end ?? body?.endMs ?? body?.end_time ?? firstEvent?.end ?? firstEvent?.end_time,
      blocking_level: normalizeLegacyBlockingLevel(
        body?.blocking_level ??
        body?.blockingLevel ??
        body?.priority ??
        firstEvent?.blocking_level ??
        firstEvent?.blockingLevel ??
        firstEvent?.priority
      )
    };
  }

  try {
    petitionRoutes.ensureTraceId(res);

    if (!req.session || !req.session.userId || !req.session.isAuthenticated) {
      return petitionRoutes.sendApiError(req, res, 401, "Unauthorized");
    }

    const normalized = normalizeLegacyPetitionPayload(req.body);
    const userId = Number(req.session.userId);
    const groupId = Number(normalized.groupId);

    if (!Number.isInteger(groupId) || groupId <= 0) {
      return petitionRoutes.sendApiError(
        req,
        res,
        400,
        "groupId is required for legacy petition creation",
        {
          code: "LEGACY_PETITION_PAYLOAD_INVALID",
          requiredField: "groupId"
        }
      );
    }

    const group = await db.getGroupById(groupId);
    if (!group) {
      return petitionRoutes.sendApiError(req, res, 404, "Group not found");
    }

    const inGroup = await db.isUserInGroup(userId, groupId);
    if (!inGroup) {
      return petitionRoutes.sendApiError(req, res, 403, "Forbidden");
    }

    const parsed = petitionRoutes.parseCreatePetitionInput(normalized);
    const petition = await db.createPetition({
      groupId,
      creatorUserId: userId,
      title: parsed.title,
      startMs: parsed.startMs,
      endMs: parsed.endMs,
      blockingLevel: parsed.blockingLevel
    });

    return res.status(201).json(petitionRoutes.decoratePetitionForUser(petition, userId));
  } catch (error) {
    const resolved = petitionRoutes.resolvePetitionApiError(error, "Failed to create petition");
    console.error("[LegacyPetitionAlias]", {
      traceId: res.locals?.traceId || null,
      path: req.originalUrl,
      userId: req.session?.userId ?? null,
      errorMessage: error?.message || String(error)
    });
    return petitionRoutes.sendApiError(req, res, resolved.status, resolved.message, {
      ...resolved.extra,
      compatEndpoint: "/api/add-petition"
    });
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

app.get('/api/calendars', async (req, res) => {
  try {
    const isValid = await ensureValidToken(req, res);
    if (!isValid) return;

    const user = await db.getUserByID(req.session.userId);
    oauth2Client.setCredentials({
      refresh_token: user.refresh_token,
      access_token: user.access_token,
      expiry_date: user.token_expiry
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const response = await calendar.calendarList.list({ maxResults: 25 });

    const calendars = response.data.items.map(cal => ({
      id: cal.id,
      summary: cal.summary,
      description: cal.description,
      primary: cal.primary
    }));

    res.json(calendars);
  } catch (error) {
    console.error('Error fetching calendars:', error);
    res.status(500).json({ error: 'Failed to fetch calendars' });
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

// Catch-all for unmatched routes - serve React app
app.use((req, res) => {
  if (req.session.userId) {
    res.sendFile(path.join(__dirname, "..", "frontend", "build", "index.html"));
  } else {
    res.redirect('/login');
  }
});

async function startServer() {
  console.log("[Startup] Verifying petition schema...");
  try {
    await db.ensurePetitionSchema();
    console.log("[Startup] Petition schema ready: petitions and petition_responses tables verified.");
  } catch (error) {
    console.error("[Startup] Petition schema readiness check failed. Exiting.", {
      errorMessage: error?.message || String(error),
      errorCode: error?.code || error?.appCode || null
    });
    process.exit(1);
  }

  app.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
