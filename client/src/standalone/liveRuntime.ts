import {
  ActiveRoundState,
  CandlePoint,
  CrashPlayer,
  CrashState,
  Direction,
  GlobalStats,
  MarketTicker,
  MasterWalletLedgerItem,
  MasterWalletSummary,
  OriginalBetRecord,
  PricePoint,
  RoomSnapshot,
  RoundPlayer,
  SettledRound,
  StakeTier,
  TimeframeId,
  TimeframeOption,
  UserBetRecord,
  UserProfile,
} from '../types';

const MARKETS_DEF = [
  { symbol: 'BTC/USDT', name: 'Bitcoin', shortName: 'BTC', category: 'crypto' as const, binanceSymbol: 'btcusdt', basePrice: 94820.5, decimals: 2, volatility: 0.00045, unit: 'USDT', accent: '#F7931A' },
  { symbol: 'ETH/USDT', name: 'Ethereum', shortName: 'ETH', category: 'crypto' as const, binanceSymbol: 'ethusdt', basePrice: 3345.2, decimals: 2, volatility: 0.0006, unit: 'USDT', accent: '#627EEA' },
  { symbol: 'SOL/USDT', name: 'Solana', shortName: 'SOL', category: 'crypto' as const, binanceSymbol: 'solusdt', basePrice: 218.75, decimals: 2, volatility: 0.00085, unit: 'USDT', accent: '#14F195' },
  { symbol: 'BNB/USDT', name: 'BNB', shortName: 'BNB', category: 'crypto' as const, binanceSymbol: 'bnbusdt', basePrice: 648.4, decimals: 2, volatility: 0.0005, unit: 'USDT', accent: '#F3BA2F' },
  { symbol: 'XRP/USDT', name: 'Ripple', shortName: 'XRP', category: 'crypto' as const, binanceSymbol: 'xrpusdt', basePrice: 1.4285, decimals: 4, volatility: 0.00095, unit: 'USDT', accent: '#38BDF8' },
  { symbol: 'XAU/USD', name: 'Gold Spot', shortName: 'GOLD', category: 'commodity' as const, binanceSymbol: null, basePrice: 2684.5, decimals: 2, volatility: 0.00024, unit: 'USD / oz', accent: '#F5B731' },
  { symbol: 'XAG/USD', name: 'Silver Spot', shortName: 'SILVER', category: 'commodity' as const, binanceSymbol: null, basePrice: 31.485, decimals: 3, volatility: 0.00042, unit: 'USD / oz', accent: '#CBD5E1' },
  { symbol: 'WTI/USD', name: 'Crude Oil WTI', shortName: 'WTI', category: 'commodity' as const, binanceSymbol: null, basePrice: 71.85, decimals: 2, volatility: 0.00048, unit: 'USD / bbl', accent: '#A855F7' },
  { symbol: 'BRENT/USD', name: 'Brent Crude', shortName: 'BRENT', category: 'commodity' as const, binanceSymbol: null, basePrice: 75.3, decimals: 2, volatility: 0.00046, unit: 'USD / bbl', accent: '#EC4899' },
  { symbol: 'NG/USD', name: 'Natural Gas', shortName: 'NATGAS', category: 'commodity' as const, binanceSymbol: null, basePrice: 3.185, decimals: 3, volatility: 0.00075, unit: 'USD / MMBtu', accent: '#06B6D4' },
];

const TIMEFRAMES: TimeframeOption[] = [
  { id: '1m', label: '1 Min', shortLabel: '1m', durationMs: 60_000, entryCutoffMs: 15_000 },
  { id: '5m', label: '5 Min', shortLabel: '5m', durationMs: 300_000, entryCutoffMs: 30_000 },
  { id: '10m', label: '10 Min', shortLabel: '10m', durationMs: 600_000, entryCutoffMs: 45_000 },
  { id: '15m', label: '15 Min', shortLabel: '15m', durationMs: 900_000, entryCutoffMs: 60_000 },
  { id: '30m', label: '30 Min', shortLabel: '30m', durationMs: 1_800_000, entryCutoffMs: 90_000 },
  { id: '1h', label: '1 Hour', shortLabel: '1h', durationMs: 3_600_000, entryCutoffMs: 120_000 },
  { id: '1d', label: '1 Day', shortLabel: '1d', durationMs: 86_400_000, entryCutoffMs: 600_000 },
];

const TIERS: StakeTier[] = [
  { id: 'tier_10', label: '$10', amountCents: 1000 },
  { id: 'tier_50', label: '$50', amountCents: 5000 },
  { id: 'tier_100', label: '$100', amountCents: 10000 },
];

const BOTS = [
  { id: 'bot_1', username: 'CryptoHawk', avatarColor: '#00E599' },
  { id: 'bot_2', username: 'GoldBull99', avatarColor: '#F5B731' },
  { id: 'bot_3', username: 'SatoshiPulse', avatarColor: '#3B82F6' },
  { id: 'bot_4', username: 'ElenaTrades', avatarColor: '#EC4899' },
  { id: 'bot_5', username: 'OilBaronX', avatarColor: '#A855F7' },
  { id: 'bot_6', username: 'SolanaKing', avatarColor: '#14F195' },
  { id: 'bot_7', username: 'DeltaQuant', avatarColor: '#06B6D4' },
  { id: 'bot_8', username: 'SilverFox', avatarColor: '#94A3B8' },
  { id: 'bot_9', username: 'ApexTrader', avatarColor: '#F97316' },
  { id: 'bot_10', username: 'MacroWhale', avatarColor: '#6366F1' },
  { id: 'bot_11', username: 'VortexAlpha', avatarColor: '#FF3B69' },
  { id: 'bot_12', username: 'BullionPro', avatarColor: '#EAB308' },
];

const PLINKO_TABLES: Record<number, Record<'low' | 'medium' | 'high', number[]>> = {
  8: {
    low: [5.6, 2.1, 1.1, 1.0, 0.5, 1.0, 1.1, 2.1, 5.6],
    medium: [13, 3, 1.3, 0.7, 0.4, 0.7, 1.3, 3, 13],
    high: [29, 4, 1.5, 0.3, 0.2, 0.3, 1.5, 4, 29],
  },
  12: {
    low: [10, 3, 1.6, 1.4, 1.1, 1.0, 0.5, 1.0, 1.1, 1.4, 1.6, 3, 10],
    medium: [33, 11, 4, 2, 1.1, 0.6, 0.3, 0.6, 1.1, 2, 4, 11, 33],
    high: [170, 24, 8.1, 2, 0.7, 0.2, 0.2, 0.2, 0.7, 2, 8.1, 24, 170],
  },
  16: {
    low: [16, 9, 2, 1.4, 1.4, 1.2, 1.1, 1.0, 0.5, 1.0, 1.1, 1.2, 1.4, 1.4, 2, 9, 16],
    medium: [110, 41, 10, 5, 3, 1.5, 1, 0.5, 0.3, 0.5, 1, 1.5, 3, 5, 10, 41, 110],
    high: [1000, 130, 26, 9, 4, 2, 0.2, 0.2, 0.2, 0.2, 0.2, 2, 4, 9, 26, 130, 1000],
  },
};

const PUMP_CFG: Record<string, { totalPumps: number; popsCount: number }> = {
  easy: { totalPumps: 24, popsCount: 1 },
  medium: { totalPumps: 22, popsCount: 3 },
  hard: { totalPumps: 20, popsCount: 5 },
  expert: { totalPumps: 15, popsCount: 5 },
};

const TOWER_CFG: Record<string, { cols: number; bombs: number; rows: number }> = {
  easy: { cols: 4, bombs: 1, rows: 9 },
  medium: { cols: 3, bombs: 1, rows: 9 },
  hard: { cols: 2, bombs: 1, rows: 9 },
  expert: { cols: 3, bombs: 2, rows: 9 },
};

const MASTER_ADDRESS = '0x71C94E8B2A6D0F391C5E8A4B72D10F6E3B8C9F4A';
const ROUND_ANCHOR = Date.UTC(2026, 10, 24, 0, 0, 0);

function randHex(len = 12) {
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
}

function roundPrice(v: number, d: number) {
  const f = 10 ** d;
  return Math.round(v * f) / f;
}

function gauss() {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function getKenoTable(pickCount: number, risk: string): number[] {
  const n = Math.max(1, Math.min(10, pickCount));
  const comb = (a: number, b: number) => {
    if (b < 0 || b > a) return 0;
    let r = 1;
    for (let i = 1; i <= Math.min(b, a - b); i++) r = (r * (a - i + 1)) / i;
    return r;
  };
  const total = comb(40, 10);
  const probs = Array.from({ length: n + 1 }, (_, k) => (comb(n, k) * comb(40 - n, 10 - k)) / total);
  const exp = risk === 'low' ? 1.05 : risk === 'high' ? 1.85 : 1.4;
  const minHit = risk === 'high' ? Math.max(1, Math.ceil(n * 0.45)) : risk === 'low' ? Math.max(1, Math.floor(n * 0.25)) : Math.max(1, Math.ceil(n * 0.3));
  const weights = probs.map((p, k) => (k < minHit ? 0 : Math.pow(1 / Math.max(p, 1e-9), exp - 1)));
  const ew = weights.reduce((a, w, k) => a + w * probs[k], 0);
  const scale = ew > 0 ? 0.99 / ew : 0;
  return weights.map((w) => {
    const val = w * scale;
    if (val < 0.1) return 0;
    return val >= 100 ? Math.round(val) : Number(val.toFixed(2));
  });
}

function getWheelSegs(segments: number, risk: string): number[] {
  const n = [10, 20, 30, 40, 50].includes(segments) ? segments : 20;
  if (risk === 'high') {
    const jp = Number((n * 0.99).toFixed(2));
    return Array.from({ length: n }, (_, i) => (i === 0 ? jp : 0));
  }
  if (risk === 'low') {
    return Array.from({ length: n }, (_, i) => (i % 5 === 0 ? 1.5 : i % 5 === 4 ? 0 : 1.2));
  }
  const pat = [3.0, 0, 1.5, 0, 2.0, 0, 1.5, 0, 1.9, 0];
  return Array.from({ length: n }, (_, i) => pat[i % pat.length]);
}

function getPumpMult(diff: string, pumps: number) {
  const cfg = PUMP_CFG[diff] || PUMP_CFG.medium;
  if (pumps <= 0) return 1.0;
  const safe = cfg.totalPumps - cfg.popsCount;
  let prob = 1;
  for (let i = 0; i < pumps; i++) prob *= (safe - i) / (cfg.totalPumps - i);
  return Number((0.99 / prob).toFixed(2));
}

function getMinesMult(mines: number, revealed: number) {
  if (revealed <= 0) return 1.0;
  const safe = 25 - mines;
  let prob = 1;
  for (let i = 0; i < revealed; i++) prob *= (safe - i) / (25 - i);
  return Number((0.99 / prob).toFixed(2));
}

function getTowerMult(diff: string, floor: number) {
  const cfg = TOWER_CFG[diff] || TOWER_CFG.medium;
  if (floor <= 0) return 1.0;
  return Number((0.99 / Math.pow((cfg.cols - cfg.bombs) / cfg.cols, floor)).toFixed(2));
}

type Card = { suit: 'spades' | 'hearts' | 'diamonds' | 'clubs'; rank: string; value: number };
const SUITS: Card['suit'][] = ['spades', 'hearts', 'diamonds', 'clubs'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
function drawRandomCard(): Card {
  const suit = SUITS[Math.floor(Math.random() * 4)];
  const rank = RANKS[Math.floor(Math.random() * 13)];
  const value = rank === 'A' ? 11 : ['K', 'Q', 'J'].includes(rank) ? 10 : Number(rank);
  return { suit, rank, value };
}
function evalBj(cards: Card[]) {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    if (c.rank === 'A') { aces++; total += 11; } else total += c.value;
  }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return { total, isSoft: aces > 0 && total <= 21, isBlackjack: cards.length === 2 && total === 21, isBust: total > 21 };
}

type Listener = (payload: any) => void;

class StandaloneRuntime {
  listeners = new Map<string, Set<Listener>>();
  tickers = new Map<string, MarketTicker>();
  history = new Map<string, PricePoint[]>();
  candles = new Map<string, CandlePoint[]>();
  lastBinance = new Map<string, number>();

  users = new Map<string, UserProfile>();
  userBets = new Map<string, UserBetRecord[]>();
  settledRounds: SettledRound[] = [];
  masterLedger: MasterWalletLedgerItem[] = [];
  originalsBets: OriginalBetRecord[] = [];
  rooms = new Map<string, any>();
  watchedRoom = 'BTC/USDT|1m|1000';
  botsEnabled = true;

  fairness = { serverSeedHash: randHex(32), clientSeed: `pulse_${randHex(6)}`, nonce: 0 };
  pumpSession: any = null;
  minesSession: any = null;
  towerSession: any = null;
  bjSession: any = null;
  payments: any[] = [];

  crashState: CrashState;
  crashPoint = 2.4;

  constructor() {
    this._initMarkets();
    this._initBots();
    this._initRooms();
    this.crashState = this._newCrashRound(2401);
    this._connectBinanceBrowser();
    this._startLoops();
  }

  on(event: string, fn: Listener) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(fn);
  }
  off(event: string, fn: Listener) {
    this.listeners.get(event)?.delete(fn);
  }
  emit(event: string, payload: any) {
    this.listeners.get(event)?.forEach((fn) => fn(payload));
  }

  _initMarkets() {
    const now = Date.now();
    const bucket = Math.floor(now / 5000) * 5000;
    for (const m of MARKETS_DEF) {
      const open24h = roundPrice(m.basePrice * (1 + (Math.random() - 0.5) * 0.03), m.decimals);
      let p = m.basePrice;
      const cList: CandlePoint[] = [];
      for (let i = 51; i >= 0; i--) {
        const open = roundPrice(p, m.decimals);
        let high = open;
        let low = open;
        for (let k = 0; k < 4; k++) {
          p = Math.max(m.basePrice * 0.85, p * (1 + gauss() * m.volatility * 0.5));
          const rp = roundPrice(p, m.decimals);
          if (rp > high) high = rp;
          if (rp < low) low = rp;
        }
        const close = roundPrice(p, m.decimals);
        cList.push({ time: bucket - i * 5000, open, high: Math.max(high, open, close), low: Math.min(low, open, close), close, volume: 20 + Math.random() * 80 });
      }
      const pts: PricePoint[] = cList.slice(-30).flatMap((c) => [
        { time: c.time, price: c.open },
        { time: c.time + 2500, price: c.close },
      ]);
      const price = cList[cList.length - 1].close;
      this.candles.set(m.symbol, cList);
      this.history.set(m.symbol, pts);
      this.tickers.set(m.symbol, {
        ...m,
        price,
        prevPrice: price,
        open24h,
        high24h: roundPrice(Math.max(price, open24h) * 1.007, m.decimals),
        low24h: roundPrice(Math.min(price, open24h) * 0.993, m.decimals),
        changePercent: Number((((price - open24h) / open24h) * 100).toFixed(2)),
        source: 'simulated',
        sparkline: cList.slice(-20).map((c) => c.close),
        updatedAt: now,
      });
    }
  }

  _initBots() {
    for (const b of BOTS) {
      this.users.set(b.id, {
        id: b.id,
        username: b.username,
        avatarColor: b.avatarColor,
        balanceCents: 500_000,
        isBot: true,
        totalBets: 12 + Math.floor(Math.random() * 20),
        totalWins: 7 + Math.floor(Math.random() * 10),
        totalWageredCents: 25_000,
        totalWonCents: 28_000 + Math.floor(Math.random() * 15_000),
        netProfitCents: 3_000 + Math.floor(Math.random() * 15_000),
        winRate: 56.2,
        createdAt: Date.now() - 86400_000,
      });
    }
  }

  _makeRound(symbol: string, tf: TimeframeOption, tierCents: number, status: 'LIVE' | 'OPEN', lockTime: number, lockPrice: number | null) {
    const roundNumber = Math.max(1, Math.floor((lockTime - ROUND_ANCHOR) / tf.durationMs) + 1000);
    return {
      roundId: `${symbol}_${tf.id}_${tierCents}_${lockTime}`,
      roundNumber,
      symbol,
      timeframe: tf.id,
      tierCents,
      status,
      lockTime,
      entryCloseTime: lockTime - tf.entryCutoffMs,
      entryCutoffMs: tf.entryCutoffMs,
      closeTime: lockTime + tf.durationMs,
      lockPrice,
      players: [] as RoundPlayer[],
    };
  }

  _seedBotsInRound(round: any, count: number) {
    if (!this.botsEnabled) return;
    const used = new Set(round.players.map((p: RoundPlayer) => p.userId));
    const avail = BOTS.filter((b) => !used.has(b.id)).sort(() => Math.random() - 0.5).slice(0, count);
    avail.forEach((b, i) => {
      round.players.push({
        betId: `bet_${randHex(5)}`,
        userId: b.id,
        username: b.username,
        avatarColor: b.avatarColor,
        isBot: true,
        direction: i % 2 === 0 ? 'UP' : 'DOWN',
        stakeCents: round.tierCents,
        createdAt: Date.now(),
      });
    });
  }

  _initRooms() {
    const now = Date.now();
    for (const m of MARKETS_DEF) {
      const price = this.tickers.get(m.symbol)!.price;
      for (const tf of TIMEFRAMES) {
        const lockTime = Math.floor(now / tf.durationMs) * tf.durationMs;
        for (const tier of TIERS) {
          const key = `${m.symbol}|${tf.id}|${tier.amountCents}`;
          const live = this._makeRound(m.symbol, tf, tier.amountCents, 'LIVE', lockTime, price);
          const open = this._makeRound(m.symbol, tf, tier.amountCents, 'OPEN', lockTime + tf.durationMs, null);
          if (tf.id === '1m' && tier.amountCents === 1000) {
            this._seedBotsInRound(live, 7 + Math.floor(Math.random() * 4));
            this._seedBotsInRound(open, 4 + Math.floor(Math.random() * 3));
          } else if ((m.symbol === 'BTC/USDT' || m.symbol === 'XAU/USD') && tier.amountCents === 1000) {
            this._seedBotsInRound(live, 5);
            this._seedBotsInRound(open, 3);
          }
          this.rooms.set(key, { key, symbol: m.symbol, category: m.category, timeframe: tf.id, tf, tierCents: tier.amountCents, liveRound: live, openRound: open, lastSettled: null });
        }
      }
    }
    // Seed 2 settled rounds so Master Vault & Spotlight look rich immediately
    this._seedSettledDemo('BTC/USDT', '1m', 1000, 0.0012);
    this._seedSettledDemo('XAU/USD', '1m', 5000, -0.0008);
  }

  _seedSettledDemo(symbol: string, timeframe: TimeframeId, tierCents: number, pct: number) {
    const room = this.rooms.get(`${symbol}|${timeframe}|${tierCents}`);
    if (!room) return;
    const t = this.tickers.get(symbol)!;
    const lockPrice = t.price;
    const closePrice = roundPrice(t.price * (1 + pct), t.decimals);
    const players: RoundPlayer[] = BOTS.slice(0, 8).map((b, i) => ({
      betId: `seed_${randHex(4)}`,
      userId: b.id,
      username: b.username,
      avatarColor: b.avatarColor,
      isBot: true,
      direction: i % 2 === 0 ? 'UP' : 'DOWN',
      stakeCents: tierCents,
      createdAt: Date.now() - 65000,
    }));
    const outcome = closePrice > lockPrice ? 'UP' : 'DOWN';
    const totalPoolCents = players.length * tierCents;
    const masterFeeCents = Math.round(totalPoolCents * 0.1);
    const distributablePoolCents = totalPoolCents - masterFeeCents;
    const winnersRaw = players.filter((p) => p.direction === outcome);
    const payoutPerWinnerCents = Math.floor(distributablePoolCents / winnersRaw.length);
    const dustCents = distributablePoolCents - payoutPerWinnerCents * winnersRaw.length;
    const settledPlayers = players.map((p) => ({
      ...p,
      status: (p.direction === outcome ? 'WON' : 'LOST') as 'WON' | 'LOST',
      payoutCents: p.direction === outcome ? payoutPerWinnerCents : 0,
    }));
    const txRef = `MW-${randHex(4).toUpperCase()}`;
    const settled: SettledRound = {
      roundId: `${symbol}_${timeframe}_${tierCents}_seed`,
      roundNumber: room.liveRound.roundNumber - 1,
      symbol,
      category: room.category,
      timeframe,
      tierCents,
      lockTime: room.liveRound.lockTime - 60000,
      closeTime: room.liveRound.lockTime,
      lockPrice,
      closePrice,
      outcome,
      playerCount: players.length,
      upCount: 4,
      downCount: 4,
      totalPoolCents,
      masterFeeCents,
      dustCents,
      distributablePoolCents,
      winnerCount: winnersRaw.length,
      payoutPerWinnerCents,
      txRef,
      settledAt: Date.now() - 10000,
      players: settledPlayers,
      winners: settledPlayers.filter((p) => p.status === 'WON'),
    };
    room.lastSettled = settled;
    this.settledRounds.unshift(settled);
    this.masterLedger.unshift({
      id: `mw_${randHex(4)}`,
      roundId: settled.roundId,
      roundNumber: settled.roundNumber,
      symbol,
      category: room.category,
      timeframe,
      tierCents,
      totalPoolCents,
      feeCents: masterFeeCents,
      dustCents,
      totalMasterCreditCents: masterFeeCents + dustCents,
      distributableCents: distributablePoolCents,
      winnerCount: winnersRaw.length,
      payoutPerWinnerCents,
      txRef,
      createdAt: settled.settledAt,
    });
  }

  _applyLiveBinanceTick(
    m: (typeof MARKETS_DEF)[number],
    price: number,
    open24h: number,
    high24h: number,
    low24h: number,
    changePercent: number
  ) {
    if (!Number.isFinite(price) || price <= 0) return;
    const prev = this.tickers.get(m.symbol);
    if (!prev) return;
    const isFirstLive = prev.source !== 'binance_live';
    if (isFirstLive) {
      const cList = this.candles.get(m.symbol) || [];
      const ratio = price / (cList[cList.length - 1]?.close || price);
      cList.forEach((c) => {
        c.open = roundPrice(c.open * ratio, m.decimals);
        c.high = roundPrice(c.high * ratio, m.decimals);
        c.low = roundPrice(c.low * ratio, m.decimals);
        c.close = roundPrice(c.close * ratio, m.decimals);
      });
      const h = this.history.get(m.symbol) || [];
      h.forEach((pt) => {
        pt.price = roundPrice(pt.price * ratio, m.decimals);
      });
      // Re-anchor live lockPrice on first live Binance tick so chart strike matches live price
      for (const room of this.rooms.values()) {
        if (room.symbol === m.symbol) room.liveRound.lockPrice = price;
      }
    }
    this.tickers.set(m.symbol, {
      ...prev,
      prevPrice: isFirstLive ? price : prev.price,
      price,
      open24h: Number.isFinite(open24h) && open24h > 0 ? roundPrice(open24h, m.decimals) : prev.open24h,
      high24h: Number.isFinite(high24h) && high24h > 0 ? roundPrice(high24h, m.decimals) : prev.high24h,
      low24h: Number.isFinite(low24h) && low24h > 0 ? roundPrice(low24h, m.decimals) : prev.low24h,
      changePercent: Number.isFinite(changePercent) ? Number(changePercent.toFixed(2)) : prev.changePercent,
      source: 'binance_live',
      sparkline: (this.candles.get(m.symbol) || []).slice(-20).map((c) => c.close),
      updatedAt: Date.now(),
    });
    this.lastBinance.set(m.symbol, Date.now());

    if (isFirstLive) {
      const [wSym, wTf, wTier] = this.watchedRoom.split('|');
      if (wSym === m.symbol) {
        this.emit('market:history', {
          symbol: m.symbol,
          points: (this.history.get(m.symbol) || []).map((p) => ({ ...p })),
          candles: (this.candles.get(m.symbol) || []).map((c) => ({ ...c })),
        });
        const snap = this.getRoomSnapshot(wSym, wTf, Number(wTier));
        if (snap) this.emit('room:state', snap);
      }
      this.emit('market:ticks', {
        serverTime: Date.now(),
        tickers: Array.from(this.tickers.values()),
      });
    }
  }

  _connectBinanceBrowser() {
    // 1. Immediate REST snapshot so live Binance prices anchor right on page load (no $95k -> $62k cliff)
    try {
      const syms = MARKETS_DEF.filter((m) => m.binanceSymbol).map((m) =>
        m.binanceSymbol!.toUpperCase()
      );
      const restUrl = `https://api.binance.com/api/v3/ticker/24hr?symbols=${encodeURIComponent(
        JSON.stringify(syms)
      )}`;
      fetch(restUrl)
        .then((r) => (r.ok ? r.json() : null))
        .then((list) => {
          if (!Array.isArray(list)) return;
          for (const d of list) {
            const m = MARKETS_DEF.find((x) => x.binanceSymbol?.toUpperCase() === d.symbol);
            if (!m) continue;
            this._applyLiveBinanceTick(
              m,
              roundPrice(parseFloat(d.lastPrice), m.decimals),
              parseFloat(d.openPrice),
              parseFloat(d.highPrice),
              parseFloat(d.lowPrice),
              parseFloat(d.priceChangePercent)
            );
          }
        })
        .catch(() => {
          // WebSocket will still sync
        });
    } catch {
      // ignore
    }

    // 2. Real-time WebSocket stream
    try {
      const streams = MARKETS_DEF.filter((m) => m.binanceSymbol)
        .map((m) => `${m.binanceSymbol}@ticker`)
        .join('/');
      const ws = new WebSocket(`wss://stream.binance.com:9443/stream?streams=${streams}`);
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          const d = msg.data;
          if (!d?.s) return;
          const m = MARKETS_DEF.find((x) => x.binanceSymbol?.toUpperCase() === d.s);
          if (!m) return;
          this._applyLiveBinanceTick(
            m,
            roundPrice(parseFloat(d.c), m.decimals),
            parseFloat(d.o),
            parseFloat(d.h),
            parseFloat(d.l),
            parseFloat(d.P || '0')
          );
        } catch {
          // ignore
        }
      };
    } catch {
      // fallback sim handles it
    }
  }

  _newCrashRound(num: number): CrashState {
    const now = Date.now();
    const r = Math.random();
    this.crashPoint = r < 0.03 ? 1.0 : Math.max(1.02, Number((0.99 / Math.max(0.0002, r)).toFixed(2)));
    const players: CrashPlayer[] = this.botsEnabled
      ? BOTS.slice(0, 6).map((b) => ({
          betId: `cr_${randHex(4)}`,
          userId: b.id,
          username: b.username,
          avatarColor: b.avatarColor,
          isBot: true,
          stakeCents: [1000, 2500, 5000][Math.floor(Math.random() * 3)],
          autoCashout: Number((1.3 + Math.random() * 3.5).toFixed(2)),
          status: 'ACTIVE',
          cashoutMultiplier: null,
          payoutCents: 0,
        }))
      : [];

    return {
      roundNumber: num,
      phase: 'BETTING',
      multiplier: 1.0,
      phaseStartedAt: now,
      phaseEndsAt: now + 6000,
      serverTime: now,
      serverSeedHash: randHex(32),
      revealedServerSeed: null,
      crashPoint: null,
      history: this.crashState?.history || [2.41, 1.18, 6.84, 1.04, 3.19, 14.52, 1.62],
      players,
    };
  }

  _startLoops() {
    // 1-second Market Tick + Prediction Round Settlement Loop
    setInterval(() => {
      const now = Date.now();
      const bucket = Math.floor(now / 5000) * 5000;
      for (const m of MARKETS_DEF) {
        const t = this.tickers.get(m.symbol)!;
        const freshLive = m.category === 'crypto' && now - (this.lastBinance.get(m.symbol) || 0) < 12000;
        if (!freshLive) {
          let np = roundPrice(t.price * (1 + gauss() * m.volatility * 0.65), m.decimals);
          if (np === t.price) np = roundPrice(t.price + (Math.random() > 0.5 ? 1 : -1) / 10 ** m.decimals, m.decimals);
          t.prevPrice = t.price;
          t.price = np;
          t.high24h = Math.max(t.high24h, np);
          t.low24h = Math.min(t.low24h, np);
          t.changePercent = Number((((np - t.open24h) / t.open24h) * 100).toFixed(2));
          t.updatedAt = now;
        }
        const cList = this.candles.get(m.symbol)!;
        const lastC = cList[cList.length - 1];
        if (!lastC || bucket > lastC.time) {
          cList.push({ time: bucket, open: lastC ? lastC.close : t.price, high: Math.max(lastC ? lastC.close : t.price, t.price), low: Math.min(lastC ? lastC.close : t.price, t.price), close: t.price, volume: 15 + Math.random() * 40 });
          if (cList.length > 64) cList.shift();
        } else {
          lastC.close = t.price;
          lastC.high = Math.max(lastC.high, t.price);
          lastC.low = Math.min(lastC.low, t.price);
        }
        t.sparkline = cList.slice(-20).map((c) => c.close);
        const h = this.history.get(m.symbol)!;
        h.push({ time: now, price: t.price });
        if (h.length > 200) h.shift();
      }
      this.emit('market:ticks', { serverTime: now, tickers: Array.from(this.tickers.values()) });

      // Check room rollovers
      let changed = false;
      for (const room of this.rooms.values()) {
        if (now >= room.liveRound.closeTime) {
          this._rolloverRoom(room, now);
          changed = true;
        }
      }
      if (changed) {
        this.emit('global:stats', this.getGlobalStats());
        this.emit('master_wallet:update', this.getMasterWallet());
      }
    }, 1000);

    // 70ms Crash Engine Loop
    setInterval(() => {
      const now = Date.now();
      const cs = this.crashState;
      if (cs.phase === 'BETTING' && now >= cs.phaseEndsAt) {
        cs.phase = 'FLYING';
        cs.phaseStartedAt = now;
        cs.multiplier = 1.0;
        this.emit('crash:state', { ...cs, serverTime: now });
      } else if (cs.phase === 'FLYING') {
        const mult = Math.max(1.0, Number(Math.exp(0.000068 * (now - cs.phaseStartedAt)).toFixed(2)));
        if (mult >= this.crashPoint) {
          cs.phase = 'CRASHED';
          cs.multiplier = this.crashPoint;
          cs.crashPoint = this.crashPoint;
          cs.phaseEndsAt = now + 3000;
          cs.history = [this.crashPoint, ...cs.history].slice(0, 16);
          cs.players.forEach((p) => {
            if (p.status === 'ACTIVE') {
              p.status = 'BUSTED';
              if (!p.isBot) {
                this._recordOriginalBet(p.userId, 'crash', p.stakeCents, 0, 0, 'LOST', true);
              }
            }
          });
          this.emit('crash:state', { ...cs, serverTime: now });
        } else {
          cs.multiplier = mult;
          cs.players.forEach((p) => {
            if (p.status === 'ACTIVE' && p.autoCashout && mult >= p.autoCashout) {
              p.status = 'CASHED_OUT';
              p.cashoutMultiplier = p.autoCashout;
              p.payoutCents = Math.floor(p.stakeCents * p.autoCashout);
              if (!p.isBot) {
                this._recordOriginalBet(p.userId, 'crash', p.stakeCents, p.autoCashout, p.payoutCents, 'WON', true);
              }
            }
          });
          this.emit('crash:tick', { roundNumber: cs.roundNumber, phase: cs.phase, multiplier: mult, players: cs.players });
        }
      } else if (cs.phase === 'CRASHED' && now >= cs.phaseEndsAt) {
        this.crashState = this._newCrashRound(cs.roundNumber + 1);
        this.emit('crash:state', { ...this.crashState, serverTime: now });
      }
    }, 75);
  }

  _rolloverRoom(room: any, now: number) {
    const closePrice = this.tickers.get(room.symbol)!.price;
    const closing = room.liveRound;
    if (closing.players.length > 0) {
      const outcome = closePrice > closing.lockPrice ? 'UP' : closePrice < closing.lockPrice ? 'DOWN' : 'DRAW';
      const totalPool = closing.players.length * room.tierCents;
      const winnersRaw = outcome === 'DRAW' ? [] : closing.players.filter((p: RoundPlayer) => p.direction === outcome);
      const isRefund = outcome === 'DRAW' || winnersRaw.length === 0;
      const fee = isRefund ? 0 : Math.round(totalPool * 0.1);
      const dist = isRefund ? 0 : totalPool - fee;
      const perWin = isRefund ? 0 : Math.floor(dist / winnersRaw.length);
      const dust = isRefund ? 0 : dist - perWin * winnersRaw.length;
      const settledPlayers: RoundPlayer[] = closing.players.map((p: RoundPlayer) => {
        if (isRefund) return { ...p, status: 'REFUNDED', payoutCents: p.stakeCents };
        const won = p.direction === outcome;
        return { ...p, status: won ? 'WON' : 'LOST', payoutCents: won ? perWin : 0 };
      });
      // Credit human winners/refunds
      for (const p of settledPlayers) {
        if (!p.isBot) {
          const u = this.users.get(p.userId);
          if (u && (p.payoutCents || 0) > 0) {
            u.balanceCents += p.payoutCents!;
            if (p.status === 'WON') {
              u.totalWins += 1;
              u.totalWonCents += p.payoutCents!;
              u.netProfitCents = u.totalWonCents - u.totalWageredCents;
              u.winRate = Number(((u.totalWins / Math.max(1, u.totalBets)) * 100).toFixed(1));
            }
            this._saveUser(u);
            this.emit('user:updated', { ...u });
          }
          const ub = this.userBets.get(p.userId) || [];
          const match = ub.find((b) => b.betId === p.betId);
          if (match) {
            match.status = p.status as any;
            match.payoutCents = p.payoutCents || 0;
            match.closePrice = closePrice;
            match.outcome = outcome;
          }
        }
      }
      const txRef = `MW-${randHex(4).toUpperCase()}`;
      const settled: SettledRound = {
        roundId: closing.roundId,
        roundNumber: closing.roundNumber,
        symbol: room.symbol,
        category: room.category,
        timeframe: room.timeframe,
        tierCents: room.tierCents,
        lockTime: closing.lockTime,
        closeTime: closing.closeTime,
        lockPrice: closing.lockPrice,
        closePrice,
        outcome: outcome === 'DRAW' ? 'DRAW' : winnersRaw.length === 0 ? 'NO_WINNERS' : outcome,
        playerCount: closing.players.length,
        upCount: closing.players.filter((p: RoundPlayer) => p.direction === 'UP').length,
        downCount: closing.players.filter((p: RoundPlayer) => p.direction === 'DOWN').length,
        totalPoolCents: totalPool,
        masterFeeCents: fee,
        dustCents: dust,
        distributablePoolCents: dist,
        winnerCount: winnersRaw.length,
        payoutPerWinnerCents: perWin,
        txRef,
        settledAt: now,
        players: settledPlayers,
        winners: settledPlayers.filter((p) => p.status === 'WON'),
      };
      room.lastSettled = settled;
      this.settledRounds.unshift(settled);
      if (this.settledRounds.length > 80) this.settledRounds.pop();
      if (fee > 0) {
        this.masterLedger.unshift({
          id: `mw_${randHex(4)}`,
          roundId: settled.roundId,
          roundNumber: settled.roundNumber,
          symbol: room.symbol,
          category: room.category,
          timeframe: room.timeframe,
          tierCents: room.tierCents,
          totalPoolCents: totalPool,
          feeCents: fee,
          dustCents: dust,
          totalMasterCreditCents: fee + dust,
          distributableCents: dist,
          winnerCount: winnersRaw.length,
          payoutPerWinnerCents: perWin,
          txRef,
          createdAt: now,
        });
      }
      if (room.key === this.watchedRoom) {
        this.emit('round:settled', settled);
      }
    }

    const nextLock = Math.floor(now / room.tf.durationMs) * room.tf.durationMs;
    const promoted = room.openRound;
    promoted.status = 'LIVE';
    promoted.lockTime = nextLock;
    promoted.closeTime = nextLock + room.tf.durationMs;
    promoted.lockPrice = closePrice;
    room.liveRound = promoted;
    room.openRound = this._makeRound(room.symbol, room.tf, room.tierCents, 'OPEN', nextLock + room.tf.durationMs, null);
    if (this.botsEnabled && (room.key === this.watchedRoom || (room.timeframe === '1m' && room.tierCents === 1000))) {
      if (room.liveRound.players.length < 4) this._seedBotsInRound(room.liveRound, 6);
      this._seedBotsInRound(room.openRound, 4);
    }
    if (room.key === this.watchedRoom) {
      this.emit('room:state', this.getRoomSnapshot(room.symbol, room.timeframe, room.tierCents));
    }
  }

  _saveUser(u: UserProfile) {
    try {
      localStorage.setItem(`pulse_user_${u.id}`, JSON.stringify(u));
    } catch {
      // ignore
    }
  }

  _getOrCreateUser(username: string): UserProfile {
    const clean = username.trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 20);
    if (clean.length < 2) throw new Error('Username must be at least 2 characters');
    for (const u of this.users.values()) {
      if (!u.isBot && u.username.toLowerCase() === clean.toLowerCase()) return u;
    }
    const id = `usr_${clean.toLowerCase()}`;
    try {
      const saved = localStorage.getItem(`pulse_user_${id}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        this.users.set(id, parsed);
        return parsed;
      }
    } catch {
      // ignore
    }
    const u: UserProfile = {
      id,
      username: clean,
      avatarColor: '#00E599',
      balanceCents: 100_000,
      isBot: false,
      totalBets: 0,
      totalWins: 0,
      totalWageredCents: 0,
      totalWonCents: 0,
      netProfitCents: 0,
      winRate: 0,
      createdAt: Date.now(),
    };
    this.users.set(id, u);
    this._saveUser(u);
    return u;
  }

  _debitUser(userId: string, cents: number): UserProfile {
    const u = this.users.get(userId);
    if (!u) throw new Error('Please connect your wallet first');
    if (cents < 100) throw new Error('Minimum bet is $1.00');
    if (u.balanceCents < cents) throw new Error('Insufficient balance — click +500 to top up.');
    u.balanceCents -= cents;
    u.totalBets += 1;
    u.totalWageredCents += cents;
    u.netProfitCents = u.totalWonCents - u.totalWageredCents;
    this._saveUser(u);
    return u;
  }

  _recordOriginalBet(userId: string, game: string, stakeCents: number, mult: number, payoutCents: number, status: 'WON' | 'LOST', alreadyDebited: boolean) {
    const u = alreadyDebited ? this.users.get(userId)! : this._debitUser(userId, stakeCents);
    if (payoutCents > 0) {
      u.balanceCents += payoutCents;
      if (status === 'WON') u.totalWins += 1;
      u.totalWonCents += payoutCents;
      u.netProfitCents = u.totalWonCents - u.totalWageredCents;
      u.winRate = Number(((u.totalWins / Math.max(1, u.totalBets)) * 100).toFixed(1));
    }
    this._saveUser(u);
    this.fairness.nonce += 1;
    const rec: OriginalBetRecord = {
      id: `orig_${randHex(5)}`,
      userId: u.id,
      username: u.username,
      avatarColor: u.avatarColor,
      isBot: false,
      game,
      stakeCents,
      multiplier: Number(mult.toFixed(2)),
      payoutCents,
      houseDeltaCents: stakeCents - payoutCents,
      status,
      createdAt: Date.now(),
    };
    this.originalsBets.unshift(rec);
    if (this.originalsBets.length > 60) this.originalsBets.pop();
    this.emit('user:updated', { ...u });
    this.emit('originals:bet', rec);
    this.emit('master_wallet:update', this.getMasterWallet());
    return { user: { ...u }, record: rec };
  }

  _serializeRound(round: any, curPrice: number): ActiveRoundState {
    const now = Date.now();
    const upCount = round.players.filter((p: RoundPlayer) => p.direction === 'UP').length;
    const downCount = round.players.filter((p: RoundPlayer) => p.direction === 'DOWN').length;
    const totalPoolCents = round.players.length * round.tierCents;
    const masterFeeCents = Math.round(totalPoolCents * 0.1);
    const distributablePoolCents = totalPoolCents - masterFeeCents;
    const entriesOpen = round.status === 'OPEN' && now < round.entryCloseTime;
    return {
      ...round,
      phase: round.status === 'LIVE' ? 'LIVE' : entriesOpen ? 'OPEN' : 'LOCKED_CUTOFF',
      entriesOpen,
      leadingSide: round.lockPrice != null ? (curPrice > round.lockPrice ? 'UP' : curPrice < round.lockPrice ? 'DOWN' : 'TIE') : 'TIE',
      playerCount: round.players.length,
      upCount,
      downCount,
      totalPoolCents,
      masterFeeCents,
      distributablePoolCents,
      estUpPayoutCents: upCount > 0 ? Math.floor(distributablePoolCents / upCount) : 0,
      estDownPayoutCents: downCount > 0 ? Math.floor(distributablePoolCents / downCount) : 0,
    };
  }

  getRoomSnapshot(symbol: string, timeframe: string, tierCents: number): RoomSnapshot {
    const key = `${symbol}|${timeframe}|${tierCents}`;
    const room = this.rooms.get(key) || this.rooms.get('BTC/USDT|1m|1000')!;
    const curPrice = this.tickers.get(room.symbol)!.price;
    return {
      roomKey: room.key,
      symbol: room.symbol,
      category: room.category,
      timeframe: room.timeframe,
      tierCents: room.tierCents,
      serverTime: Date.now(),
      currentPrice: curPrice,
      liveRound: this._serializeRound(room.liveRound, curPrice),
      openRound: this._serializeRound(room.openRound, curPrice),
      lastSettled: room.lastSettled,
      recentRounds: this.settledRounds.filter((r) => r.symbol === room.symbol && r.timeframe === room.timeframe && r.tierCents === room.tierCents).slice(0, 12),
    };
  }

  getGlobalStats(): GlobalStats {
    let liveTotal = 0;
    let openTotal = 0;
    let pool = 0;
    const byMarket: Record<string, number> = {};
    const byMarketTimeframe: Record<string, Record<string, number>> = {};
    for (const m of MARKETS_DEF) {
      byMarket[m.symbol] = 0;
      byMarketTimeframe[m.symbol] = {};
      for (const tf of TIMEFRAMES) byMarketTimeframe[m.symbol][tf.id] = 0;
    }
    for (const r of this.rooms.values()) {
      const lc = r.liveRound.players.length;
      const oc = r.openRound.players.length;
      liveTotal += lc;
      openTotal += oc;
      pool += (lc + oc) * r.tierCents;
      byMarket[r.symbol] += lc + oc;
      byMarketTimeframe[r.symbol][r.timeframe] += lc + oc;
    }
    return {
      onlineClients: 1,
      livePlayersTotal: liveTotal,
      openPlayersTotal: openTotal,
      totalPlayingNow: liveTotal + openTotal,
      totalActivePoolCents: pool,
      botsEnabled: this.botsEnabled,
      byMarket,
      byMarketTimeframe,
      serverTime: Date.now(),
    };
  }

  getMasterWallet(): MasterWalletSummary {
    const predBal = this.masterLedger.reduce((a, b) => a + b.totalMasterCreditCents, 0);
    const predVol = this.masterLedger.reduce((a, b) => a + b.totalPoolCents, 0);
    const predDist = this.masterLedger.reduce((a, b) => a + b.distributableCents - b.dustCents, 0);
    const origWag = this.originalsBets.reduce((a, b) => a + b.stakeCents, 0);
    const origPay = this.originalsBets.reduce((a, b) => a + b.payoutCents, 0);
    const origNet = origWag - origPay;

    const byGameMap = new Map<string, { game: string; betsCount: number; wageredCents: number; payoutCents: number; houseDeltaCents: number }>();
    for (const b of this.originalsBets) {
      const g = byGameMap.get(b.game) || { game: b.game, betsCount: 0, wageredCents: 0, payoutCents: 0, houseDeltaCents: 0 };
      g.betsCount += 1;
      g.wageredCents += b.stakeCents;
      g.payoutCents += b.payoutCents;
      g.houseDeltaCents += b.houseDeltaCents;
      byGameMap.set(b.game, g);
    }

    return {
      address: MASTER_ADDRESS,
      feeRatePercent: 10,
      totalBalanceCents: predBal,
      combinedTreasuryCents: predBal + origNet,
      totalFeeCents: this.masterLedger.reduce((a, b) => a + b.feeCents, 0),
      totalDustCents: this.masterLedger.reduce((a, b) => a + b.dustCents, 0),
      totalVolumeCents: predVol,
      totalDistributedCents: predDist,
      settledRoundsCount: this.masterLedger.length,
      byCategory: ['crypto', 'commodity'].map((cat) => {
        const rows = this.masterLedger.filter((r) => r.category === cat);
        return {
          category: cat as 'crypto' | 'commodity',
          roundsCount: rows.length,
          volumeCents: rows.reduce((a, b) => a + b.totalPoolCents, 0),
          feeCents: rows.reduce((a, b) => a + b.totalMasterCreditCents, 0),
        };
      }),
      byTimeframe: TIMEFRAMES.map((tf) => {
        const rows = this.masterLedger.filter((r) => r.timeframe === tf.id);
        return {
          timeframe: tf.id,
          roundsCount: rows.length,
          volumeCents: rows.reduce((a, b) => a + b.totalPoolCents, 0),
          feeCents: rows.reduce((a, b) => a + b.totalMasterCreditCents, 0),
        };
      }).filter((x) => x.roundsCount > 0),
      ledger: this.masterLedger.slice(0, 50),
      originals: {
        totalWageredCents: origWag,
        totalPayoutCents: origPay,
        netHouseCents: origNet,
        totalBetsCount: this.originalsBets.length,
        byGame: Array.from(byGameMap.values()),
        ledger: this.originalsBets.slice(0, 40),
      },
    };
  }

  async handleApi(urlStr: string, init?: RequestInit): Promise<Response> {
    const url = new URL(urlStr, window.location.origin);
    const path = url.pathname;
    const method = (init?.method || 'GET').toUpperCase();
    const body = init?.body ? JSON.parse(String(init.body)) : {};

    const json = (data: any, status = 200) =>
      new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' },
      });

    try {
      if (path === '/api/bootstrap') {
        return json({
          markets: MARKETS_DEF,
          timeframes: TIMEFRAMES,
          tiers: TIERS,
          masterFeeRate: 0.1,
          masterWalletAddress: MASTER_ADDRESS,
          tickers: Array.from(this.tickers.values()),
          globalStats: this.getGlobalStats(),
          masterWallet: this.getMasterWallet(),
        });
      }

      if (path.startsWith('/api/markets/') && path.endsWith('/history')) {
        const sym = decodeURIComponent(path.slice('/api/markets/'.length, -'/history'.length));
        return json({ symbol: sym, points: this.history.get(sym) || [], candles: this.candles.get(sym) || [] });
      }

      if (path === '/api/room') {
        const sym = url.searchParams.get('symbol') || 'BTC/USDT';
        const tf = url.searchParams.get('timeframe') || '1m';
        const tier = Number(url.searchParams.get('tierCents') || '1000');
        this.watchedRoom = `${sym}|${tf}|${tier}`;
        return json(this.getRoomSnapshot(sym, tf, tier));
      }

      if (path === '/api/users/login' && method === 'POST') {
        return json({ user: this._getOrCreateUser(body.username) });
      }

      if (path.startsWith('/api/users/') && path.endsWith('/topup') && method === 'POST') {
        const uid = decodeURIComponent(path.slice('/api/users/'.length, -'/topup'.length));
        const u = this.users.get(uid);
        if (!u) return json({ error: 'User not found' }, 404);
        u.balanceCents += 50_000;
        this._saveUser(u);
        return json({ user: { ...u }, addedCents: 50_000 });
      }

      if (path.startsWith('/api/users/') && path.endsWith('/bets')) {
        const uid = decodeURIComponent(path.slice('/api/users/'.length, -'/bets'.length));
        return json({ bets: this.userBets.get(uid) || [] });
      }

      if (path.startsWith('/api/users/')) {
        const uid = decodeURIComponent(path.slice('/api/users/'.length));
        const u = this.users.get(uid);
        if (u) return json({ user: u });
        try {
          const saved = localStorage.getItem(`pulse_user_${uid}`);
          if (saved) {
            const p = JSON.parse(saved);
            this.users.set(uid, p);
            return json({ user: p });
          }
        } catch {
          // ignore
        }
        return json({ error: 'Not found' }, 404);
      }

      if (path === '/api/bets' && method === 'POST') {
        const { userId, symbol, timeframe, tierCents, direction } = body;
        const key = `${symbol}|${timeframe}|${Number(tierCents)}`;
        const room = this.rooms.get(key);
        if (!room) return json({ error: 'Room not found' }, 404);
        if (Date.now() >= room.openRound.entryCloseTime) {
          const secs = Math.max(1, Math.ceil((room.openRound.lockTime - Date.now()) / 1000));
          return json({ error: `Anti-Snipe Lock Active: Entries closed ${Math.round(room.tf.entryCutoffMs / 1000)}s before candle open. Next window opens in ${secs}s.` }, 400);
        }
        if (room.openRound.players.some((p: RoundPlayer) => p.userId === userId)) {
          return json({ error: 'Already entered this round' }, 400);
        }
        const u = this._debitUser(userId, Number(tierCents));
        const betId = `bet_${randHex(5)}`;
        room.openRound.players.push({
          betId,
          userId: u.id,
          username: u.username,
          avatarColor: u.avatarColor,
          isBot: false,
          direction: direction as Direction,
          stakeCents: Number(tierCents),
          createdAt: Date.now(),
        });
        const ub = this.userBets.get(u.id) || [];
        ub.unshift({
          betId,
          roundId: room.openRound.roundId,
          roundNumber: room.openRound.roundNumber,
          symbol,
          timeframe,
          tierCents: Number(tierCents),
          direction,
          stakeCents: Number(tierCents),
          payoutCents: 0,
          status: 'PENDING',
          lockPrice: null,
          closePrice: null,
          outcome: null,
          totalPoolCents: null,
          masterFeeCents: null,
          winnerCount: null,
          createdAt: Date.now(),
          settledAt: null,
        });
        this.userBets.set(u.id, ub);
        const snap = this.getRoomSnapshot(symbol, timeframe, Number(tierCents));
        this.emit('room:state', snap);
        this.emit('global:stats', this.getGlobalStats());
        return json({ user: { ...u }, roundNumber: room.openRound.roundNumber, room: snap });
      }

      if (path === '/api/leaderboard') {
        const list = Array.from(this.users.values())
          .filter((u) => u.totalBets > 0)
          .sort((a, b) => b.netProfitCents - a.netProfitCents)
          .slice(0, 25);
        return json({ leaderboard: list });
      }

      if (path === '/api/rounds/recent') {
        return json({ rounds: this.settledRounds.slice(0, 30) });
      }

      if (path === '/api/master-wallet') {
        return json(this.getMasterWallet());
      }

      if (path === '/api/settings/bots' && method === 'POST') {
        this.botsEnabled = Boolean(body.enabled);
        this.emit('global:stats', this.getGlobalStats());
        return json({ botsEnabled: this.botsEnabled });
      }

      // ==================== ORIGINALS ENDPOINTS ====================
      if (path === '/api/originals/config') {
        return json({ crash: this.crashState, recentBets: this.originalsBets.slice(0, 25) });
      }

      if (path.startsWith('/api/originals/sessions/')) {
        return json({
          sessions: {
            pump: this.pumpSession,
            mines: this.minesSession,
            tower: this.towerSession,
            blackjack: this.bjSession,
          },
          fairness: this.fairness,
        });
      }

      if (path === '/api/originals/fairness/rotate' && method === 'POST') {
        const prev = this.fairness.serverSeedHash;
        this.fairness = {
          serverSeedHash: randHex(32),
          clientSeed: String(body.clientSeed || this.fairness.clientSeed).slice(0, 40),
          nonce: 0,
        };
        return json({ revealedPreviousServerSeed: prev, current: this.fairness });
      }

      // CRASH
      if (path === '/api/originals/crash/bet' && method === 'POST') {
        if (this.crashState.phase !== 'BETTING') return json({ error: 'Wait for next launch window' }, 400);
        const u = this._debitUser(body.userId, Math.round(body.stakeCents));
        const entry: CrashPlayer = {
          betId: `cr_${randHex(4)}`,
          userId: u.id,
          username: u.username,
          avatarColor: u.avatarColor,
          isBot: false,
          stakeCents: Math.round(body.stakeCents),
          autoCashout: body.autoCashout ? Number(body.autoCashout) : null,
          status: 'ACTIVE',
          cashoutMultiplier: null,
          payoutCents: 0,
        };
        this.crashState.players.unshift(entry);
        this.emit('crash:state', { ...this.crashState });
        return json({ user: { ...u }, entry, state: this.crashState });
      }
      if (path === '/api/originals/crash/cashout' && method === 'POST') {
        if (this.crashState.phase !== 'FLYING') return json({ error: 'Not flying' }, 400);
        const entry = this.crashState.players.find((p) => p.userId === body.userId && p.status === 'ACTIVE');
        if (!entry) return json({ error: 'No active Crash bet' }, 400);
        entry.status = 'CASHED_OUT';
        entry.cashoutMultiplier = this.crashState.multiplier;
        entry.payoutCents = Math.floor(entry.stakeCents * entry.cashoutMultiplier);
        const { user, record } = this._recordOriginalBet(entry.userId, 'crash', entry.stakeCents, entry.cashoutMultiplier, entry.payoutCents, 'WON', true);
        this.emit('crash:state', { ...this.crashState });
        return json({ user, entry, record, state: this.crashState });
      }

      // PUMP
      if (path === '/api/originals/pump/start' && method === 'POST') {
        const diff = PUMP_CFG[body.difficulty] ? body.difficulty : 'medium';
        const cfg = PUMP_CFG[diff];
        const u = this._debitUser(body.userId, Math.round(body.stakeCents));
        const popAt = 1 + Math.floor(Math.random() * (cfg.totalPumps - cfg.popsCount + 1));
        this.pumpSession = {
          sessionId: `pump_${randHex(4)}`,
          difficulty: diff,
          stakeCents: Math.round(body.stakeCents),
          pumps: 0,
          maxSafePumps: cfg.totalPumps - cfg.popsCount,
          totalPumps: cfg.totalPumps,
          popsCount: cfg.popsCount,
          currentMultiplier: 1.0,
          nextMultiplier: getPumpMult(diff, 1),
          currentPayoutCents: Math.round(body.stakeCents),
          nextPopChancePct: Number(((cfg.popsCount / cfg.totalPumps) * 100).toFixed(1)),
          status: 'ACTIVE',
          popAtPump: null,
          _popAt: popAt,
        };
        return json({ user: { ...u }, session: this.pumpSession });
      }
      if (path === '/api/originals/pump/pump' && method === 'POST') {
        const s = this.pumpSession;
        if (!s || s.status !== 'ACTIVE') return json({ error: 'No active Pump balloon' }, 400);
        s.pumps += 1;
        if (s.pumps >= s._popAt) {
          s.status = 'POPPED';
          s.popAtPump = s._popAt;
          this.pumpSession = null;
          const { user, record } = this._recordOriginalBet(body.userId, 'pump', s.stakeCents, 0, 0, 'LOST', true);
          return json({ user, popped: true, session: s, record });
        }
        s.currentMultiplier = getPumpMult(s.difficulty, s.pumps);
        s.nextMultiplier = getPumpMult(s.difficulty, Math.min(s.maxSafePumps, s.pumps + 1));
        s.currentPayoutCents = Math.floor(s.stakeCents * s.currentMultiplier);
        s.nextPopChancePct = Number(((s.popsCount / Math.max(1, s.totalPumps - s.pumps)) * 100).toFixed(1));
        return json({ popped: false, cashedOut: false, session: { ...s } });
      }
      if (path === '/api/originals/pump/cashout' && method === 'POST') {
        const s = this.pumpSession;
        if (!s || s.status !== 'ACTIVE' || s.pumps < 1) return json({ error: 'Pump at least once first' }, 400);
        s.status = 'CASHED_OUT';
        s.popAtPump = s._popAt;
        this.pumpSession = null;
        const { user, record } = this._recordOriginalBet(body.userId, 'pump', s.stakeCents, s.currentMultiplier, s.currentPayoutCents, 'WON', true);
        return json({ user, popped: false, cashedOut: true, session: s, record });
      }

      // MINES
      if (path === '/api/originals/mines/start' && method === 'POST') {
        const mineCount = Math.max(1, Math.min(24, Number(body.mineCount || 3)));
        const u = this._debitUser(body.userId, Math.round(body.stakeCents));
        const mines = Array.from({ length: 25 }, (_, i) => i).sort(() => Math.random() - 0.5).slice(0, mineCount);
        this.minesSession = {
          sessionId: `mines_${randHex(4)}`,
          stakeCents: Math.round(body.stakeCents),
          mineCount,
          revealed: [] as number[],
          mines: null,
          _mines: mines,
          hitMineTile: null,
          currentMultiplier: 1.0,
          nextMultiplier: getMinesMult(mineCount, 1),
          currentPayoutCents: Math.round(body.stakeCents),
          status: 'ACTIVE',
        };
        return json({ user: { ...u }, session: this.minesSession });
      }
      if (path === '/api/originals/mines/reveal' && method === 'POST') {
        const s = this.minesSession;
        if (!s || s.status !== 'ACTIVE') return json({ error: 'No active Mines board' }, 400);
        const idx = Number(body.tileIndex);
        if (s._mines.includes(idx)) {
          s.hitMineTile = idx;
          s.mines = s._mines;
          s.status = 'LOST';
          this.minesSession = null;
          const { user, record } = this._recordOriginalBet(body.userId, 'mines', s.stakeCents, 0, 0, 'LOST', true);
          return json({ user, hitMine: true, session: s, record });
        }
        s.revealed.push(idx);
        s.currentMultiplier = getMinesMult(s.mineCount, s.revealed.length);
        s.nextMultiplier = getMinesMult(s.mineCount, s.revealed.length + 1);
        s.currentPayoutCents = Math.floor(s.stakeCents * s.currentMultiplier);
        return json({ hitMine: false, cashedOut: false, session: { ...s } });
      }
      if (path === '/api/originals/mines/cashout' && method === 'POST') {
        const s = this.minesSession;
        if (!s || s.status !== 'ACTIVE' || s.revealed.length < 1) return json({ error: 'Reveal a gem first' }, 400);
        s.status = 'CASHED_OUT';
        s.mines = s._mines;
        this.minesSession = null;
        const { user, record } = this._recordOriginalBet(body.userId, 'mines', s.stakeCents, s.currentMultiplier, s.currentPayoutCents, 'WON', true);
        return json({ user, hitMine: false, cashedOut: true, session: s, record });
      }

      // PLINKO
      if (path === '/api/originals/plinko/drop' && method === 'POST') {
        const rows = [8, 12, 16].includes(Number(body.rows)) ? Number(body.rows) : 12;
        const risk: 'low' | 'medium' | 'high' = ['low', 'medium', 'high'].includes(body.risk) ? body.risk : 'medium';
        const p: number[] = Array.from({ length: rows }, () => (Math.random() < 0.5 ? 0 : 1));
        const bucketIndex = p.reduce((a, b) => a + b, 0);
        const multiplier = PLINKO_TABLES[rows][risk][bucketIndex];
        const stakeCents = Math.round(body.stakeCents);
        const payoutCents = Math.floor(stakeCents * multiplier);
        const { user, record } = this._recordOriginalBet(body.userId, 'plinko', stakeCents, multiplier, payoutCents, payoutCents >= stakeCents ? 'WON' : 'LOST', false);
        return json({ user, outcome: { rows, risk, path: p, bucketIndex, multiplier }, record });
      }

      // DICE
      if (path === '/api/originals/dice/roll' && method === 'POST') {
        const target = Math.max(2, Math.min(98, Number(body.target || 50)));
        const isOver = body.condition !== 'under';
        const roll = Number((Math.floor(Math.random() * 10001) / 100).toFixed(2));
        const winChance = isOver ? 100 - target : target;
        const mult = Number((99 / winChance).toFixed(4));
        const won = isOver ? roll > target : roll < target;
        const stakeCents = Math.round(body.stakeCents);
        const payoutCents = won ? Math.floor(stakeCents * mult) : 0;
        const { user, record } = this._recordOriginalBet(body.userId, 'dice', stakeCents, won ? mult : 0, payoutCents, won ? 'WON' : 'LOST', false);
        return json({ user, outcome: { roll, target, condition: isOver ? 'over' : 'under', winChance, multiplier: mult, won }, record });
      }

      // LIMBO
      if (path === '/api/originals/limbo/play' && method === 'POST') {
        const targetMultiplier = Math.max(1.01, Math.min(1_000_000, Number(body.targetMultiplier || 2)));
        const resultMultiplier = Math.max(1.0, Math.min(1_000_000, Number((0.99 / Math.max(Math.random(), 1e-6)).toFixed(2))));
        const won = resultMultiplier >= targetMultiplier;
        const stakeCents = Math.round(body.stakeCents);
        const payoutCents = won ? Math.floor(stakeCents * targetMultiplier) : 0;
        const { user, record } = this._recordOriginalBet(body.userId, 'limbo', stakeCents, won ? targetMultiplier : 0, payoutCents, won ? 'WON' : 'LOST', false);
        return json({ user, outcome: { targetMultiplier, resultMultiplier, won }, record });
      }

      // KENO
      if (path === '/api/originals/keno/table') {
        return json({ table: getKenoTable(Number(url.searchParams.get('picks') || '5'), url.searchParams.get('risk') || 'medium') });
      }
      if (path === '/api/originals/keno/play' && method === 'POST') {
        const picks: number[] = body.picks || [];
        const risk = body.risk || 'medium';
        const drawn = Array.from({ length: 40 }, (_, i) => i + 1).sort(() => Math.random() - 0.5).slice(0, 10);
        const dSet = new Set(drawn);
        const hits = picks.filter((x) => dSet.has(x));
        const table = getKenoTable(picks.length, risk);
        const multiplier = table[hits.length] || 0;
        const stakeCents = Math.round(body.stakeCents);
        const payoutCents = Math.floor(stakeCents * multiplier);
        const { user, record } = this._recordOriginalBet(body.userId, 'keno', stakeCents, multiplier, payoutCents, payoutCents >= stakeCents ? 'WON' : 'LOST', false);
        return json({ user, outcome: { picks, drawn, hits, hitCount: hits.length, risk, payoutTable: table, multiplier }, record });
      }

      // DRAGON TOWER
      if (path === '/api/originals/tower/start' && method === 'POST') {
        const diff = TOWER_CFG[body.difficulty] ? body.difficulty : 'medium';
        const cfg = TOWER_CFG[diff];
        const u = this._debitUser(body.userId, Math.round(body.stakeCents));
        const gridBombs = Array.from({ length: cfg.rows }, () =>
          Array.from({ length: cfg.cols }, (_, c) => c).sort(() => Math.random() - 0.5).slice(0, cfg.bombs)
        );
        this.towerSession = {
          sessionId: `tw_${randHex(4)}`,
          difficulty: diff,
          cols: cfg.cols,
          bombsPerRow: cfg.bombs,
          rows: cfg.rows,
          stakeCents: Math.round(body.stakeCents),
          currentFloor: 0,
          picks: [] as number[],
          hitBomb: null,
          gridBombs: null,
          _gridBombs: gridBombs,
          currentMultiplier: 1.0,
          nextMultiplier: getTowerMult(diff, 1),
          currentPayoutCents: Math.round(body.stakeCents),
          status: 'ACTIVE',
        };
        return json({ user: { ...u }, session: this.towerSession });
      }
      if (path === '/api/originals/tower/pick' && method === 'POST') {
        const s = this.towerSession;
        if (!s || s.status !== 'ACTIVE') return json({ error: 'No active Tower climb' }, 400);
        const col = Number(body.colIndex);
        if (s._gridBombs[s.currentFloor].includes(col)) {
          s.hitBomb = { floor: s.currentFloor, col };
          s.gridBombs = s._gridBombs;
          s.status = 'LOST';
          this.towerSession = null;
          const { user, record } = this._recordOriginalBet(body.userId, 'tower', s.stakeCents, 0, 0, 'LOST', true);
          return json({ user, hitBomb: true, session: s, record });
        }
        s.picks.push(col);
        s.currentFloor += 1;
        s.currentMultiplier = getTowerMult(s.difficulty, s.currentFloor);
        s.nextMultiplier = getTowerMult(s.difficulty, Math.min(s.rows, s.currentFloor + 1));
        s.currentPayoutCents = Math.floor(s.stakeCents * s.currentMultiplier);
        if (s.currentFloor >= s.rows) {
          s.status = 'CASHED_OUT';
          s.gridBombs = s._gridBombs;
          this.towerSession = null;
          const { user, record } = this._recordOriginalBet(body.userId, 'tower', s.stakeCents, s.currentMultiplier, s.currentPayoutCents, 'WON', true);
          return json({ user, hitBomb: false, cashedOut: true, session: s, record });
        }
        return json({ hitBomb: false, cashedOut: false, session: { ...s } });
      }
      if (path === '/api/originals/tower/cashout' && method === 'POST') {
        const s = this.towerSession;
        if (!s || s.status !== 'ACTIVE' || s.currentFloor < 1) return json({ error: 'Clear floor 1 first' }, 400);
        s.status = 'CASHED_OUT';
        s.gridBombs = s._gridBombs;
        this.towerSession = null;
        const { user, record } = this._recordOriginalBet(body.userId, 'tower', s.stakeCents, s.currentMultiplier, s.currentPayoutCents, 'WON', true);
        return json({ user, hitBomb: false, cashedOut: true, session: s, record });
      }

      // WHEEL
      if (path === '/api/originals/wheel/segments') {
        return json({ wheel: getWheelSegs(Number(url.searchParams.get('segments') || '20'), url.searchParams.get('risk') || 'medium') });
      }
      if (path === '/api/originals/wheel/spin' && method === 'POST') {
        const wheel = getWheelSegs(Number(body.segments || 20), body.risk || 'medium');
        const index = Math.floor(Math.random() * wheel.length);
        const multiplier = wheel[index];
        const stakeCents = Math.round(body.stakeCents);
        const payoutCents = Math.floor(stakeCents * multiplier);
        const { user, record } = this._recordOriginalBet(body.userId, 'wheel', stakeCents, multiplier, payoutCents, payoutCents >= stakeCents ? 'WON' : 'LOST', false);
        return json({ user, outcome: { segments: wheel.length, risk: body.risk, wheel, index, multiplier }, record });
      }

      // BLACKJACK
      if (path === '/api/originals/blackjack/deal' && method === 'POST') {
        const stakeCents = Math.round(body.stakeCents);
        const u = this._debitUser(body.userId, stakeCents);
        const pCards = [drawRandomCard(), drawRandomCard()];
        const dCards = [drawRandomCard(), drawRandomCard()];
        const s: any = {
          sessionId: `bj_${randHex(4)}`,
          userId: u.id,
          status: 'ACTIVE',
          activeHandIndex: 0,
          dealerCards: dCards,
          hands: [{ cards: pCards, stakeCents, doubled: false, status: 'ACTIVE', outcome: null, payoutCents: 0 }],
          totalPayoutCents: 0,
        };
        this.bjSession = s;
        const pe = evalBj(pCards);
        const de = evalBj(dCards);
        if (pe.isBlackjack || de.isBlackjack) {
          return json(this._finishBj(s));
        }
        return json({ user: { ...u }, session: this._serializeBj(s) });
      }

      if (path === '/api/originals/blackjack/action' && method === 'POST') {
        const s = this.bjSession;
        if (!s || s.status !== 'ACTIVE') return json({ error: 'No active Blackjack hand' }, 400);
        const h = s.hands[s.activeHandIndex];
        const act = body.action;
        if (act === 'hit') {
          h.cards.push(drawRandomCard());
          const ev = evalBj(h.cards);
          if (ev.isBust) { h.status = 'BUSTED'; s.activeHandIndex += 1; }
          else if (ev.total === 21) { h.status = 'STOOD'; s.activeHandIndex += 1; }
        } else if (act === 'stand') {
          h.status = 'STOOD';
          s.activeHandIndex += 1;
        } else if (act === 'double') {
          this._debitUser(s.userId, h.stakeCents);
          h.stakeCents *= 2;
          h.doubled = true;
          h.cards.push(drawRandomCard());
          h.status = evalBj(h.cards).isBust ? 'BUSTED' : 'STOOD';
          s.activeHandIndex += 1;
        } else if (act === 'split') {
          this._debitUser(s.userId, h.stakeCents);
          const second = h.cards.pop();
          s.hands.push({ cards: [second, drawRandomCard()], stakeCents: h.stakeCents, doubled: false, status: 'ACTIVE', outcome: null, payoutCents: 0 });
          h.cards.push(drawRandomCard());
        }
        if (s.activeHandIndex >= s.hands.length) {
          return json(this._finishBj(s));
        }
        return json({ user: { ...this.users.get(s.userId)! }, session: this._serializeBj(s) });
      }

      // ==================== DEPOSIT & WITHDRAWAL GATEWAY ====================
      const PAY_METHODS = [
        { id: 'USDT-TRC20', rail: 'CRYPTO', label: 'USDT (TRC20)', network: 'TRON', minDepositCents: 0, maxDepositCents: 10_000_000, minWithdrawCents: 0, maxWithdrawCents: 5_000_000, depositFeeFlatCents: 0, withdrawFeeFlatCents: 100, eta: '~1–3 mins', placeholder: 'T... (TRON TRC20 wallet address)' },
        { id: 'USDT-ERC20', rail: 'CRYPTO', label: 'USDT (ERC20)', network: 'Ethereum', minDepositCents: 0, maxDepositCents: 10_000_000, minWithdrawCents: 0, maxWithdrawCents: 5_000_000, depositFeeFlatCents: 0, withdrawFeeFlatCents: 300, eta: '~2–5 mins', placeholder: '0x... (Ethereum ERC20 address)' },
        { id: 'USDT-POLYGON', rail: 'CRYPTO', label: 'USDT (Polygon)', network: 'Polygon POS', minDepositCents: 0, maxDepositCents: 10_000_000, minWithdrawCents: 0, maxWithdrawCents: 5_000_000, depositFeeFlatCents: 0, withdrawFeeFlatCents: 50, eta: '~30 secs', placeholder: '0x... (Polygon wallet address)' },
        { id: 'BTC', rail: 'CRYPTO', label: 'Bitcoin (BTC)', network: 'Bitcoin Mainnet', minDepositCents: 0, maxDepositCents: 10_000_000, minWithdrawCents: 0, maxWithdrawCents: 5_000_000, depositFeeFlatCents: 0, withdrawFeeFlatCents: 250, eta: '~10 mins', placeholder: 'bc1q... (Bitcoin address)' },
        { id: 'SOL', rail: 'CRYPTO', label: 'Solana (SOL)', network: 'Solana', minDepositCents: 0, maxDepositCents: 10_000_000, minWithdrawCents: 0, maxWithdrawCents: 5_000_000, depositFeeFlatCents: 0, withdrawFeeFlatCents: 25, eta: '~15 secs', placeholder: 'Solana wallet address' },
        { id: 'UPI', rail: 'UPI', label: 'UPI Instant', network: 'NPCI / Razorpay', minDepositCents: 0, maxDepositCents: 2_500_000, minWithdrawCents: 0, maxWithdrawCents: 2_500_000, depositFeeFlatCents: 0, withdrawFeeFlatCents: 0, eta: 'Instant', placeholder: 'yourname@upi / phone@paytm' },
        { id: 'CARD', rail: 'CARD', label: 'Visa / Mastercard', network: 'Stripe / Gateway', minDepositCents: 0, maxDepositCents: 5_000_000, minWithdrawCents: 0, maxWithdrawCents: 2_500_000, depositFeeFlatCents: 0, withdrawFeeFlatCents: 150, eta: 'Instant – 1 day', placeholder: 'Cardholder / Bank IBAN or Last 4' },
        { id: 'BANK', rail: 'BANK', label: 'Bank Transfer (IMPS / Wire)', network: 'Direct Bank Rail', minDepositCents: 0, maxDepositCents: 10_000_000, minWithdrawCents: 0, maxWithdrawCents: 10_000_000, depositFeeFlatCents: 0, withdrawFeeFlatCents: 0, eta: '~15 mins – 1 day', placeholder: 'Account No. / IFSC or Routing' },
      ];

      if (path === '/api/payments/config') {
        return json({ provider: 'sandbox', isSandbox: true, methods: PAY_METHODS });
      }
      if (path.startsWith('/api/payments/history/')) {
        const uid = decodeURIComponent(path.slice('/api/payments/history/'.length));
        return json({ transactions: this.payments.filter((p) => p.userId === uid) });
      }
      if (path === '/api/payments/deposit' && method === 'POST') {
        const m = PAY_METHODS.find((x) => x.id === body.asset) || PAY_METHODS[0];
        const amt = Math.round(Number(body.amountCents || 0));
        if (!Number.isFinite(amt) || amt <= 0) return json({ error: 'Please enter a deposit amount greater than $0.00' }, 400);
        const dest =
          m.id === 'USDT-TRC20'
            ? `T${randHex(16).toUpperCase()}`
            : m.id === 'UPI'
            ? `pulse.pay@${randHex(3)}okaxis`
            : `0x${randHex(20)}`;
        const tx = {
          id: `dep_${randHex(6)}`,
          userId: body.userId,
          type: 'DEPOSIT',
          rail: m.rail,
          provider: 'sandbox',
          asset: m.id,
          amountCents: amt,
          feeCents: 0,
          netCents: amt,
          destination: dest,
          providerRef: `GW-DEP-${randHex(4).toUpperCase()}`,
          status: 'PENDING',
          metadata: { network: m.network, eta: m.eta },
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        this.payments.unshift(tx);
        return json({ transaction: tx, isSandbox: true });
      }
      if (path === '/api/payments/deposit/confirm' && method === 'POST') {
        const tx = this.payments.find((p) => p.id === body.transactionId);
        if (!tx) return json({ error: 'Deposit not found' }, 404);
        const u = this.users.get(tx.userId);
        if (!u) return json({ error: 'User not found' }, 404);
        if (tx.status !== 'COMPLETED') {
          tx.status = 'COMPLETED';
          tx.providerRef = `0x${randHex(16)}`;
          tx.updatedAt = Date.now();
          u.balanceCents += tx.netCents;
          this._saveUser(u);
          this.emit('user:updated', { ...u });
        }
        return json({ alreadyCompleted: false, transaction: tx, user: { ...u } });
      }
      if (path === '/api/payments/withdraw' && method === 'POST') {
        const m = PAY_METHODS.find((x) => x.id === body.asset) || PAY_METHODS[0];
        const amt = Math.round(Number(body.amountCents || 0));
        if (!Number.isFinite(amt) || amt <= 0) return json({ error: 'Please enter a withdrawal amount greater than $0.00' }, 400);
        if (String(body.destination || '').trim().length < 5) return json({ error: 'Enter a valid payout destination' }, 400);
        const u = this.users.get(body.userId);
        if (!u) return json({ error: 'Sign in required' }, 401);
        if (u.balanceCents < amt) return json({ error: 'Insufficient balance for withdrawal' }, 400);
        u.balanceCents -= amt;
        this._saveUser(u);
        const tx = {
          id: `wd_${randHex(6)}`,
          userId: u.id,
          type: 'WITHDRAWAL',
          rail: m.rail,
          provider: 'sandbox',
          asset: m.id,
          amountCents: amt,
          feeCents: m.withdrawFeeFlatCents,
          netCents: amt - m.withdrawFeeFlatCents,
          destination: String(body.destination).trim(),
          providerRef: `GW-WD-${randHex(4).toUpperCase()}`,
          status: 'PROCESSING',
          metadata: { network: m.network, eta: m.eta },
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        this.payments.unshift(tx);
        this.emit('user:updated', { ...u });
        setTimeout(() => {
          tx.status = 'COMPLETED';
          tx.providerRef = m.rail === 'CRYPTO' ? `0x${randHex(16)}` : `UTR${Date.now().toString().slice(-10)}`;
          tx.updatedAt = Date.now();
        }, 2200);
        return json({ transaction: tx, user: { ...u }, isSandbox: true });
      }

      return json({ error: `Unknown endpoint ${path}` }, 404);
    } catch (err: any) {
      return json({ error: err?.message || 'Request failed' }, 400);
    }
  }

  _serializeBj(s: any) {
    const hideHole = s.status === 'ACTIVE';
    const visDealer = hideHole ? [s.dealerCards[0]] : s.dealerCards;
    const dEv = evalBj(visDealer);
    const active = s.hands[s.activeHandIndex];
    const canHit = s.status === 'ACTIVE' && active?.status === 'ACTIVE';
    return {
      sessionId: s.sessionId,
      status: s.status,
      activeHandIndex: s.activeHandIndex,
      totalStakeCents: s.hands.reduce((a: number, h: any) => a + h.stakeCents, 0),
      totalPayoutCents: s.totalPayoutCents || 0,
      dealerCards: visDealer,
      dealerHoleHidden: hideHole,
      dealerTotal: dEv.total,
      dealerIsSoft: dEv.isSoft,
      hands: s.hands.map((h: any) => ({ ...h, ...evalBj(h.cards) })),
      canHit: Boolean(canHit),
      canStand: Boolean(canHit),
      canDouble: Boolean(canHit && active.cards.length === 2 && !active.doubled),
      canSplit: Boolean(canHit && s.hands.length === 1 && active.cards.length === 2 && active.cards[0].value === active.cards[1].value),
    };
  }

  _finishBj(s: any) {
    if (s.hands.some((h: any) => h.status !== 'BUSTED')) {
      while (evalBj(s.dealerCards).total < 17) s.dealerCards.push(drawRandomCard());
    }
    const de = evalBj(s.dealerCards);
    let totalStake = 0;
    let totalPay = 0;
    for (const h of s.hands) {
      totalStake += h.stakeCents;
      const pe = evalBj(h.cards);
      if (pe.isBust) { h.outcome = 'BUST'; h.payoutCents = 0; }
      else if (pe.isBlackjack && s.hands.length === 1 && !de.isBlackjack) { h.outcome = 'BLACKJACK'; h.payoutCents = Math.floor(h.stakeCents * 2.5); }
      else if (de.isBlackjack && !(pe.isBlackjack && s.hands.length === 1)) { h.outcome = 'LOSE'; h.payoutCents = 0; }
      else if (de.isBust || pe.total > de.total) { h.outcome = 'WIN'; h.payoutCents = h.stakeCents * 2; }
      else if (pe.total === de.total) { h.outcome = 'PUSH'; h.payoutCents = h.stakeCents; }
      else { h.outcome = 'LOSE'; h.payoutCents = 0; }
      h.status = 'SETTLED';
      totalPay += h.payoutCents;
    }
    s.status = 'SETTLED';
    s.totalPayoutCents = totalPay;
    this.bjSession = null;
    const mult = totalStake > 0 ? totalPay / totalStake : 0;
    const { user, record } = this._recordOriginalBet(s.userId, 'blackjack', totalStake, mult, totalPay, totalPay >= totalStake ? 'WON' : 'LOST', true);
    return { user, session: this._serializeBj(s), record };
  }
}

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hashBuf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

interface LocalAuthAccount {
  id: string;
  username: string;
  email: string;
  salt: string;
  passHash: string;
  avatarColor: string;
  createdAt: number;
}

const LOCAL_ACCOUNTS_KEY = 'pulse_accounts_v1';
const LOCAL_SESSION_KEY = 'pulse_local_session_v1';
const CREDITED_DEPOSITS_KEY = 'pulse_credited_deposits_v1';

function getCreditedDepositKeys(): Set<string> {
  try {
    const raw = localStorage.getItem(CREDITED_DEPOSITS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function isDepositAlreadyCredited(tx: any): boolean {
  const keys = getCreditedDepositKeys();
  const candidates = [tx?.id, tx?.metadata?.sessionId, tx?.providerRef].filter(
    (v): v is string => typeof v === 'string' && v.length > 0
  );
  return candidates.some((k) => keys.has(k));
}

function markDepositCredited(tx: any) {
  try {
    const keys = getCreditedDepositKeys();
    for (const v of [tx?.id, tx?.metadata?.sessionId, tx?.providerRef]) {
      if (typeof v === 'string' && v.length > 0) keys.add(v);
    }
    localStorage.setItem(CREDITED_DEPOSITS_KEY, JSON.stringify(Array.from(keys).slice(-500)));
  } catch {
    // ignore storage errors
  }
}

function loadLocalAccounts(): LocalAuthAccount[] {
  try {
    const raw = localStorage.getItem(LOCAL_ACCOUNTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalAccounts(list: LocalAuthAccount[]) {
  try {
    localStorage.setItem(LOCAL_ACCOUNTS_KEY, JSON.stringify(list));
  } catch {
    // ignore quota errors
  }
}

function hydrateStandaloneUser(rt: StandaloneRuntime, base: UserProfile): UserProfile {
  try {
    const saved = localStorage.getItem(`pulse_user_${base.id}`);
    if (saved) {
      const parsed = JSON.parse(saved) as UserProfile;
      const merged: UserProfile = {
        ...base,
        ...parsed,
        email: base.email || parsed.email,
      };
      rt.users.set(merged.id, merged);
      return merged;
    }
  } catch {
    // ignore
  }
  rt.users.set(base.id, base);
  rt._saveUser(base);
  return base;
}

let singleton: StandaloneRuntime | null = null;

export function isStandaloneMode(): boolean {
  const env = (import.meta as unknown as { env?: Record<string, string> }).env;
  return env?.VITE_STANDALONE === 'true';
}

export function getStandaloneRuntime(): StandaloneRuntime {
  if (!singleton) {
    singleton = new StandaloneRuntime();
    const origFetch = window.fetch.bind(window);
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

      // Route REAL Authentication (/api/auth/*) through Vercel Serverless Functions,
      // with salted SHA-256 local credential mirror so Sign Up -> Refresh -> Sign Out -> Sign In
      // survives Vercel serverless cold starts seamlessly!
      if (url.startsWith('/api/auth/')) {
        const jsonResp = (data: unknown, status = 200) =>
          new Response(JSON.stringify(data), {
            status,
            headers: { 'Content-Type': 'application/json' },
          });

        if (url === '/api/auth/signup') {
          const body = init?.body ? JSON.parse(String(init.body)) : {};
          const cleanEmail = String(body.email || '').trim().toLowerCase();
          const cleanUser = String(body.username || '')
            .trim()
            .replace(/[^a-zA-Z0-9_-]/g, '')
            .slice(0, 20);
          const cleanPass = String(body.password || '');

          const accounts = loadLocalAccounts();
          if (accounts.some((a) => a.email === cleanEmail)) {
            return jsonResp(
              { error: 'An account with this email already exists. Please sign in.' },
              409
            );
          }
          if (accounts.some((a) => a.username.toLowerCase() === cleanUser.toLowerCase())) {
            return jsonResp(
              { error: 'That username is already taken. Please pick another handle.' },
              409
            );
          }

          let remoteUser: UserProfile | null = null;
          let remoteToken: string | undefined;
          try {
            const res = await origFetch(input, init);
            const data = await res.json().catch(() => null);
            if (!res.ok) {
              return jsonResp(data || { error: 'Unable to create account' }, res.status);
            }
            if (data?.user) {
              remoteUser = data.user;
              remoteToken = data.token;
            }
          } catch {
            // offline fallback below
          }

          if (!remoteUser) {
            if (cleanUser.length < 3) {
              return jsonResp({ error: 'Username must be at least 3 alphanumeric characters.' }, 400);
            }
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
              return jsonResp({ error: 'Please enter a valid email address.' }, 400);
            }
            if (cleanPass.length < 6) {
              return jsonResp({ error: 'Password must be at least 6 characters long.' }, 400);
            }
            const colors = ['#00E599', '#38BDF8', '#F5B731', '#EC4899', '#A855F7', '#F97316'];
            remoteUser = {
              id: `usr_${randHex(6)}`,
              username: cleanUser,
              email: cleanEmail,
              avatarColor: colors[Math.floor(Math.random() * colors.length)],
              balanceCents: 0,
              isBot: false,
              totalBets: 0,
              totalWins: 0,
              totalWageredCents: 0,
              totalWonCents: 0,
              netProfitCents: 0,
              winRate: 0,
              createdAt: Date.now(),
            };
            remoteToken = `local_${remoteUser.id}_${randHex(12)}`;
          }

          const salt = randHex(8);
          const passHash = await sha256Hex(`${salt}:${cleanPass}`);
          accounts.push({
            id: remoteUser.id,
            username: remoteUser.username,
            email: remoteUser.email || cleanEmail,
            salt,
            passHash,
            avatarColor: remoteUser.avatarColor,
            createdAt: remoteUser.createdAt,
          });
          saveLocalAccounts(accounts);
          const user = hydrateStandaloneUser(singleton!, remoteUser);
          localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify({ userId: user.id, token: remoteToken }));
          return jsonResp({ user, token: remoteToken }, 201);
        }

        if (url === '/api/auth/login') {
          const body = init?.body ? JSON.parse(String(init.body)) : {};
          const lookup = String(body.identifier || body.email || body.username || '')
            .trim()
            .toLowerCase();
          const pass = String(body.password || '');
          if (!lookup || !pass) {
            return jsonResp({ error: 'Please enter your email/username and password.' }, 400);
          }

          try {
            const res = await origFetch(input, init);
            const data = await res.json().catch(() => null);
            if (res.ok && data?.user) {
              const user = hydrateStandaloneUser(singleton!, data.user);
              localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify({ userId: user.id, token: data.token }));
              return jsonResp({ user, token: data.token }, 200);
            }
          } catch {
            // fallback to local verified accounts
          }

          // Verify against local salted SHA-256 mirror (survives Vercel cold starts)
          const accounts = loadLocalAccounts();
          const acc = accounts.find(
            (a) => a.email === lookup || a.username.toLowerCase() === lookup
          );
          if (!acc) {
            return jsonResp({ error: 'Invalid email/username or password.' }, 401);
          }
          const checkHash = await sha256Hex(`${acc.salt}:${pass}`);
          if (checkHash !== acc.passHash) {
            return jsonResp({ error: 'Invalid email/username or password.' }, 401);
          }

          const baseUser: UserProfile = {
            id: acc.id,
            username: acc.username,
            email: acc.email,
            avatarColor: acc.avatarColor,
            balanceCents: 0,
            isBot: false,
            totalBets: 0,
            totalWins: 0,
            totalWageredCents: 0,
            totalWonCents: 0,
            netProfitCents: 0,
            winRate: 0,
            createdAt: acc.createdAt,
          };
          const user = hydrateStandaloneUser(singleton!, baseUser);
          const token = `local_${user.id}_${randHex(12)}`;
          localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify({ userId: user.id, token }));
          return jsonResp({ user, token }, 200);
        }

        if (url === '/api/auth/me') {
          try {
            const res = await origFetch(input, init);
            const data = await res.json().catch(() => null);
            if (res.ok && data?.user) {
              const user = hydrateStandaloneUser(singleton!, data.user);
              return jsonResp({ user }, 200);
            }
          } catch {
            // check local session mirror below
          }

          try {
            const sessRaw = localStorage.getItem(LOCAL_SESSION_KEY);
            if (sessRaw) {
              const sess = JSON.parse(sessRaw);
              const acc = loadLocalAccounts().find((a) => a.id === sess.userId);
              if (acc) {
                const user = hydrateStandaloneUser(singleton!, {
                  id: acc.id,
                  username: acc.username,
                  email: acc.email,
                  avatarColor: acc.avatarColor,
                  balanceCents: 0,
                  isBot: false,
                  totalBets: 0,
                  totalWins: 0,
                  totalWageredCents: 0,
                  totalWonCents: 0,
                  netProfitCents: 0,
                  winRate: 0,
                  createdAt: acc.createdAt,
                });
                return jsonResp({ user }, 200);
              }
            }
          } catch {
            // ignore
          }
          return jsonResp({ error: 'Not authenticated' }, 401);
        }

        if (url === '/api/auth/logout') {
          localStorage.removeItem(LOCAL_SESSION_KEY);
          try {
            await origFetch(input, init);
          } catch {
            // ignore
          }
          return jsonResp({ ok: true }, 200);
        }
      }

      // Let LIVE payment gateway routes hit real Vercel Serverless Functions (/api/payments/*)
      // while keeping local user wallet & history synced cleanly!
      if (url.startsWith('/api/payments/')) {
        if (url === '/api/payments/deposit/confirm') {
          return singleton!.handleApi(url, init);
        }
        try {
          const res = await origFetch(input, init);
          const contentType = res.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            const clone = res.clone();
            const data = await clone.json().catch(() => null);
            if (res.ok && data) {
              if (url === '/api/payments/deposit' && data.transaction) {
                singleton!.payments.unshift(data.transaction);
              } else if (url.startsWith('/api/payments/deposit/') && data.transaction) {
                const existing = singleton!.payments.find((p) => p.id === data.transaction.id);
                if (existing) {
                  const wasPending = existing.status !== 'COMPLETED';
                  const alreadyCredited = isDepositAlreadyCredited(existing) || isDepositAlreadyCredited(data.transaction);
                  Object.assign(existing, data.transaction, {
                    userId: existing.userId,
                    netCents: data.transaction.netCents || existing.netCents,
                    amountCents: data.transaction.amountCents || existing.amountCents,
                  });
                  if (wasPending && !alreadyCredited && data.transaction.status === 'COMPLETED') {
                    // Mark credited synchronously BEFORE mutating balance to guarantee strict single-credit idempotency
                    markDepositCredited(existing);
                    const u = singleton!.users.get(existing.userId);
                    if (u) {
                      // Re-sync latest persisted balance in case another tab updated it
                      try {
                        const savedRaw = localStorage.getItem(`pulse_user_${u.id}`);
                        if (savedRaw) {
                          const savedUser = JSON.parse(savedRaw);
                          if (typeof savedUser.balanceCents === 'number') {
                            u.balanceCents = savedUser.balanceCents;
                          }
                        }
                      } catch {
                        // ignore
                      }
                      u.balanceCents += existing.netCents;
                      singleton!._saveUser(u);
                      singleton!.emit('user:updated', { ...u });
                      return new Response(
                        JSON.stringify({ transaction: existing, user: { ...u }, credited: true }),
                        { status: 200, headers: { 'Content-Type': 'application/json' } }
                      );
                    }
                  }
                  return new Response(
                    JSON.stringify({ transaction: existing, alreadyCredited: true }),
                    { status: 200, headers: { 'Content-Type': 'application/json' } }
                  );
                }
              } else if (url === '/api/payments/withdraw' && data.transaction) {
                const body = init?.body ? JSON.parse(String(init.body)) : {};
                const u = singleton!.users.get(body.userId);
                if (u) {
                  u.balanceCents = Math.max(0, u.balanceCents - data.transaction.amountCents);
                  singleton!._saveUser(u);
                  singleton!.payments.unshift(data.transaction);
                  singleton!.emit('user:updated', { ...u });
                  return new Response(
                    JSON.stringify({ ...data, user: { ...u } }),
                    { status: 200, headers: { 'Content-Type': 'application/json' } }
                  );
                }
              } else if (url.startsWith('/api/payments/history/')) {
                const remoteTx = Array.isArray(data.transactions) ? data.transactions : [];
                const merged = [...singleton!.payments];
                for (const r of remoteTx) {
                  if (!merged.some((m) => m.id === r.id)) merged.push(r);
                }
                return new Response(JSON.stringify({ transactions: merged }), {
                  status: 200,
                  headers: { 'Content-Type': 'application/json' },
                });
              }
            }
            return res;
          }
        } catch {
          // Fall through to local handler if offline
        }
        return singleton!.handleApi(url, init);
      }

      if (url.startsWith('/api/')) {
        return singleton!.handleApi(url, init);
      }
      return origFetch(input, init);
    };
  }
  return singleton;
}
