const MARKETS = [
  // Crypto Pairs (Binance Live WebSocket + automatic simulated fallback)
  {
    symbol: 'BTC/USDT',
    name: 'Bitcoin',
    shortName: 'BTC',
    category: 'crypto',
    binanceSymbol: 'btcusdt',
    basePrice: 94820.5,
    decimals: 2,
    volatility: 0.00045,
    unit: 'USDT',
    accent: '#F7931A',
  },
  {
    symbol: 'ETH/USDT',
    name: 'Ethereum',
    shortName: 'ETH',
    category: 'crypto',
    binanceSymbol: 'ethusdt',
    basePrice: 3345.2,
    decimals: 2,
    volatility: 0.0006,
    unit: 'USDT',
    accent: '#627EEA',
  },
  {
    symbol: 'SOL/USDT',
    name: 'Solana',
    shortName: 'SOL',
    category: 'crypto',
    binanceSymbol: 'solusdt',
    basePrice: 218.75,
    decimals: 2,
    volatility: 0.00085,
    unit: 'USDT',
    accent: '#14F195',
  },
  {
    symbol: 'BNB/USDT',
    name: 'BNB',
    shortName: 'BNB',
    category: 'crypto',
    binanceSymbol: 'bnbusdt',
    basePrice: 648.4,
    decimals: 2,
    volatility: 0.0005,
    unit: 'USDT',
    accent: '#F3BA2F',
  },
  {
    symbol: 'XRP/USDT',
    name: 'Ripple',
    shortName: 'XRP',
    category: 'crypto',
    binanceSymbol: 'xrpusdt',
    basePrice: 1.4285,
    decimals: 4,
    volatility: 0.00095,
    unit: 'USDT',
    accent: '#38BDF8',
  },
  // Commodities Pairs (Live-simulated institutional commodity feed)
  {
    symbol: 'XAU/USD',
    name: 'Gold Spot',
    shortName: 'GOLD',
    category: 'commodity',
    binanceSymbol: null,
    basePrice: 2684.5,
    decimals: 2,
    volatility: 0.00024,
    unit: 'USD / oz',
    accent: '#F5B731',
  },
  {
    symbol: 'XAG/USD',
    name: 'Silver Spot',
    shortName: 'SILVER',
    category: 'commodity',
    binanceSymbol: null,
    basePrice: 31.485,
    decimals: 3,
    volatility: 0.00042,
    unit: 'USD / oz',
    accent: '#CBD5E1',
  },
  {
    symbol: 'WTI/USD',
    name: 'Crude Oil WTI',
    shortName: 'WTI',
    category: 'commodity',
    binanceSymbol: null,
    basePrice: 71.85,
    decimals: 2,
    volatility: 0.00048,
    unit: 'USD / bbl',
    accent: '#A855F7',
  },
  {
    symbol: 'BRENT/USD',
    name: 'Brent Crude',
    shortName: 'BRENT',
    category: 'commodity',
    binanceSymbol: null,
    basePrice: 75.3,
    decimals: 2,
    volatility: 0.00046,
    unit: 'USD / bbl',
    accent: '#EC4899',
  },
  {
    symbol: 'NG/USD',
    name: 'Natural Gas',
    shortName: 'NATGAS',
    category: 'commodity',
    binanceSymbol: null,
    basePrice: 3.185,
    decimals: 3,
    volatility: 0.00075,
    unit: 'USD / MMBtu',
    accent: '#06B6D4',
  },
];

// Explicit Anti-Snipe Entry Cutoff BEFORE each candle opens & locks its strike price.
// Prevents last-second sniping and momentum front-running on 1m through 1d candles.
const TIMEFRAMES = [
  { id: '1m', label: '1 Min', shortLabel: '1m', durationMs: 60 * 1000, entryCutoffMs: 15 * 1000 },
  { id: '5m', label: '5 Min', shortLabel: '5m', durationMs: 5 * 60 * 1000, entryCutoffMs: 30 * 1000 },
  { id: '10m', label: '10 Min', shortLabel: '10m', durationMs: 10 * 60 * 1000, entryCutoffMs: 45 * 1000 },
  { id: '15m', label: '15 Min', shortLabel: '15m', durationMs: 15 * 60 * 1000, entryCutoffMs: 60 * 1000 },
  { id: '30m', label: '30 Min', shortLabel: '30m', durationMs: 30 * 60 * 1000, entryCutoffMs: 90 * 1000 },
  { id: '1h', label: '1 Hour', shortLabel: '1h', durationMs: 60 * 60 * 1000, entryCutoffMs: 120 * 1000 },
  { id: '1d', label: '1 Day', shortLabel: '1d', durationMs: 24 * 60 * 60 * 1000, entryCutoffMs: 600 * 1000 },
];

const STAKE_TIERS = [
  { id: 'tier_10', label: '$10', amountCents: 1000 },
  { id: 'tier_50', label: '$50', amountCents: 5000 },
  { id: 'tier_100', label: '$100', amountCents: 10000 },
];

const MASTER_FEE_RATE = 0.1; // 10% subtracted from total prize pool to Master Wallet
const MASTER_WALLET_ADDRESS =
  process.env.MASTER_WALLET_ADDRESS || '0x71C94E8B2A6D0F391C5E8A4B72D10F6E3B8C9F4A';

const DEFAULT_USER_BALANCE_CENTS = 100_000; // $1,000.00 starting virtual wallet balance
const TOPUP_AMOUNT_CENTS = 50_000; // $500.00 demo faucet top-up

const DEMO_BOT_PROFILES = [
  { username: 'CryptoHawk', avatarColor: '#00E599' },
  { username: 'GoldBull99', avatarColor: '#F5B731' },
  { username: 'SatoshiPulse', avatarColor: '#3B82F6' },
  { username: 'ElenaTrades', avatarColor: '#EC4899' },
  { username: 'OilBaronX', avatarColor: '#A855F7' },
  { username: 'SolanaKing', avatarColor: '#14F195' },
  { username: 'DeltaQuant', avatarColor: '#06B6D4' },
  { username: 'SilverFox', avatarColor: '#94A3B8' },
  { username: 'ApexTrader', avatarColor: '#F97316' },
  { username: 'MacroWhale', avatarColor: '#6366F1' },
  { username: 'VortexAlpha', avatarColor: '#FF3B69' },
  { username: 'BullionPro', avatarColor: '#EAB308' },
  { username: 'NovaScalper', avatarColor: '#22D3EE' },
  { username: 'CrudeKnight', avatarColor: '#C084FC' },
  { username: 'GammaEdge', avatarColor: '#34D399' },
  { username: 'AtlasFX', avatarColor: '#FB7185' },
  { username: 'KiraCharts', avatarColor: '#38BDF8' },
  { username: 'ZenithDesk', avatarColor: '#FBBF24' },
];

const MARKET_BY_SYMBOL = Object.fromEntries(MARKETS.map((m) => [m.symbol, m]));
const TIMEFRAME_BY_ID = Object.fromEntries(TIMEFRAMES.map((t) => [t.id, t]));
const TIER_BY_CENTS = Object.fromEntries(STAKE_TIERS.map((t) => [t.amountCents, t]));

module.exports = {
  MARKETS,
  TIMEFRAMES,
  STAKE_TIERS,
  MASTER_FEE_RATE,
  MASTER_WALLET_ADDRESS,
  DEFAULT_USER_BALANCE_CENTS,
  TOPUP_AMOUNT_CENTS,
  DEMO_BOT_PROFILES,
  MARKET_BY_SYMBOL,
  TIMEFRAME_BY_ID,
  TIER_BY_CENTS,
};
