const { supabaseRest } = require('../_lib/gateway');
const {
  verifyPassword,
  signSessionToken,
  buildSessionCookie,
} = require('../_lib/auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { identifier, email, password } = req.body || {};
    const loginId = String(identifier || email || '').trim().toLowerCase();
    const rawPass = String(password || '');

    if (!loginId || !rawPass) {
      return res.status(400).json({ error: 'Enter your email/username and password.' });
    }

    const rows = await supabaseRest(
      `pulse_users?or=(email.eq.${encodeURIComponent(loginId)},username.ilike.${encodeURIComponent(loginId)})&limit=1`
    );

    if (Array.isArray(rows) && rows.length > 0) {
      const row = rows[0];
      if (!verifyPassword(rawPass, row.password_hash)) {
        return res.status(401).json({ error: 'Invalid email or password.' });
      }

      const user = {
        id: row.id,
        username: row.username,
        email: row.email,
        avatarColor: row.avatar_color || '#059669',
        balanceCents: Number(row.balance_cents || 0),
        isBot: false,
        totalBets: Number(row.total_bets || 0),
        totalWins: Number(row.total_wins || 0),
        totalWageredCents: Number(row.total_wagered_cents || 0),
        totalWonCents: Number(row.total_won_cents || 0),
        netProfitCents: Number(row.total_won_cents || 0) - Number(row.total_wagered_cents || 0),
        winRate:
          Number(row.total_bets || 0) > 0
            ? Number(((Number(row.total_wins || 0) / Number(row.total_bets || 0)) * 100).toFixed(1))
            : 0,
        createdAt: row.created_at ? Date.parse(row.created_at) : Date.now(),
      };

      const token = signSessionToken({
        userId: user.id,
        username: user.username,
        email: user.email,
        avatarColor: user.avatarColor,
      });
      res.setHeader('Set-Cookie', buildSessionCookie(token));
      return res.status(200).json({ user, token });
    }

    return res.status(401).json({
      error: 'No account found with those credentials. Please sign up first.',
      code: 'ACCOUNT_NOT_FOUND',
    });
  } catch (err) {
    return res.status(400).json({ error: err.message || 'Sign in failed' });
  }
};
