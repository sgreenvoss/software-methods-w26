const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const db = require("./db");
const path = require("path");

const email = require('./emailer');
const groupModule = require("./groups");
const authRoutes = require('./routes/auth');
const calendarRoutes = require('./routes/calendar');

const app = express();
app.use(express.json());


// .env config
require('dotenv').config({
  path: process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development'
});
const isProduction = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT || 3000;

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

app.get('/test-session', (req, res) => {
  res.json({
    sessionID: req.sessionID,
    userId: req.session.userId,
    isAuthenticated: req.session.isAuthenticated,
    fullSession: req.session
  });
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


// Use your modular routes
app.use('/', authRoutes);
app.use('/api', calendarRoutes);
groupModule(app);

app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  
});
// app.listen(process.env.PORT || 3000, () => console.log('Server Cleaned Up!'));