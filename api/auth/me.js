const { supabaseRest } = require('../_lib/gateway');
const { extractTokenFromReq, verifySessionToken } = require('../_lib/auth');

module.exports = async function handler(req, res) {
  const token = extractTokenFromReq(req);
  const claims = verifySessionToken(token);
  if (!claims) {
    return res.status(401).json({ user: null });
  }

  const rows = await supabaseRest(
    `pulse_users?id=eq.${encodeURIComponent(claims.userId)}&limit=1`
  ).catch(() => null);

  if (Array.isArray(rows) && rows.length > 0) {
    const row = rows[0];
    return res.status(200).json({
      user: {
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
      },
    });
  }

  return res.status(200).json({
    user: {
      id: claims.userId,
      username: claims.username,
      email: claims.email,
      avatarColor: claims.avatarColor || '#059669',
      balanceCents: 0,
      isBot: false,
      totalBets: 0,
      totalWins: 0,
      totalWageredCents: 0,
      totalWonCents: 0,
      netProfitCents: 0,
      winRate: 0,
      createdAt: claims.iat || Date.now(),
    },
  });
};
