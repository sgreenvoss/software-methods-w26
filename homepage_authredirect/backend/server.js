require("dotenv").config();

const express = require("express");
const path = require("path");

const http = require('http');
const https = require('https');
const url = require('url');
const { google } = require('googleapis');
const crypto = require('crypto');
const session = require('express-session');
const fs = require('fs/promises');

const app = express();
const PORT = 8080;

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

const scopes = [
  'https://www.googleapis.com/auth/calendar.readonly'
];

// Serve frontend folder
app.use(express.static(path.join(__dirname, "..", "frontendv2")));

// Check that the server works
app.get("/", (req, res) => {
  res.send("Server is running");
});

// Google Oauth Connection
async function main() {
  const app = express();
  app.use(express.static(path.join(__dirname, "..", "frontendv2")));
  
  app.use(session({
    secret: process.env.SESSION_SECRET, 
    resave: false,
    saveUninitialized: false,
  }));

  // Example on redirecting user to Google's OAuth 2.0 server.
  app.get('/auth/google', async (req, res) => {
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
      // Redirect user to the main webpage
      return res.redirect('/index.html');
    }

    return res.redirect('/error.html');
  });

  const server = http.createServer(app);
  server.listen(8080);
}
main().catch(console.error);


app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
