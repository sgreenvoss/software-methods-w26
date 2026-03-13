/*
File: server.js
Purpose: this is the central Express backend that manages 
    auth/sessions, API routes, calendar/event operations, 
    and serves the React app.
Date Created: 2026-02-03
Initial Author(s): Stella Greenvoss, heavily edited by all developers
 
System Context:
 Acts as the main backend entry point for the application. It configures Express middleware,
session persistence, Google OAuth authentication, calendar synchronization routes, group and
petition-related APIs, and fallback serving of the built React frontend for authenticated users.
 */

// Express framework for middleware registration, API routing, and static asset serving.
const express = require('express');

// CORS middleware for local development requests from the frontend dev server.
const cors = require('cors');

// Google APIs client for OAuth authentication, user profile lookup, and calendar sync.
const { google } = require('googleapis');

// Node built-ins for CSRF state generation, static path resolution, and OAuth callback query parsing.
const crypto = require('crypto');
const path = require("path");
const url = require('url');

// Middleware for signed cookies and persisted session management.
const cookieParser = require("cookie-parser");

const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);

// Local modules for database access, email utilities, group routes, petition helpers, and event normalization.
const db = require("./db/dbInterface");
const email = require('./emailer'); 
const groupModule = require("./groups");
const petitionRoutes = require("./routes/petition_routes");
const { normalizeCalendarEvent } = require("./calendar_event_normalizer");

// Load the environment file that matches the current runtime.
require('dotenv').config({
  path: process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development'
});

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
app.set('trust proxy', 1); // Required so secure cookies behave correctly behind Render's proxy.

// Persist Express sessions in Postgres so auth survives server restarts.
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

// Register the group routes before the frontend catch-all runs.
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

// --- page routes ---


/**
 * Root page route that serves the built React app for authenticated users
 * and redirects unauthenticated users to the login page.
 */
app.post('/', (req, res) => {
  if (typeof req.session.userId !== "undefined") {
    res.sendFile(path.join(__dirname, "..", "frontend", "build", "index.html"));
  } else {
    res.redirect('/login');
  }
});

/**
 * Login page route that serves the frontend entry point so the React app can
 * render the login experience client-side.
 */
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, "..", "frontend", "build", "index.html"));
});

// --- api routes ---
/**
 * Returns the authenticated user's database record, or `null` when no session exists.
 */
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

/**
 * Creates or updates the authenticated user's username after validating format and uniqueness.
 */
app.post('/api/create-username', async (req, res) => {
  // Require an authenticated session before saving a username.
  const username = req.body.username;
  if (!req.session.userId) {
      return res.json({ success: false, error: 'Not authenticated' });
  }

  // Validate the username shape before checking uniqueness.

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

  // Only save usernames that are still available.
  const duplicate = await db.checkUsernameExists(username);
  if (!duplicate) {
    await db.updateUsername(req.session.userId, username);
    res.json({ success: true });
  } else {
    res.json({ success: false, errors: ['Username already taken'] });
  }
});

/**
 * Saves the calendars selected during onboarding to the authenticated user's account.
 */
app.post('/api/select-calendars', async (req, res) => {
  try {

    const { calendars } = req.body;
    if (!req.session.userId) {
      return res.json({ success: false, error: 'Not authenticated'});
    }

    // Save each selected calendar to the local account record.
    for (const cal of calendars) {
      await db.addCalendar(req.session.userId, cal.summary, cal.id);
    }

    res.json({ success: true }); 
  } catch (error) {
    console.error('Error selecting calendars');
    res.status(500).json({ success: false, error: 'Failed to select calendars'})
  }
});

/**
 * Logs the current user out by destroying the active session.
 */
app.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ success: false, error: 'Failed to logout' });
    }
    res.json({ success: true });
  });
});

/**
 * Diagnostic route for testing database connectivity in development or debugging scenarios.
 */
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

/**
 * Lightweight health-check route used to verify that the backend is running.
 */
app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

/**
 * Starts the Google OAuth flow by generating a state token and redirecting the user
 * to Google's authorization screen.
 */
app.get('/auth/google', async (req, res) => {
  // Generate and save a CSRF state value for the OAuth round-trip.
  const state = crypto.randomBytes(32).toString('hex');
  req.session.state = state;

  const authorizationUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: scopes,
    // Keep already granted scopes when the user reauthenticates.
    include_granted_scopes: true,
    // Send the CSRF state back through Google's redirect.
    state: state,
    // Force the consent screen so Google sends a refresh token.
    prompt: 'consent'
  });
  res.redirect(authorizationUrl);
});

/**
 * Handles the Google OAuth callback, exchanges the authorization code for tokens,
 * stores or updates the user record, and creates the authenticated session.
 */
app.get('/oauth2callback', async (req, res) => {
  const q = url.parse(req.url, true).query;

  // Stop early when Google redirects back with an OAuth error.
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

    // Confirm calendar access before finishing the login flow.
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

    // Create or refresh the local user record before saving the session.
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

    // Give the session store a brief moment to flush before redirecting.
    await new Promise(resolve => setTimeout(resolve, 100));
    console.log('session saved, redirecting.');
    res.redirect("/");

  } catch (authErr) {
    console.log("authorization error: ", authErr);
    res.redirect('/login');
  }
});

/**
 * Debug route for inspecting the current Express session contents.
 */
app.get('/test-session', (req, res) => {
  res.json({
    sessionID: req.sessionID,
    userId: req.session.userId,
    isAuthenticated: req.session.isAuthenticated,
    fullSession: req.session
  });
});

/**
 * Ensures the authenticated user's Google access token is available and refreshes it if needed.
 * Sends an auth-related response when refresh fails in a way that should stop route execution.
 *
 * @param {Object} req - Express request object containing session data
 * @param {Object} res - Express response object used for auth failure responses
 * @returns {Promise<boolean>} True when the token is valid or refreshed successfully; otherwise false
 */
async function ensureValidToken(req, res) {
  const user = await db.getUserByID(req.session.userId);
  
  if (!user || !user.access_token) {
    throw new Error('no user or user tokens');
  }

  const now = Date.now();
  const fiveMins = 5 * 60 * 1000;
  
  // Read the persisted expiry from the database and normalize it to a number.
  const expiryDate = user.token_expiry ? Number(user.token_expiry) : 0;

  // Refresh shortly before expiry so downstream Google calls stay valid.
  if (!expiryDate || now >= expiryDate - fiveMins) {
    console.log("Token expired or missing expiry. Refreshing...");
    console.log('User refresh token status:', user.refresh_token ? 'Present' : 'NULL');

    if (!user.refresh_token) {
      // Without a refresh token, the caller has to send the user back through login.
      throw new Error('Access token expired and no refresh token available.');
    }

    oauth2Client.setCredentials({
      refresh_token: user.refresh_token
    });

    try {
      // Let the Google client refresh the access token on demand.
      const { credentials } = await oauth2Client.getAccessToken();
      const {access_token, expiry_date} = oauth2Client.credentials;
      await db.updateTokens(
        req.session.userId,
        access_token,
        expiry_date
      );
      console.log("Token refreshed successfully.");

      oauth2Client.setCredentials({credentials});
      return true;

    } catch (errRefresh) {
        if (errRefresh.response && errRefresh.response.data && errRefresh.response.data.error === 'invalid_grant') {
          console.warn("Google Refresh Token expired for user. Forcing re-authentication.", errRefresh);
          // Clear the session so the frontend sees the user as logged out.
          req.session.destroy((err) => {
            if (err) console.error("Could not destroy session after refresh failure:", err);
            return res.status(401).json({ error: "Session expired.  Please log in again." });
          });
          return false;
        }
        // Treat other refresh failures as server errors for the calling route.
        console.error("Failed to fetch Google API data:", errRefresh);
        res.status(500).json({ error: "Internal Server Error" });
        return false;
    }
  } else {
    // Reuse the existing token when it is still valid.
    oauth2Client.setCredentials({
      refresh_token: user.refresh_token,
      access_token: user.access_token,
      expiry_date: expiryDate
    });
    return true;
  }
}

/**
 * Synchronizes Google Calendar events into the local database and returns normalized events
 * for the authenticated user.
 */
app.get("/api/events", async (req, res) => {
  try {
    const isValid = await ensureValidToken(req, res);
    if (!isValid) return;
  } catch (tokenErr) {
      // Force re-login when Google rejects the stored refresh token.
      if (tokenErr.response && tokenErr.response.data && tokenErr.response.data.error === 'invalid_grant') {
        console.error("Refresh Token Expired. Forcing re-authentication.");

        // Clear the stored tokens before telling the client to log in again.
        await db.updateTokens(req.session.userId, null, null);

        // Tell the frontend the session needs a new Google login.
        return res.status(401).json({ error: "Session expired.  Please log in with Google Again." });
      }
      console.error("Failed to fetch events:", tokenErr);
      return res.status(500).json({ error: "Internal Server Error" });
  }
  
  // Require a local authenticated session before syncing calendars.
  if (!req.session.userId || !req.session.isAuthenticated) {
    return res.status(401).json({ error: "User not authenticated" });
  }
  try {
    // Load the stored Google tokens for this request.
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

    // Sync every calendar the user selected during onboarding.
    const userCalendars = await db.getCalendarsByUserID(req.session.userId);
    
    if (!userCalendars || userCalendars.length === 0) {
      return res.json([]);
    }

    let allFormattedEvents = [];

    // Pull Google events one calendar at a time and mirror them locally.
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

        // Compare the fresh Google rows against the local snapshot.
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

        // Track rows that still exist but changed time or title.
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

        // Drop old rows before saving the latest Google snapshot.
        await db.cleanEvents(userCal.calendar_id, calendarStart.toISOString());

        // Insert events that are new to this calendar.
        if (newEvents.length > 0) {
          await db.addEvents(userCal.calendar_id, newEvents);
        }

        // Remove rows that no longer exist in Google.
        if (deletedEvents.length > 0) {
          const deletedEventIds = deletedEvents.map(event => event.gcal_event_id);
          await db.deleteEventsByIds(userCal.calendar_id, deletedEventIds);
        }

        // Update rows that still exist but changed contents.
        if (modifiedEvents.length > 0) {
          for (const mod of modifiedEvents) {
            await db.updateEvent(userCal.calendar_id, mod.id, mod.newEvent);
          }
        }

        allFormattedEvents = allFormattedEvents.concat(
          formattedEvents.map((event) => normalizeCalendarEvent(event))
        );

      } catch(calError) {
        console.error(`Error syncing calendar ${userCal.calendar_name}:`, calError);
      }
    }

    res.json(allFormattedEvents);

  } catch (error) {
    console.error('Error updating calendar', error);
    
    // Clear the session when Google rejects the stored credentials.
    if (error.code === 401 || error.code === 403) {
      req.session.destroy();
      return res.status(401).json({ error: "Authentication expired. Please log in again." });
    }
    
    res.status(500).json({ error: "Failed to fetch events" });
  }
});

/**
 * Returns normalized calendar events from the local database without triggering a Google sync.
 */
app.get('/api/get-events', async (req, res) => {
  try {
    if (!req.session.userId || !req.session.isAuthenticated) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    // Read all saved calendars for this user from the local database.
    const userCalendars = await db.getCalendarsByUserID(req.session.userId);
    
    if (!userCalendars || userCalendars.length === 0) {
      return res.json([]);
    }

    let allFormattedEvents = [];

    // Collect and normalize the stored events for each calendar.
    for (const userCal of userCalendars) {
      const events = await db.getEventsByCalendarID(userCal.calendar_id);
      
      // Shape the database rows into the format the frontend expects.
      const formattedEvents = events.map(event => normalizeCalendarEvent({
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

/**
 * Adds one or more events to the authenticated user's primary application calendar.
 */
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

/**
 * Updates the blocking priority for a single event or all matching events with the same title.
 */
app.post('/api/change-blocking-lvl', async (req, res) => {
  try {
    // Support both single-event and same-title bulk updates.
    const { event_id, priority, apply_to_all, title } = req.body;
    
    // Use the session user when the update targets every matching title.
    const userId = req.session?.userId;

    if (priority === undefined) {
      return res.status(400).json({ error: "Missing priority" });
    }

    if (apply_to_all) {
      if (!userId || !title) {
        return res.status(400).json({ error: "Missing user session or title for bulk update" });
      }
      await db.updateEventPriorityByTitle(userId, title, parseInt(priority, 10));
      
    } else {
      if (!event_id) {
        return res.status(400).json({ error: "Missing event_id" });
      }
      await db.updateEventPriority(event_id, parseInt(priority, 10));
    }

    return res.status(200).json({ success: true, message: "Blocking level updated" });
    
  } catch (error) {
    console.error("Error updating blocking level:", error);
    return res.status(500).json({ error: "Failed to update blocking level" });
  }
});

/**
 * Deletes a single event identified by its Google Calendar event ID.
 */
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

/**
 * Deletes all events for the authenticated user that share a given title.
 */
app.post('/api/delete-events-by-title', async (req, res) => {
    try {
        // Use the session user so one account only deletes its own events.
        const userId = req.session?.userId;
        const { title } = req.body;

        if (!title) {
            return res.status(400).json({ error: "Title is required for mass deletion." });
        }

        const result = await db.deleteEventsByTitle(userId, title);
        
        res.status(200).json({ 
            message: "Successfully deleted events", 
            deletedCount: result.deletedCount 
        });
    } catch (error) {
        console.error("Delete by title error:", error);
        res.status(500).json({ error: "Server error deleting events." });
    }
});

/**
 * Legacy-compatible petition creation endpoint that normalizes older payload shapes,
 * validates access, and creates a petition for a group.
 */
app.post("/api/add-petition", async (req, res) => {
  /*
  Normalize older blocking-level values before they hit the petition parser.
  */
  function normalizeLegacyBlockingLevel(rawValue) {
    if (rawValue == null) return undefined;

    const text = String(rawValue).trim().toUpperCase();
    if (text === "1" || text === "B1") return "B1";
    if (text === "2" || text === "B2") return "B2";
    if (text === "3" || text === "B3") return "B3";
    return rawValue;
  }

  /*
  Accept the older petition payload shapes that still exist in some callers.
  */
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

/**
 * Development test route for sending a sample group-request email.
 */
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

/**
 * Searches for users matching the provided query string.
 */
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

/**
 * Fetches the authenticated user's available Google calendars.
 */
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

// --- availability route ---
// See docs/AVAILABILITY_ARCHITECTURE.md for the supporting availability modules.
const availabilityController = require('./availability_controller');

/**
 * Delegates group availability requests to the availability controller.
 */
app.get('/api/groups/:groupId/availability', availabilityController.getAvailability);

/**
 * Catch-all route for unmatched requests that serves the React app to authenticated users
 * and redirects unauthenticated users to the login page.
 */
app.use((req, res) => {
  if (req.session.userId) {
    res.sendFile(path.join(__dirname, "..", "frontend", "build", "index.html"));
  } else {
    res.redirect('/login');
  }
});

/**
 * Verifies startup prerequisites and starts the Express server.
 * Ensures petition schema dependencies exist before accepting requests.
 *
 * @returns {Promise<void>} Resolves after startup completes, or exits the process on fatal initialization failure
 */
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
