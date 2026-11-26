const { PAYMENT_METHODS, getEnv } = require('./_lib/gateway');

module.exports = function handler(_req, res) {
  const env = getEnv();
  const isLive = env.provider === 'usdtautopay' && Boolean(env.apiKey);
  res.status(200).json({
    provider: isLive ? 'usdtautopay' : 'sandbox',
    isSandbox: !isLive,
    liveAssets: isLive ? ['USDT-BEP20'] : [],
    supabaseConnected: Boolean(env.supabaseUrl && env.supabaseKey),
    methods: PAYMENT_METHODS,
  });
};
