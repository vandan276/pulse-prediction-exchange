const crypto = require('crypto');

const PAYMENT_METHODS = [
  {
    id: 'USDT-BEP20',
    rail: 'CRYPTO',
    label: 'USDT (BEP-20)',
    network: 'BSC Mainnet · USDTautopay',
    minDepositCents: 0,
    maxDepositCents: 10_000_000,
    minWithdrawCents: 0,
    maxWithdrawCents: 5_000_000,
    depositFeeFlatCents: 0,
    withdrawFeeFlatCents: 100,
    eta: '~1–3 mins (15 conf)',
    placeholder: '0x... (BSC BEP-20 wallet address)',
    liveGateway: true,
  },
  {
    id: 'USDT-TRC20',
    rail: 'CRYPTO',
    label: 'USDT (TRC20)',
    network: 'TRON',
    minDepositCents: 0,
    maxDepositCents: 10_000_000,
    minWithdrawCents: 0,
    maxWithdrawCents: 5_000_000,
    depositFeeFlatCents: 0,
    withdrawFeeFlatCents: 100,
    eta: '~1–3 mins',
    placeholder: 'T... (TRON TRC20 wallet address)',
    liveGateway: false,
  },
  {
    id: 'USDT-ERC20',
    rail: 'CRYPTO',
    label: 'USDT (ERC20)',
    network: 'Ethereum',
    minDepositCents: 0,
    maxDepositCents: 10_000_000,
    minWithdrawCents: 0,
    maxWithdrawCents: 5_000_000,
    depositFeeFlatCents: 0,
    withdrawFeeFlatCents: 300,
    eta: '~2–5 mins',
    placeholder: '0x... (Ethereum ERC20 address)',
    liveGateway: false,
  },
  {
    id: 'BTC',
    rail: 'CRYPTO',
    label: 'Bitcoin (BTC)',
    network: 'Bitcoin Mainnet',
    minDepositCents: 0,
    maxDepositCents: 10_000_000,
    minWithdrawCents: 0,
    maxWithdrawCents: 5_000_000,
    depositFeeFlatCents: 0,
    withdrawFeeFlatCents: 250,
    eta: '~10 mins',
    placeholder: 'bc1q... (Bitcoin address)',
    liveGateway: false,
  },
  {
    id: 'SOL',
    rail: 'CRYPTO',
    label: 'Solana (SOL)',
    network: 'Solana',
    minDepositCents: 0,
    maxDepositCents: 10_000_000,
    minWithdrawCents: 0,
    maxWithdrawCents: 5_000_000,
    depositFeeFlatCents: 0,
    withdrawFeeFlatCents: 25,
    eta: '~15 secs',
    placeholder: 'Solana wallet address',
    liveGateway: false,
  },
  {
    id: 'UPI',
    rail: 'UPI',
    label: 'UPI Instant',
    network: 'NPCI / Razorpay',
    minDepositCents: 0,
    maxDepositCents: 2_500_000,
    minWithdrawCents: 0,
    maxWithdrawCents: 2_500_000,
    depositFeeFlatCents: 0,
    withdrawFeeFlatCents: 0,
    eta: 'Instant',
    placeholder: 'yourname@upi / phone@paytm',
    liveGateway: false,
  },
  {
    id: 'CARD',
    rail: 'CARD',
    label: 'Visa / Mastercard',
    network: 'Stripe / Gateway',
    minDepositCents: 0,
    maxDepositCents: 5_000_000,
    minWithdrawCents: 0,
    maxWithdrawCents: 2_500_000,
    depositFeeFlatCents: 0,
    withdrawFeeFlatCents: 150,
    eta: 'Instant – 1 day',
    placeholder: 'Cardholder / Bank IBAN or Last 4',
    liveGateway: false,
  },
  {
    id: 'BANK',
    rail: 'BANK',
    label: 'Bank Transfer (IMPS / Wire)',
    network: 'Direct Bank Rail',
    minDepositCents: 0,
    maxDepositCents: 10_000_000,
    minWithdrawCents: 0,
    maxWithdrawCents: 10_000_000,
    depositFeeFlatCents: 0,
    withdrawFeeFlatCents: 0,
    eta: '~15 mins – 1 day',
    placeholder: 'Account No. / IFSC or Routing',
    liveGateway: false,
  },
];

function getEnv() {
  return {
    provider: (process.env.PAYMENT_PROVIDER || 'sandbox').toLowerCase(),
    apiBaseUrl: (process.env.PAYMENT_API_BASE_URL || 'https://www.usdtautopay.com').replace(/\/$/, ''),
    apiKey: process.env.PAYMENT_API_KEY || '',
    webhookSecret: process.env.PAYMENT_WEBHOOK_SECRET || '',
    appPublicUrl: (process.env.APP_PUBLIC_URL || 'https://pulse-prediction-exchange.vercel.app').replace(/\/$/, ''),
    supabaseUrl: (process.env.SUPABASE_URL || '').replace(/\/$/, ''),
    supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  };
}

function authHeaders(apiKey, extra = {}) {
  return {
    Authorization: `Bearer ${apiKey}`,
    'X-API-Key': apiKey,
    ...extra,
  };
}

function extractError(data, fallback) {
  if (!data) return fallback;
  if (typeof data.error === 'string') return data.error;
  if (data.error && typeof data.error.message === 'string') return data.error.message;
  if (typeof data.message === 'string') return data.message;
  return fallback;
}

function verifyWebhookSignature(rawBody, sigHeader, secret) {
  if (!secret) return true;
  if (!sigHeader || typeof sigHeader !== 'string') return false;
  const parts = Object.fromEntries(
    sigHeader.split(',').map((s) => {
      const i = s.indexOf('=');
      return i === -1 ? [s.trim(), ''] : [s.slice(0, i).trim(), s.slice(i + 1).trim()];
    })
  );
  const ts = Number(parts.t);
  if (!ts || Math.abs(Math.floor(Date.now() / 1000) - ts) > 300) return false;
  if (!parts.v1) return false;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${ts}.${rawBody}`, 'utf8')
    .digest('hex');
  const a = Buffer.from(parts.v1, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Optional Supabase REST persistence helper (activates automatically when SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set)
async function supabaseRest(path, options = {}) {
  const { supabaseUrl, supabaseKey } = getEnv();
  if (!supabaseUrl || !supabaseKey) return null;
  const res = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(options.headers || {}),
    },
  });
  if (!res.ok) return null;
  return res.json().catch(() => null);
}

module.exports = {
  PAYMENT_METHODS,
  getEnv,
  authHeaders,
  extractError,
  verifyWebhookSignature,
  supabaseRest,
};
