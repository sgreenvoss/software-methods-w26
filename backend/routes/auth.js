const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { oauth2Client, scopes } = require('../config/google');
const url = require('url');
const { google } = require('googleapis');
const db = require("../db/index");

// .env config
require('dotenv').config({
  path: process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development'
});
const frontend = process.env.FRONTEND_URL;


router.get('/auth/google', async (req, res) => {
  const state = crypto.randomBytes(32).toString('hex');
  req.session.state = state;
  req.session.pending_username = req.query.username;

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: scopes,
    state: state
  });
  res.redirect(url);
});


router.get('/oauth2callback', async (req, res) => {
  const q = url.parse(req.url, true).query;

  // Security checks
  if (q.error) {
    console.log(q);
    return res.redirect(frontend + '/error.html');
  }

  try {
    const { tokens } = await oauth2Client.getToken(q.code);
    oauth2Client.setCredentials(tokens);

    const oauth2 = google.oauth2({version: 'v2', auth: oauth2Client});
    const {data: userInfo} = await oauth2.userinfo.get();

    console.log('in the callback, username is ' + req.session.pending_username);

    console.log("expiry date is", tokens.expiry_date);

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
    console.log("authorization error: ", authErr);
    res.redirect('/login'); // was /login fail - should we make that?
  }
});


router.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return console.log(err);
    }
    res.redirect('/login');
  });
});

module.exports = router;