/*
File: inviteToken.js
Purpose: Creates and verifies stateless invite tokens for group invitations.
    The token carries the group id and expiration time in a signed payload.
*/

const crypto = require('crypto');

// Encode the token parts with URL-safe Base64 so they can travel in invite links.
function b64url(buf) {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}
// Decode the URL-safe Base64 payload back into the raw JSON bytes.
function b64urlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Buffer.from(str, 'base64');
}

// Sign the payload so tampering shows up during verification.
function sign(payloadPart, secret) {
  return b64url(crypto.createHmac('sha256', secret).update(payloadPart).digest());
}

// Create the signed invite token the routes send back to the frontend.
function createInviteToken({ groupId, expiresAtMs }) {
  const secret = process.env.INVITE_LINK_SECRET;
  if (!secret) throw new Error('INVITE_LINK_SECRET is required');

  // Keep the payload small so it is easy to round-trip in a URL query string.
  const payload = { v: 1, gid: groupId, exp: expiresAtMs }; 
  const payloadPart = b64url(JSON.stringify(payload));
  const sigPart = sign(payloadPart, secret);
  return `${payloadPart}.${sigPart}`;
}

function verifyInviteToken(token) {
  // Verify the token without a database lookup so invite links stay stateless.
  const secret = process.env.INVITE_LINK_SECRET;
  if (!secret) return { valid: false, reason: 'missing_secret' };
  if (!token || typeof token !== 'string') return { valid: false, reason: 'malformed' };
  const parts = token.split('.');
  if (parts.length !== 2) return { valid: false, reason: 'malformed' };

  const [payloadPart, sigPart] = parts;

  // Use a timing-safe comparison so bad signatures do not leak information.
  const expectedSig = sign(payloadPart, secret);
  const a = Buffer.from(sigPart);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { valid: false, reason: 'bad_signature' };
  }
  // Parse the payload only after the signature passes.
  let payload;
  try {
    payload = JSON.parse(b64urlDecode(payloadPart).toString('utf8'));
  } catch {
    return { valid: false, reason: 'malformed' };
  }
  // Keep a version field so future invite formats can fail cleanly.
  if (payload.v !== 1) return { valid: false, reason: 'bad_version' };
  if (typeof payload.exp !== 'number') return { valid: false, reason: 'bad_exp' };

  // Reject expired invites before the routes try to act on them.
  if (Date.now() > payload.exp) {
    return { valid: false, reason: 'expired', groupId: payload.gid, expiresAtMs: payload.exp };
  }
  return { valid: true, groupId: payload.gid, expiresAtMs: payload.exp };
}

// Export the token helpers for the invite routes.
module.exports = { createInviteToken, verifyInviteToken };
