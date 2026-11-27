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
    const { userId, username, asset = 'USDT-BEP20', amountCents, destination } = req.body || {};
    if (!userId) return res.status(401).json({ error: 'Please sign in first' });

    const method = PAYMENT_METHODS.find((m) => m.id === asset);
    if (!method) return res.status(400).json({ error: `Unsupported payout method: ${asset}` });

    const cleanDest = String(destination || '').trim();
    if (cleanDest.length < 5) {
      return res.status(400).json({ error: `Enter a valid ${method.label} destination` });
    }

    const parsedAmount = Math.round(Number(amountCents || 0));
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({
        error: 'Please enter a withdrawal amount greater than $0.00',
      });
    }

    const feeCents = method.withdrawFeeFlatCents;
    const netCents = parsedAmount - feeCents;
    if (netCents <= 0) return res.status(400).json({ error: 'Amount must exceed fee' });

    const env = getEnv();
    const id = `wd_${crypto.randomBytes(6).toString('hex')}`;
    const isLive = asset === 'USDT-BEP20' && env.provider === 'usdtautopay' && Boolean(env.apiKey);

    if (isLive) {
      // 1. Live-verify BEP-20 address on BSC Mainnet
      const vRes = await fetch(`${env.apiBaseUrl}/api/v1/beneficiaries/verify`, {
        method: 'POST',
        headers: authHeaders(env.apiKey, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({ address: cleanDest }),
      });
      const vData = await vRes.json().catch(() => ({}));
      if (!vRes.ok || !vData.valid) {
        return res.status(400).json({
          error: extractError(vData, 'Invalid BSC BEP-20 wallet address'),
        });
      }

      const checksumAddress = vData.checksumAddress || cleanDest;

      // 2. Queue 2-hop relayed payout on USDTautopay
      const pRes = await fetch(`${env.apiBaseUrl}/api/v1/payouts`, {
        method: 'POST',
        headers: authHeaders(env.apiKey, {
          'Content-Type': 'application/json',
          'Idempotency-Key': id,
        }),
        body: JSON.stringify({
          externalPayoutId: id,
          amountUsdt: (netCents / 100).toFixed(2),
          destinationAddress: checksumAddress,
          beneficiaryLabel: username || userId,
        }),
      });
      const pData = await pRes.json().catch(() => ({}));
      if (!pRes.ok) {
        return res.status(400).json({
          error: extractError(pData, `USDTautopay payout failed (HTTP ${pRes.status})`),
        });
      }

      const now = Date.now();
      const transaction = {
        id,
        userId,
        type: 'WITHDRAWAL',
        rail: 'CRYPTO',
        provider: 'usdtautopay',
        asset: 'USDT-BEP20',
        amountCents: parsedAmount,
        feeCents,
        netCents,
        destination: checksumAddress,
        providerRef: pData.payoutId || id,
        status: 'PROCESSING',
        metadata: {
          network: 'BEP20',
          eta: pData.estimatedCreditWindow || '10–15 minutes',
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
          type: 'WITHDRAWAL',
          rail: 'CRYPTO',
          provider: 'usdtautopay',
          asset: 'USDT-BEP20',
          amount_cents: parsedAmount,
          fee_cents: feeCents,
          net_cents: netCents,
          destination: checksumAddress,
          provider_ref: transaction.providerRef,
          status: 'PROCESSING',
          metadata: transaction.metadata,
        }),
      }).catch(() => {});

      return res.status(200).json({ transaction, isSandbox: false });
    }

    // Sandbox withdrawal for other rails
    const now = Date.now();
    const transaction = {
      id,
      userId,
      type: 'WITHDRAWAL',
      rail: method.rail,
      provider: 'sandbox',
      asset,
      amountCents: parsedAmount,
      feeCents,
      netCents,
      destination: cleanDest,
      providerRef: `GW-WD-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
      status: 'COMPLETED',
      metadata: { network: method.network, eta: method.eta, isLive: false },
      createdAt: now,
      updatedAt: now,
    };
    return res.status(200).json({ transaction, isSandbox: true });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Withdrawal failed' });
  }
};
