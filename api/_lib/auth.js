const crypto = require('crypto');

const AUTH_SECRET =
  process.env.AUTH_SECRET ||
  process.env.PAYMENT_WEBHOOK_SECRET ||
  'pulse_exchange_session_signing_secret_v1';

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(password, storedHash) {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [salt, keyHex] = storedHash.split(':');
  const derived = crypto.scryptSync(String(password), salt, 64);
  const storedBuf = Buffer.from(keyHex, 'hex');
  return derived.length === storedBuf.length && crypto.timingSafeEqual(derived, storedBuf);
}

function signSessionToken(payload) {
  const body = Buffer.from(
    JSON.stringify({
      ...payload,
      iat: Date.now(),
      exp: Date.now() + 1000 * 60 * 60 * 24 * 14, // 14 days
    }),
    'utf8'
  ).toString('base64url');
  const sig = crypto
    .createHmac('sha256', AUTH_SECRET)
    .update(body)
    .digest('base64url');
  return `${body}.${sig}`;
}

function verifySessionToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  const expected = crypto
    .createHmac('sha256', AUTH_SECRET)
    .update(body)
    .digest('base64url');
  const a = Buffer.from(sig, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!parsed.exp || Date.now() > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}

function extractTokenFromReq(req) {
  const auth = req.headers?.authorization || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7).trim();
  const cookieHeader = req.headers?.cookie || '';
  const match = cookieHeader
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith('pulse_session='));
  return match ? decodeURIComponent(match.slice('pulse_session='.length)) : null;
}

function buildSessionCookie(token) {
  const isProd = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
  const secure = isProd ? '; Secure' : '';
  return `pulse_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 14}${secure}`;
}

function buildClearCookie() {
  return 'pulse_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0';
}

function validateSignupInput({ username, email, password }) {
  const cleanUsername = String(username || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 20);
  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanPassword = String(password || '');

  if (cleanUsername.length < 3) {
    throw new Error('Username must be at least 3 alphanumeric characters.');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw new Error('Please enter a valid email address.');
  }
  if (cleanPassword.length < 6) {
    throw new Error('Password must be at least 6 characters long.');
  }

  return { username: cleanUsername, email: cleanEmail, password: cleanPassword };
}

module.exports = {
  hashPassword,
  verifyPassword,
  signSessionToken,
  verifySessionToken,
  extractTokenFromReq,
  buildSessionCookie,
  buildClearCookie,
  validateSignupInput,
};
