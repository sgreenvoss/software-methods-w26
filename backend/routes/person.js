// // backend/routes/users.js
// const express = require('express');
// const router = express.Router();
// const { requireAuth } = require('../middleware/auth');
// const { validateUsername } = require('../middleware/validation');
// const { updateUsername, findUserByEmail } = require('../models/person');

// // Get current user profile
// router.get('/me', requireAuth, async (req, res) => {
//   try {
//     // req.user should be attached by attachUser middleware
//     res.json(req.user);
//   } catch (error) {
//     console.error('Error fetching user:', error);
//     res.status(500).json({ error: 'Failed to fetch user profile' });
//   }
// });

// // Update username
// router.patch('/me/username', requireAuth, validateUsername, async (req, res) => {
//   try {
//     const { username } = req.body;
//     const userId = req.session.userId;
    
//     // Check if username is already taken
//     const existingUser = await findUserByEmail(username); // You might want a findByUsername instead
//     if (existingUser && existingUser.id !== userId) {
//       return res.status(409).json({ error: 'Username already taken' });
//     }
    
//     const updatedUser = await updateUsername(userId, username);
//     res.json(updatedUser);
//   } catch (error) {
//     console.error('Error updating username:', error);
    
//     // Handle unique constraint violation
//     if (error.code === '23505') { // PostgreSQL unique violation code
//       return res.status(409).json({ error: 'Username already taken' });
//     }
    
//     res.status(500).json({ error: 'Failed to update username' });
//   }
// });

// module.exports = router;