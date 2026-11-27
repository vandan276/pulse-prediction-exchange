const crypto = require('crypto');
const { supabaseRest } = require('../_lib/gateway');
const {
  hashPassword,
  signSessionToken,
  buildSessionCookie,
  validateSignupInput,
} = require('../_lib/auth');

const COLORS = ['#059669', '#2563EB', '#D97706', '#E11D48', '#7C3AED', '#0891B2'];

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { username, email, password } = validateSignupInput(req.body || {});
    const passwordHash = hashPassword(password);
    const id = `usr_${crypto.randomBytes(6).toString('hex')}`;
    const avatarColor = COLORS[Math.floor(Math.random() * COLORS.length)];
    const createdAt = Date.now();

    // Check uniqueness & persist in Supabase when connected
    const existing = await supabaseRest(
      `pulse_users?or=(email.eq.${encodeURIComponent(email)},username.ilike.${encodeURIComponent(username)})&select=id,email,username`
    );
    if (Array.isArray(existing) && existing.length > 0) {
      const takenEmail = existing.some((u) => u.email?.toLowerCase() === email);
      return res.status(409).json({
        error: takenEmail
          ? 'An account with this email already exists. Please sign in.'
          : 'That username is already taken. Try another handle.',
      });
    }

    await supabaseRest('pulse_users', {
      method: 'POST',
      body: JSON.stringify({
        id,
        username,
        email,
        password_hash: passwordHash,
        avatar_color: avatarColor,
        balance_cents: 0,
      }),
    }).catch(() => {});

    const user = {
      id,
      username,
      email,
      avatarColor,
      balanceCents: 0,
      isBot: false,
      totalBets: 0,
      totalWins: 0,
      totalWageredCents: 0,
      totalWonCents: 0,
      netProfitCents: 0,
      winRate: 0,
      createdAt,
    };

    const token = signSessionToken({ userId: id, username, email, avatarColor });
    res.setHeader('Set-Cookie', buildSessionCookie(token));
    return res.status(201).json({ user, token });
  } catch (err) {
    return res.status(400).json({ error: err.message || 'Sign up failed' });
  }
};
