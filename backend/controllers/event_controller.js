function assertPriorityValue(value) {
  const numeric = Number(value);
  if (numeric === 1 || numeric === 2 || numeric === 3) {
    return numeric;
  }

  const err = new Error(`Invalid cal_event.priority value: ${value}`);
  err.code = 'INVALID_EVENT_PRIORITY';
  throw err;
}

function mapDbEventForApi(event) {
  return {
    title: event.event_name,
    start: event.event_start,
    end: event.event_end,
    event_id: event.gcal_event_id,
    // cal_event.priority is the persisted source of truth and should
    // already be a valid 1|2|3 value at this point.
    priority: assertPriorityValue(event.priority),
  };
}

const BLOCKING_LEVEL_TO_PRIORITY = Object.freeze({
  B1: 1,
  B2: 2,
  B3: 3
});

function buildManualEventId() {
  return `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createEventController({ db, google, oauth2Client }) {
  async function getCalendarForUser(userId, { createIfMissing = false } = {}) {
    if (createIfMissing) {
      await db.addCalendar(userId, 'primary');
    }

    return db.getCalendarID(userId);
  }

  async function ensureValidToken(req, res) {
    if (!req.session || !req.session.userId || !req.session.isAuthenticated) {
      res.status(401).json({ error: "User not authenticated" });
      return false;
    }

    const user = await db.getUserByID(req.session.userId);
    if (!user || !user.refresh_token) {
      res.status(401).json({ error: "No tokens found. Please re-authenticate." });
      return false;
    }

    const expiryDate = user.token_expiry ? new Date(user.token_expiry).getTime() : null;

    if (!expiryDate || Date.now() > expiryDate) {
      console.log("Token expired or missing expiry. Refreshing...");
      console.log("User refresh token status:", user.refresh_token ? "Present" : "MISSING");

      try {
        oauth2Client.setCredentials({
          refresh_token: user.refresh_token
        });
        console.log("Token refreshed successfully.");

        return true;
      } catch (errRefresh) {
        if (errRefresh.response && errRefresh.response.data && errRefresh.response.data.error === 'invalid_grant') {
          console.warn("Google Refresh Token expired for user. Forcing re-authentication.", errRefresh);
          req.session.destroy((err) => {
            if (err) console.error("Could not destroy session after refresh failure:", err);
            return res.status(401).json({ error: "Session expired.  Please log in again." });
          });
          return false;
        }

        console.error("Failed to fetch Google API data:", errRefresh);
        res.status(500).json({ error: "Internal Server Error" });
        return false;
      }
    }
    return true;
  }

  async function getEvents(req, res) {
    console.log('Session ID:', req.sessionID);
    console.log('Session data:', req.session);
    console.log('userid:', req.session && req.session.userId);
    console.log('isAuthenticated:', req.session && req.session.isAuthenticated);

    try {
      const isValid = await ensureValidToken(req, res);
      if (!isValid) return;
    } catch (tokenErr) {
      if (tokenErr.response && tokenErr.response.data && tokenErr.response.data.error === 'invalid_grant') {
        console.error("Refresh Token Expired. Forcing re-authentication.");
        await db.updateTokens(req.session.userId, null, null);
        return res.status(401).json({ error: "Session expired.  Please log in with Google Again." });
      }

      console.error("Failed to fetch events:", tokenErr);
      return res.status(500).json({ error: "Internal Server Error" });
    }

    if (!req.session || !req.session.userId || !req.session.isAuthenticated) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    try {
      const user = await db.getUserByID(req.session.userId);
      console.log('user in /api/events: ', user);
      if (!user || !user.refresh_token) {
        return res.status(401).json({ error: "No tokens found. Please re-authenticate." });
      }

      oauth2Client.setCredentials({
        refresh_token: user.refresh_token
        // access_token: user.access_token,
        // expiry_date: user.token_expiry ? new Date(user.token_expiry).getTime() : null
      });

      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
      const calendarStart = new Date();
      calendarStart.setDate(calendarStart.getDate() - 7);

      const response = await calendar.events.list({
        calendarId: 'primary',
        timeMin: calendarStart.toISOString(),
        maxResults: 250,
        singleEvents: true,
        orderBy: 'startTime',
      });

      const googleItems = Array.isArray(response?.data?.items) ? response.data.items : [];
      const formattedEvents = googleItems.map((event) => {
        const start = event.start.dateTime || event.start.date;
        const end = event.end.dateTime || event.end.date;

        return {
          title: event.summary || "No Title",
          start,
          end,
          event_id: event.id
        };
      });

      await db.addCalendar(req.session.userId, calendar.summary);
      const calID = await db.getCalendarID(req.session.userId);
      if (!calID || !calID.calendar_id) {
        return res.status(500).json({ error: "Failed to access calendar" });
      }

      try {
        const existingEvents = await db.getEventsByCalendarID(calID.calendar_id);
        const existingEventIds = new Set(existingEvents.map((event) => event.gcal_event_id));
        const newEvents = formattedEvents.filter((event) => !existingEventIds.has(event.event_id));

        const googleEventIds = new Set(formattedEvents.map((event) => event.event_id));
        const deletedEvents = existingEvents.filter((event) =>
          event.gcal_event_id &&
          !event.gcal_event_id.startsWith('manual-') &&
          !googleEventIds.has(event.gcal_event_id)
        );

        const modifiedEvents = [];
        for (const existingEvent of existingEvents) {
          const googleEvent = formattedEvents.find((event) => event.event_id === existingEvent.gcal_event_id);
          if (!googleEvent) continue;

          const existingStart = new Date(existingEvent.event_start).getTime();
          const existingEnd = new Date(existingEvent.event_end).getTime();
          const googleStart = new Date(googleEvent.start).getTime();
          const googleEnd = new Date(googleEvent.end).getTime();

          const existingDuration = existingEnd - existingStart;
          const googleDuration = googleEnd - googleStart;

          if (
            existingDuration !== googleDuration ||
            existingStart !== googleStart ||
            existingEnd !== googleEnd ||
            existingEvent.event_name !== googleEvent.title
          ) {
            modifiedEvents.push({
              id: existingEvent.gcal_event_id,
              newEvent: googleEvent,
            });
          }
        }

        await db.cleanEvents(calID.calendar_id, calendarStart.toISOString());

        if (newEvents.length > 0) {
          await db.addEvents(calID.calendar_id, newEvents);
        }

        if (deletedEvents.length > 0) {
          const deletedEventIds = deletedEvents.map((event) => event.gcal_event_id);
          await db.deleteEventsByIds(calID.calendar_id, deletedEventIds);
        }

        if (modifiedEvents.length > 0) {
          for (const mod of modifiedEvents) {
            await db.updateEvent(calID.calendar_id, mod.id, mod.newEvent);
          }
        }
      } catch (error) {
        console.error('error storing: ', error);
      }

      const freshEvents = await db.getEventsByCalendarID(calID.calendar_id);
      return res.json(freshEvents.map(mapDbEventForApi));
    } catch (error) {
      console.error('Error updating calendar', error);

      // let's try redirecting to login
      res.redirect('/auth/google');

      // if (error.code === 401 || error.code === 403) {
      //   req.session.destroy();
      //   return res.status(401).json({ error: "Authentication expired. Please log in again." });
      // }

    }
  }

  async function getStoredEvents(req, res) {
    try {
      if (!req.session || !req.session.userId || !req.session.isAuthenticated) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const calID = await db.getCalendarID(req.session.userId);
      if (!calID || !calID.calendar_id) {
        return res.json([]);
      }

      const events = await db.getEventsByCalendarID(calID.calendar_id);
      const formattedEvents = events.map(mapDbEventForApi);

      return res.json(formattedEvents);
    } catch (error) {
      console.error('Error fetching calendar from db', error);

      if (error.code === 401 || error.code === 403) {
        req.session.destroy();
        return res.status(401).json({ error: "Authentication expired. Please log in again." });
      }

      return res.status(500).json({ error: "Failed to fetch events" });
    }
  }

  async function updateGoogleEventPriority(req, res) {
    if (!req.session || !req.session.userId || !req.session.isAuthenticated) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const eventId = typeof req.params?.eventId === 'string' ? req.params.eventId.trim() : '';
    if (!eventId) {
      return res.status(400).json({ error: "Invalid eventId" });
    }

    const blockingLevel = typeof req.body?.blockingLevel === 'string'
      ? req.body.blockingLevel.trim().toUpperCase()
      : '';
    const mappedPriority = BLOCKING_LEVEL_TO_PRIORITY[blockingLevel];

    if (!mappedPriority) {
      return res.status(400).json({ error: "blockingLevel must be one of B1, B2, B3" });
    }

    try {
      const calID = await db.getCalendarID(req.session.userId);
      if (!calID || !calID.calendar_id) {
        return res.status(404).json({ error: "Event not found" });
      }

      const updatedEvent = await db.updateEventPriority(calID.calendar_id, eventId, mappedPriority);
      if (!updatedEvent) {
        return res.status(404).json({ error: "Event not found" });
      }

      return res.status(200).json({
        ok: true,
        eventId,
        blockingLevel,
        priority: mappedPriority
      });
    } catch (error) {
      console.error('update event priority error:', error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  }

  async function createManualEvent(req, res) {
    if (!req.session || !req.session.userId || !req.session.isAuthenticated) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const rawTitle = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    const startMs = Number(req.body?.start);
    const endMs = Number(req.body?.end);
    const blockingLevel = typeof req.body?.blockingLevel === 'string'
      ? req.body.blockingLevel.trim().toUpperCase()
      : '';

    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
      return res.status(400).json({ error: "start and end are required" });
    }

    if (endMs <= startMs) {
      return res.status(400).json({ error: "end must be greater than start" });
    }

    const priority = BLOCKING_LEVEL_TO_PRIORITY[blockingLevel];
    if (!priority) {
      return res.status(400).json({ error: "blockingLevel must be one of B1, B2, B3" });
    }

    const title = rawTitle || 'Busy Block';

    try {
      const calID = await getCalendarForUser(req.session.userId, { createIfMissing: true });
      if (!calID || !calID.calendar_id) {
        return res.status(500).json({ error: "Failed to access calendar" });
      }

      const createdEvent = await db.createManualEvent(calID.calendar_id, {
        priority,
        start: new Date(startMs),
        end: new Date(endMs),
        title,
        event_id: buildManualEventId()
      });

      if (!createdEvent) {
        return res.status(500).json({ error: "Failed to create manual block" });
      }

      return res.status(201).json({
        ok: true,
        event: mapDbEventForApi(createdEvent)
      });
    } catch (error) {
      console.error('create manual event error:', error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  }

  async function deleteManualEvent(req, res) {
    if (!req.session || !req.session.userId || !req.session.isAuthenticated) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const eventId = typeof req.params?.eventId === 'string' ? req.params.eventId.trim() : '';
    if (!eventId) {
      return res.status(400).json({ error: "Invalid eventId" });
    }

    if (!eventId.startsWith('manual-')) {
      return res.status(400).json({ error: "Only manual blocks can be deleted" });
    }

    try {
      const calID = await db.getCalendarID(req.session.userId);
      if (!calID || !calID.calendar_id) {
        return res.status(404).json({ error: "Event not found" });
      }

      const deletedEvent = await db.deleteEventById(calID.calendar_id, eventId);
      if (!deletedEvent) {
        return res.status(404).json({ error: "Event not found" });
      }

      return res.status(200).json({
        ok: true,
        eventId
      });
    } catch (error) {
      console.error('delete manual event error:', error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  }

  return {
    getEvents,
    getStoredEvents,
    updateGoogleEventPriority,
    createManualEvent,
    deleteManualEvent
  };
}

module.exports = {
  createEventController
};
