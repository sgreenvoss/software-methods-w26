const express = require('express');
const router = express.Router();
const { google } = require('googleapis');
const db = require('../db');
const { oauth2Client } = require('../config/google');
const { ensureValidToken } = require('../middleware/auth');

// .env config
require('dotenv').config({
  path: process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development'
});



// Apply this middleware to ALL routes in this file
// This ensures req.session.userId exists and tokens are fresh
router.use(ensureValidToken);

// ==========================================
// GET /api/me
// ==========================================
router.get('/me', async (req, res) => {
  try {
    const personInfo = await db.getUserByID(req.session.userId);
    res.json(personInfo || "");
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch user info" });
  }
});

// ==========================================
// GET /api/events
// ==========================================
router.get('/events', async (req, res) => {
  try {
    const user = await db.getUserByID(req.session.userId);
    
    if (!user || !user.refresh_token) {
      return res.status(401).json({ error: "No refresh token. Re-auth required." });
    }

    // Set credentials for the Google API call
    oauth2Client.setCredentials({
      refresh_token: user.refresh_token,
      access_token: user.access_token,
      // We use Number() because we changed this to BIGINT in the DB
      expiry_date: Number(user.token_expiry)
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: twoWeeksAgo.toISOString(),
      maxResults: 50,
      singleEvents: true,
      orderBy: 'startTime',
    });

    const events = response.data.items || [];
    const formattedEvents = events.map(event => ({
      title: event.summary || "No Title",
      start: event.start.dateTime || event.start.date,
      end: event.end.dateTime || event.end.date,
      event_id: event.id
    }));

    // Background DB Update (Don't await this so the user gets their response faster)
    updateDatabaseCalendar(req.session.userId, formattedEvents);

    res.json(formattedEvents);

  } catch (error) {
    console.error('Calendar API Error:', error);
    if (error.code === 401 || error.code === 403) {
      return res.status(401).json({ error: "Google session expired" });
    }
    res.status(500).json({ error: "Failed to fetch events" });
  }
});

/* does not semantically fit
// ==========================================
// GET /api/users/search
// ==========================================
router.get('/users/search', async (req, res) => {
  const { q } = req.query;
  try {
    const users = await db.searchFor(q);
    res.json(users.rows);
  } catch (error) {
    res.status(500).json({ error: 'Search failed' });
  }
});
*/

// Helper function to keep the route logic clean
async function updateDatabaseCalendar(userId, events) {
  try {
    // This assumes your db module has these functions
    await db.addCalendar(userId, "Primary Calendar"); 
    const cal = await db.getCalendarID(userId);
    if (cal) {
      await db.addEvents(cal.calendar_id, events);
    }
  } catch (err) {
    console.error("Background DB Sync Error:", err);
  }
}

module.exports = router;