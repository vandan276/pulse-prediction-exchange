const { getEnv, verifyWebhookSignature, supabaseRest } = require('../_lib/gateway');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const env = getEnv();
    const sig = req.headers['x-gateway-signature'];
    const headerEvent = req.headers['x-gateway-event'];
    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});

    if (!verifyWebhookSignature(rawBody, sig, env.webhookSecret)) {
      return res.status(401).json({ error: 'Invalid X-Gateway-Signature' });
    }

    const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const event = String(headerEvent || payload.event || '');
    const data = payload.data || payload;
    const orderId = data.externalOrderId || data.externalPayoutId || data.transactionId;

    if (event === 'deposit.confirmed' && orderId) {
      await supabaseRest(`pulse_payments?id=eq.${encodeURIComponent(orderId)}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'COMPLETED', provider_ref: data.txHash || data.sessionId }),
      }).catch(() => {});
    } else if ((event === 'payout.completed' || event === 'payout.rejected') && orderId) {
      await supabaseRest(`pulse_payments?id=eq.${encodeURIComponent(orderId)}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: event === 'payout.completed' ? 'COMPLETED' : 'FAILED',
          provider_ref: data.txHash || data.payoutId,
        }),
      }).catch(() => {});
    }

    return res.status(200).json({ received: true, event });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};
