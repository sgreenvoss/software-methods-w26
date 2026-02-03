// server.js
const express = require('express');
const { google } = require('googleapis');
const cors = require('cors')
require('dotenv').config();
const db = require("./db/index");

const app = express();
//const {testConnection} = require('./data_interface.js');
//const authRoutes = require('./routes/auth');
//const userRoutes = require('./routes/person');
//const { attachUser } = require('./middleware/auth');

app.use(cors()); // this is just for development - do origin, credentials when deployed
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Test route
app.get('/', (req, res) => {
  res.json({ message: 'Social Scheduler API is running!' });
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

app.get('/', async (req, res) => {
//     // Generate a secure random state value.
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
});

// app.get('/google', 
// )
const res = db.getUsersWithName('stella');
console.log(res);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});