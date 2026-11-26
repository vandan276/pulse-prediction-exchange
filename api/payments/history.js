const { supabaseRest } = require('../_lib/gateway');

module.exports = async function handler(req, res) {
  const userId = req.query.userId;
  if (!userId) return res.status(200).json({ transactions: [] });

  try {
    const rows = await supabaseRest(
      `pulse_payments?user_id=eq.${encodeURIComponent(userId)}&order=created_at.desc&limit=40`
    );
    if (Array.isArray(rows)) {
      const transactions = rows.map((r) => ({
        id: r.id,
        userId: r.user_id,
        type: r.type,
        rail: r.rail,
        provider: r.provider,
        asset: r.asset,
        amountCents: Number(r.amount_cents),
        feeCents: Number(r.fee_cents),
        netCents: Number(r.net_cents),
        destination: r.destination,
        providerRef: r.provider_ref,
        status: r.status,
        metadata: r.metadata || {},
        createdAt: r.created_at ? Date.parse(r.created_at) : Date.now(),
        updatedAt: r.updated_at ? Date.parse(r.updated_at) : Date.now(),
      }));
      return res.status(200).json({ transactions });
    }
    return res.status(200).json({ transactions: [] });
  } catch {
    return res.status(200).json({ transactions: [] });
  }
};
