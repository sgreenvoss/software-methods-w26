const http = require('http');
const https = require('https');
const url = require('url');
const { google } = require('googleapis');
const crypto = require('crypto');
const express = require('express');
const session = require('express-session');
const fs = require('fs/promises');
require('dotenv').config();

/**
 * To use OAuth2 authentication, we need access to a CLIENT_ID, CLIENT_SECRET, AND REDIRECT_URI.
 * To get these credentials for your application, visit
 * https://console.cloud.google.com/apis/credentials.
 */
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);


// Access scopes for two non-Sign-In scopes: Read-only Drive activity and Google Calendar.
const scopes = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile'
];
/* Global variable that stores user credential in this code example.
 * ACTION ITEM for developers:
 *   Store user's refresh token in your data store if
 *   incorporating this code into your real app.
 *   For more information on handling refresh tokens,
 *   see https://github.com/googleapis/google-api-nodejs-client#handling-refresh-tokens
 */
let userCredential = null;

// this example is mostly copied from https://developers.google.com/workspace/calendar/api/quickstart/nodejs#set_up_the_sample
async function listEvents(auth, filePath) {
  const calendar = google.calendar({version: 'v3', auth});
  const result = await calendar.events.list({
    calendarId: "primary",
    timeMin: new Date().toISOString(),
    maxResults: 10,
    singleEvents:true,
    orderBy:'startTime',
  });

  const events = result.data.items.map(event => {
    const start = event.start?.dateTime ?? event.start?.date;
    return `${start} - ${event.summary}`;
  });

  await fs.writeFile(filePath, events.join('\n'));
}

async function getUserInfo(auth, filePath, users) {
  const people = google.people({version: 'v1', auth: auth});
  const result = await people.people.get({
    resourceName: 'people/me',
    personFields: 'names,emailAddresses',
  });

  let name;
  let email;
  let user;

  const profile = result.data;

  if (profile.names && profile.names.length > 0) {
    name = profile.names[0].displayName;
  }

  if (profile.emailAddresses && profile.emailAddresses.length > 0) {
    email = profile.emailAddresses[0].value;
  }

  if (users.some(user => user.email === email) !== true) {
    const userId = crypto.randomUUID();
    user = {
      email: email,
      name: name,
      userId: userId,
      groupIds: []
    };

    users.push(user);
    console.log("new user: ", user.userId);
    fs.appendFile(filePath, "Welcome, new user!\n");
  } else {    
    user = users.find(user => user.email === email);
    console.log("returning user: ", user.userId);
    fs.appendFile(filePath, "Welcome back, " + user.name + "!\n");
  }

}

async function main() {
  const app = express();
  app.use(express.static('public'));

  app.use(session({
    secret: process.env.SESSION_SECRET, 
    resave: false,
    saveUninitialized: false,
  }));

  // Example on redirecting user to Google's OAuth 2.0 server.
  app.get('/', async (req, res) => {
    // Generate a secure random state value.
    const state = crypto.randomBytes(32).toString('hex');
    // Store state in the session
    req.session.state = state;

    // Generate a url that asks permissions for the Drive activity and Google Calendar scope
    const authorizationUrl = oauth2Client.generateAuthUrl({
      // 'online' (default) or 'offline' (gets refresh_token)
      access_type: 'offline',
      /** Pass in the scopes array defined above.
        * Alternatively, if only one scope is needed, you can pass a scope URL as a string */
      scope: scopes,
      // Enable incremental authorization. Recommended as a best practice.
      include_granted_scopes: true,
      // Include the state parameter to reduce the risk of CSRF attacks.
      state: state
    });

    res.redirect(authorizationUrl);
  });

  users = [];

 // Receive the callback from Google's OAuth 2.0 server.
  app.get('/oauth2callback', async (req, res) => {
    let q = url.parse(req.url, true).query;

    if (q.error) {
      return res.redirect('/error.html');
    }

    if (q.state !== req.session.state) {
      return res.redirect('/error.html');
    }

    let { tokens } = await oauth2Client.getToken(q.code);
    oauth2Client.setCredentials(tokens);
    userCredential = tokens;

    if (tokens.scope.includes("https://www.googleapis.com/auth/calendar.readonly")) {
      // Write events to a text file inside /public
      await listEvents(oauth2Client, 'public/events.txt');

      // Redirect user to the main webpage
      return res.redirect('/main.html');
    }

    return res.redirect('/error.html');
  });

  const server = http.createServer(app);
  server.listen(8080);
}
main().catch(console.error);