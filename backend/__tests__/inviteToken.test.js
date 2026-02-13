// =======================
// Tests for inviteToken.js
// =======================

const { createInviteToken, verifyInviteToken } = require('../inviteToken');


const crypto = require('crypto');

function b64urlFromString(s) {
  return Buffer.from(s, 'utf8')
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function hmacB64url(payloadPart, secret) {
  return crypto
    .createHmac('sha256', secret)
    .update(payloadPart)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

describe('inviteToken', () => {
  const old = process.env.INVITE_LINK_SECRET;

  beforeEach(() => {
    process.env.INVITE_LINK_SECRET = 'test-secret';
  });

  afterAll(() => {
    process.env.INVITE_LINK_SECRET = old;
  });

  test('valid token verifies', () => {
    const exp = Date.now() + 60_000;
    const token = createInviteToken({ groupId: 123, expiresAtMs: exp });

    const res = verifyInviteToken(token);
    expect(res.valid).toBe(true);
    expect(res.groupId).toBe(123);
    expect(res.expiresAtMs).toBe(exp);
  });

  test('tampered token fails', () => {
    const exp = Date.now() + 60_000;
    const token = createInviteToken({ groupId: 123, expiresAtMs: exp });

    // flip one character somewhere
    const tampered = token.slice(0, -1) + (token.endsWith('A') ? 'B' : 'A');

    const res = verifyInviteToken(tampered);
    expect(res.valid).toBe(false);
  });

  test('expired token fails with reason=expired', () => {
    const exp = Date.now() - 1;
    const token = createInviteToken({ groupId: 123, expiresAtMs: exp });

    const res = verifyInviteToken(token);
    expect(res.valid).toBe(false);
    expect(res.reason).toBe('expired');
  });

  // createInviteToken throws when INVITE_LINK_SECRET missing
  test('createInviteToken throws without secret', () => {
    // Temporarily remove the secret
    const oldSecret = process.env.INVITE_LINK_SECRET;
    delete process.env.INVITE_LINK_SECRET;
    expect(() => createInviteToken({ groupId: 123, expiresAtMs: Date.now() + 60_000 })).toThrow('INVITE_LINK_SECRET is required');
  });

  test('bad_signature when signature is wrong but same length', () => {
    const exp = Date.now() + 60_000;
    const token = createInviteToken({ groupId: 123, expiresAtMs: exp });

    const [payloadPart, sigPart] = token.split('.');
    // flip last char of sigPart but keep length the same
    const flipped = sigPart.slice(0, -1) + (sigPart.endsWith('A') ? 'B' : 'A');
    const tampered = `${payloadPart}.${flipped}`;

    const res = verifyInviteToken(tampered);
    expect(res.valid).toBe(false);
    expect(res.reason).toBe('bad_signature');
  });

  test('bad_signature when signature length is wrong (should not crash)', () => {
    const exp = Date.now() + 60_000;
    const token = createInviteToken({ groupId: 123, expiresAtMs: exp });

    const [payloadPart] = token.split('.');
    const tampered = `${payloadPart}.x`; // wrong length

    const res = verifyInviteToken(tampered);
    expect(res.valid).toBe(false);
    expect(res.reason).toBe('bad_signature');
  });

  test('malformed when payload is not valid JSON but signature is valid', () => {
    const secret = process.env.INVITE_LINK_SECRET; // should be set by your beforeEach
    expect(secret).toBeTruthy();

    // payloadPart decodes to "not json" (valid utf8, invalid JSON)
    const badPayloadPart = b64urlFromString('not json');

    // compute a matching signature so it passes signature check
    const sigPart = hmacB64url(badPayloadPart, secret);

    const token = `${badPayloadPart}.${sigPart}`;

    const res = verifyInviteToken(token);
    expect(res.valid).toBe(false);
    expect(res.reason).toBe('malformed');  // <-- should hit line 82
  });

  test('malformed when token is not a string', () => {
    const res = verifyInviteToken(123);
    expect(res.valid).toBe(false);
    expect(res.reason).toBe('malformed');
  });

  test('malformed when token has wrong number of parts', () => {
    const res = verifyInviteToken('a.b.c');
    expect(res.valid).toBe(false);
    expect(res.reason).toBe('malformed');
  });

  test('bad_version when payload v != 1 (signed correctly)', () => {
    const secret = process.env.INVITE_LINK_SECRET;

    const payloadObj = { v: 2, gid: 123, exp: Date.now() + 60_000 };
    const payloadPart = Buffer.from(JSON.stringify(payloadObj), 'utf8')
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    const sigPart = require('crypto')
      .createHmac('sha256', secret)
      .update(payloadPart)
      .digest('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    const token = `${payloadPart}.${sigPart}`;

    const res = verifyInviteToken(token);
    expect(res.valid).toBe(false);
    expect(res.reason).toBe('bad_version');
  });

  test('bad_exp when payload exp is not a number (signed correctly)', () => {
    const secret = process.env.INVITE_LINK_SECRET;

    const payloadObj = { v: 1, gid: 123, exp: "tomorrow" };
    const payloadPart = Buffer.from(JSON.stringify(payloadObj), 'utf8')
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    const sigPart = require('crypto')
      .createHmac('sha256', secret)
      .update(payloadPart)
      .digest('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    const token = `${payloadPart}.${sigPart}`;

    const res = verifyInviteToken(token);
    expect(res.valid).toBe(false);
    expect(res.reason).toBe('bad_exp');
  });


  // Just for coverage
  test('missing_secret when INVITE_LINK_SECRET is not set', () => {
    const prev = process.env.INVITE_LINK_SECRET;
    delete process.env.INVITE_LINK_SECRET;

    const res = verifyInviteToken('anything.anything');
    expect(res.valid).toBe(false);
    expect(res.reason).toBe('missing_secret');

    process.env.INVITE_LINK_SECRET = prev;
  });

});




