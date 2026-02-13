// ===========================================
// Invite tokens for group invitations:
// This is a self-contained module that creates and verifies 
// invite tokens for group invitations. The token is a signed, 
// base64url-encoded JSON object containing the group ID and expiration time. 
// The signature is created using HMAC with a secret key. 
// The verify function checks the signature, parses the payload, 
// and checks the expiration time.
// ===========================================

// NOTE: This is designed to be selfcontained I.e. STATAELESS
// Therefore, all the information needed to verify the token is contained within the token itself:
// - (group ID, expiration time) 
// - and the secret key (which is stored in an environment variable).


// Still confused why we aren't using ESM, but I guess we will use CommonJS for now.
const crypto = require('crypto'); // Needed for HMAC signing of HASH (GroupID + Secret) 
                                  // for safe transmission over the internet.

// Base64url encoding functions 
// adapted from https://stackoverflow.com/questions/6182315/how-can-i-do-base64-encoding-in-node-js
function b64url(buf) {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}
// Base64url decoding function
// Reverse of above encoding function.
function b64urlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Buffer.from(str, 'base64');
}

// "Sign" the payload using HMAC and a secret key (prevents tampering of the payload/token)
function sign(payloadPart, secret) {
  return b64url(crypto.createHmac('sha256', secret).update(payloadPart).digest());
}

// ===========================================
// Main functions for creating and verifying invite tokens
// ===========================================

// Create an invite token for a given group ID and expiration time (in milliseconds since epoch)
function createInviteToken({ groupId, expiresAtMs }) {
  const secret = process.env.INVITE_LINK_SECRET; // Secret key for signing the token, stored in an environment variable (must be changed semirregularly for SECURITY)
  if (!secret) throw new Error('INVITE_LINK_SECRET is required'); // PREVENT insecure token generation for SECURITY
  // Create payload {version, groupId, expiration time}
  const payload = { v: 1, gid: groupId, exp: expiresAtMs }; 
  // Encode the payload (prepare for sign)
  const payloadPart = b64url(JSON.stringify(payload));
  // Sign the payload
  const sigPart = sign(payloadPart, secret);
  return `${payloadPart}.${sigPart}`;
}

function verifyInviteToken(token) {
  // Get the secret key from environment variable (must be the same as the one used to create the token) (for MVP and isolated modularity NO DB CALLS)
  const secret = process.env.INVITE_LINK_SECRET;
  // Check structure of the token
  if (!secret) return { valid: false, reason: 'missing_secret' };
  if (!token || typeof token !== 'string') return { valid: false, reason: 'malformed' };
  const parts = token.split('.');
  if (parts.length !== 2) return { valid: false, reason: 'malformed' };
  // Separate for signature verification
  const [payloadPart, sigPart] = parts;
  // Verify the signature using a timing-safe comparison to prevent timing attacks (important for SECURITY)
  const expectedSig = sign(payloadPart, secret);
  const a = Buffer.from(sigPart);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { valid: false, reason: 'bad_signature' };
  }
  // Parse the payload and check the expiration time
  let payload;
  try {
    payload = JSON.parse(b64urlDecode(payloadPart).toString('utf8'));
  } catch {
    return { valid: false, reason: 'malformed' };
  }
  // Forward Compatability VERSIONING: 
  if (payload.v !== 1) return { valid: false, reason: 'bad_version' };
  if (typeof payload.exp !== 'number') return { valid: false, reason: 'bad_exp' };
  // Check if the token has expired (current time is greater than expiration time) NO DB CALL
  if (Date.now() > payload.exp) {
    return { valid: false, reason: 'expired', groupId: payload.gid, expiresAtMs: payload.exp };
  }
  // If all checks pass, return the group ID and expiration time (for use in the invitation flow)
  return { valid: true, groupId: payload.gid, expiresAtMs: payload.exp };
}

// CommonJS export for use in other parts of the backend (e.g., in the routes that handle group invitations)
module.exports = { createInviteToken, verifyInviteToken };
