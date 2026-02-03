// server.js
const express = require('express');
const cors = require('cors')
require('dotenv').config();

const app = express();
//const {testConnection} = require('./data_interface.js');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/person');
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

app.use('/auth', authRoutes);
app.use('api/users', userRoutes);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});