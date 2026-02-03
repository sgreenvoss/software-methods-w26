// // backend/middleware/validation.js

// const validateUsername = (req, res, next) => {
//   const { username } = req.body;
  
//   if (!username) {
//     return res.status(400).json({ error: 'Username is required' });
//   }
  
//   // Username validation rules
//   if (username.length < 3) {
//     return res.status(400).json({ error: 'Username must be at least 3 characters' });
//   }
  
//   if (username.length > 50) {
//     return res.status(400).json({ error: 'Username must be less than 50 characters' });
//   }
  
//   // Only allow alphanumeric, underscores, and hyphens
//   const usernameRegex = /^[a-zA-Z0-9_-]+$/;
//   if (!usernameRegex.test(username)) {
//     return res.status(400).json({ 
//       error: 'Username can only contain letters, numbers, underscores, and hyphens' 
//     });
//   }
  
//   next();
// };

// module.exports = {
//   validateUsername
// };