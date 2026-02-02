// server.js
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors')
require('dotenv').config();

const app = express();
app.use(cors()); // this is just for development - do origin, credentials when deployed
const PORT = process.env.PORT || 3000;

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Middleware
app.use(express.json());

// Test route
app.get('/', (req, res) => {
  res.json({ message: 'Social Scheduler API is running!' });
});

// Database test route
app.get('/api/test-db', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ 
      success: true, 
      timestamp: result.rows[0].now,
      message: 'Database connected successfully!' 
    });
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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});