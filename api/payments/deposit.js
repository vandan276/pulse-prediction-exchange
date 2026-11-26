const crypto = require('crypto');
const {
  PAYMENT_METHODS,
  getEnv,
  authHeaders,
  extractError,
  supabaseRest,
} = require('../_lib/gateway');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId, asset = 'USDT-BEP20', amountCents, username } = req.body || {};
    if (!userId) return res.status(401).json({ error: 'Please sign in first' });

    const method = PAYMENT_METHODS.find((m) => m.id === asset);
    if (!method) return res.status(400).json({ error: `Unsupported asset: ${asset}` });

    const parsedAmount = Math.round(Number(amountCents || 0));
    if (parsedAmount < method.minDepositCents) {
      return res.status(400).json({
        error: `Minimum deposit for ${method.label} is $${(method.minDepositCents / 100).toFixed(2)}`,
      });
    }

    const env = getEnv();
    const id = `dep_${crypto.randomBytes(6).toString('hex')}`;
    const isLive = asset === 'USDT-BEP20' && env.provider === 'usdtautopay' && Boolean(env.apiKey);

    if (isLive) {
      const extRes = await fetch(`${env.apiBaseUrl}/api/v1/deposits/sessions`, {
        method: 'POST',
        headers: authHeaders(env.apiKey, {
          'Content-Type': 'application/json',
          'Idempotency-Key': crypto.randomUUID(),
        }),
        body: JSON.stringify({
          externalOrderId: id,
          amountUsdt: (parsedAmount / 100).toFixed(2),
          customerEmail: `${String(username || userId).replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}@pulse.exchange`,
          redirectUrl: `${env.appPublicUrl}/?deposit=${id}`,
          expiresInMinutes: 15,
        }),
      });

      const sessionData = await extRes.json().catch(() => ({}));
      if (!extRes.ok) {
        return res.status(400).json({
          error: extractError(sessionData, `USDTautopay error (HTTP ${extRes.status})`),
        });
      }

      const now = Date.now();
      const transaction = {
        id,
        userId,
        type: 'DEPOSIT',
        rail: 'CRYPTO',
        provider: 'usdtautopay',
        asset: 'USDT-BEP20',
        amountCents: parsedAmount,
        feeCents: 0,
        netCents: parsedAmount,
        destination: sessionData.depositAddress || sessionData.qrData,
        providerRef: sessionData.sessionId || id,
        status: 'PENDING',
        metadata: {
          sessionId: sessionData.sessionId,
          checkoutUrl: sessionData.checkoutUrl,
          network: sessionData.network || 'BEP20',
          token: sessionData.token || 'USDT',
          tokenContract: sessionData.tokenContract || null,
          confirmations: sessionData.confirmations ?? 0,
          requiredConfirmations: sessionData.requiredConfirmations ?? 15,
          expiresAt: sessionData.expiresAt || null,
          eta: method.eta,
          isLive: true,
        },
        createdAt: now,
        updatedAt: now,
      };

      await supabaseRest('pulse_payments', {
        method: 'POST',
        body: JSON.stringify({
          id: transaction.id,
          user_id: userId,
          type: 'DEPOSIT',
          rail: 'CRYPTO',
          provider: 'usdtautopay',
          asset: 'USDT-BEP20',
          amount_cents: parsedAmount,
          fee_cents: 0,
          net_cents: parsedAmount,
          destination: transaction.destination,
          provider_ref: transaction.providerRef,
          status: 'PENDING',
          metadata: transaction.metadata,
        }),
      }).catch(() => {});

      return res.status(200).json({ transaction, isSandbox: false });
    }

    // Sandbox fallback for non-BEP20 rails
    const now = Date.now();
    const hash = crypto.createHash('sha256').update(`${asset}:${userId}`).digest('hex');
    const destination =
      asset === 'USDT-TRC20'
        ? `T${hash.slice(0, 33).toUpperCase()}`
        : asset === 'UPI'
        ? `pulse.pay@${hash.slice(0, 6)}okaxis`
        : `0x${hash.slice(0, 40)}`;

    const transaction = {
      id,
      userId,
      type: 'DEPOSIT',
      rail: method.rail,
      provider: 'sandbox',
      asset,
      amountCents: parsedAmount,
      feeCents: 0,
      netCents: parsedAmount,
      destination,
      providerRef: `GW-DEP-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
      status: 'PENDING',
      metadata: { network: method.network, eta: method.eta, isLive: false },
      createdAt: now,
      updatedAt: now,
    };

    return res.status(200).json({ transaction, isSandbox: true });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Deposit failed' });
  }
};
