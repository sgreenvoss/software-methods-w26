import crypto from 'crypto';
import { buildAuthUrl, exchangeCodeForTokens } from '../services/googleCalendar.service.js';

export async function startOAuth(req, res, next) {
  try {
    const state = crypto.randomBytes(32).toString('hex');
    req.session.oauthState = state;

    const authorizationUrl = buildAuthUrl(state);
    res.redirect(authorizationUrl);
  } catch (err) {
    next(err);
  }
}

export async function handleOAuthCallback(req, res, next) {
  try {
    const { state, code, error } = req.query;

    if (error) {
      return res.redirect('/error.html');
    }

    if (!state || state !== req.session.oauthState) {
      return res.redirect('/error.html');
    }

    const tokens = await exchangeCodeForTokens(code);
    req.session.tokens = tokens;

    return res.redirect('/main.html');
  } catch (err) {
    next(err);
  }
}
