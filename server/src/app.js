import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import authRoutes from './routes/auth.routes.js';
import availabilityRoutes from './routes/availability.routes.js';
import eventsRoutes from './routes/events.routes.js';
import groupsRoutes from './routes/groups.routes.js';
import peopleRoutes from './routes/people.routes.js';

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-session-secret',
  resave: false,
  saveUninitialized: false,
}));

app.use(express.static('public'));

app.use('/auth', authRoutes);
app.use('/availability', availabilityRoutes);
app.use('/events', eventsRoutes);
app.use('/groups', groupsRoutes);
app.use('/people', peopleRoutes);

// Backwards-compatible OAuth callback for the old demo.
app.get('/oauth2callback', (req, res, next) => {
  req.url = '/callback' + (req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '');
  authRoutes(req, res, next);
});

app.get('/', (req, res) => {
  res.redirect('/auth/start');
});

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

// Simple error handler so missing envs surface in the browser.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`server listening on ${port}`);
});
