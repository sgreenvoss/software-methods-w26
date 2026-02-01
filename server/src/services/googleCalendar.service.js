import { google } from 'googleapis';

const scopes = ['https://www.googleapis.com/auth/calendar.readonly'];

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export function buildAuthUrl(state) {
  requireEnv('GOOGLE_CLIENT_ID');
  requireEnv('GOOGLE_CLIENT_SECRET');
  requireEnv('GOOGLE_REDIRECT_URI');
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    include_granted_scopes: true,
    state,
  });
}

export async function exchangeCodeForTokens(code) {
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

export function getCalendarClient(tokens) {
  oauth2Client.setCredentials(tokens);
  return google.calendar({ version: 'v3', auth: oauth2Client });
}

export async function listUpcomingEvents(tokens, maxResults = 10) {
  const calendar = getCalendarClient(tokens);
  const result = await calendar.events.list({
    calendarId: 'primary',
    timeMin: new Date().toISOString(),
    maxResults,
    singleEvents: true,
    orderBy: 'startTime',
  });

  return result.data.items || [];
}

export async function listEventsInWindow(tokens, timeMin, timeMax) {
  const calendar = getCalendarClient(tokens);
  const items = [];
  let pageToken;

  do {
    const result = await calendar.events.list({
      calendarId: 'primary',
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 250,
      pageToken,
    });

    items.push(...(result.data.items || []));
    pageToken = result.data.nextPageToken;
  } while (pageToken);

  return items;
}
