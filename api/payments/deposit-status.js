const { getEnv, authHeaders, supabaseRest } = require('../_lib/gateway');

module.exports = async function handler(req, res) {
  try {
    const id = req.query.id;
    const sessionId = req.query.sessionId || id;
    const env = getEnv();

    if (!env.apiKey || !sessionId) {
      return res.status(400).json({ error: 'Missing sessionId' });
    }

    const extRes = await fetch(
      `${env.apiBaseUrl}/api/v1/deposits/sessions/${encodeURIComponent(sessionId)}`,
      { headers: authHeaders(env.apiKey) }
    );
    const live = await extRes.json().catch(() => ({}));
    if (!extRes.ok) {
      return res.status(extRes.status).json({ error: live.error?.message || 'Unable to sync status' });
    }

    const liveStatus = String(live.status || 'PENDING').toUpperCase();
    const mappedStatus =
      liveStatus === 'CONFIRMED' || liveStatus === 'COMPLETED'
        ? 'COMPLETED'
        : liveStatus === 'EXPIRED'
        ? 'FAILED'
        : 'PENDING';

    if (mappedStatus === 'COMPLETED' && id) {
      await supabaseRest(`pulse_payments?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'COMPLETED',
          provider_ref: live.txHash || sessionId,
        }),
      }).catch(() => {});
    }

    return res.status(200).json({
      transaction: {
        id: id || live.externalOrderId || sessionId,
        type: 'DEPOSIT',
        rail: 'CRYPTO',
        provider: 'usdtautopay',
        asset: 'USDT-BEP20',
        amountCents: Math.round(parseFloat(live.amountUsdt || '0') * 100),
        feeCents: 0,
        netCents: Math.round(parseFloat(live.amountUsdt || '0') * 100),
        destination: live.depositAddress,
        providerRef: live.txHash || live.sessionId || sessionId,
        status: mappedStatus,
        metadata: {
          sessionId: live.sessionId,
          checkoutUrl: live.checkoutUrl,
          network: live.network || 'BEP20',
          confirmations: live.confirmations ?? 0,
          requiredConfirmations: live.requiredConfirmations ?? 15,
          liveStatus,
          isLive: true,
        },
        createdAt: live.createdAt ? Date.parse(live.createdAt) : Date.now(),
        updatedAt: Date.now(),
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Status sync failed' });
  }
};
