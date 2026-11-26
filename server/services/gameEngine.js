const EventEmitter = require('events');
const crypto = require('crypto');
const {
  MARKETS,
  TIMEFRAMES,
  STAKE_TIERS,
  MASTER_FEE_RATE,
  MARKET_BY_SYMBOL,
  TIMEFRAME_BY_ID,
  TIER_BY_CENTS,
} = require('../config');

const ROUND_EPOCH_ANCHOR = Date.UTC(2026, 10, 24, 0, 0, 0);

function roomKey(symbol, timeframe, tierCents) {
  return `${symbol}|${timeframe}|${tierCents}`;
}

function parseRoomKey(key) {
  const [symbol, timeframe, tierStr] = key.split('|');
  return { symbol, timeframe, tierCents: Number(tierStr) };
}

function computeRoundNumber(lockTime, durationMs) {
  const offset = Math.floor((lockTime - ROUND_EPOCH_ANCHOR) / durationMs);
  return Math.max(1, offset + 1000);
}

/**
 * Pure settlement calculator ensuring:
 * 1. Exact 10% subtracted from total prize pool -> Master Wallet
 * 2. Remaining 90% distributed EQUALLY among all winning players
 * 3. Integer cent accounting (zero floating-point drift; remainder dust accounted to Master Wallet)
 * 4. Fair 100% refund on exact tie (DRAW) or zero winners (NO_WINNERS)
 */
function calculateSettlement({
  players,
  lockPrice,
  closePrice,
  feeRate = MASTER_FEE_RATE,
}) {
  const playerCount = players.length;
  const upCount = players.filter((p) => p.direction === 'UP').length;
  const downCount = players.filter((p) => p.direction === 'DOWN').length;
  const totalPoolCents = players.reduce((sum, p) => sum + p.stakeCents, 0);

  if (playerCount === 0) {
    return {
      outcome: 'EMPTY',
      playerCount: 0,
      upCount: 0,
      downCount: 0,
      totalPoolCents: 0,
      masterFeeCents: 0,
      dustCents: 0,
      distributablePoolCents: 0,
      winnerCount: 0,
      payoutPerWinnerCents: 0,
      players: [],
      winners: [],
    };
  }

  let winningDirection = null;
  if (closePrice > lockPrice) {
    winningDirection = 'UP';
  } else if (closePrice < lockPrice) {
    winningDirection = 'DOWN';
  }

  if (!winningDirection) {
    const settledPlayers = players.map((p) => ({
      ...p,
      status: 'REFUNDED',
      payoutCents: p.stakeCents,
    }));
    return {
      outcome: 'DRAW',
      playerCount,
      upCount,
      downCount,
      totalPoolCents,
      masterFeeCents: 0,
      dustCents: 0,
      distributablePoolCents: 0,
      winnerCount: 0,
      payoutPerWinnerCents: 0,
      players: settledPlayers,
      winners: [],
    };
  }

  const winningSidePlayers = players.filter(
    (p) => p.direction === winningDirection
  );

  if (winningSidePlayers.length === 0) {
    const settledPlayers = players.map((p) => ({
      ...p,
      status: 'REFUNDED',
      payoutCents: p.stakeCents,
    }));
    return {
      outcome: 'NO_WINNERS',
      playerCount,
      upCount,
      downCount,
      totalPoolCents,
      masterFeeCents: 0,
      dustCents: 0,
      distributablePoolCents: 0,
      winnerCount: 0,
      payoutPerWinnerCents: 0,
      players: settledPlayers,
      winners: [],
    };
  }

  const masterFeeCents = Math.round(totalPoolCents * feeRate);
  const distributablePoolCents = totalPoolCents - masterFeeCents;
  const winnerCount = winningSidePlayers.length;
  const payoutPerWinnerCents = Math.floor(distributablePoolCents / winnerCount);
  const totalDistributedExact = payoutPerWinnerCents * winnerCount;
  const dustCents = distributablePoolCents - totalDistributedExact;

  const settledPlayers = players.map((p) => {
    const isWinner = p.direction === winningDirection;
    return {
      ...p,
      status: isWinner ? 'WON' : 'LOST',
      payoutCents: isWinner ? payoutPerWinnerCents : 0,
    };
  });

  return {
    outcome: winningDirection,
    playerCount,
    upCount,
    downCount,
    totalPoolCents,
    masterFeeCents,
    dustCents,
    distributablePoolCents,
    winnerCount,
    payoutPerWinnerCents,
    players: settledPlayers,
    winners: settledPlayers.filter((p) => p.status === 'WON'),
  };
}

class GameEngine extends EventEmitter {
  constructor({ db, priceFeed, botsEnabled = true, seedInitialHistory = true }) {
    super();
    this.db = db;
    this.priceFeed = priceFeed;
    this.botsEnabled = botsEnabled;
    this.bots = db.ensureBots();
    this.rooms = new Map();
    this.watchedRoomCounts = new Map();
    this.tickTimer = null;
    this.botTimer = null;

    this._initRooms();
    if (seedInitialHistory) {
      this._seedInitialHistoryIfEmpty();
    }
    if (this.botsEnabled) {
      this._seedInitialLiveBots();
    }
  }

  _initRooms() {
    const now = Date.now();
    for (const market of MARKETS) {
      const currentPrice = this.priceFeed.getPrice(market.symbol) || market.basePrice;
      for (const tf of TIMEFRAMES) {
        const lockTime = Math.floor(now / tf.durationMs) * tf.durationMs;
        const closeTime = lockTime + tf.durationMs;
        const nextLockTime = closeTime;
        const nextCloseTime = nextLockTime + tf.durationMs;

        for (const tier of STAKE_TIERS) {
          const key = roomKey(market.symbol, tf.id, tier.amountCents);
          const recent = this.db.getRecentRounds({
            symbol: market.symbol,
            timeframe: tf.id,
            tierCents: tier.amountCents,
            limit: 1,
          });

          this.rooms.set(key, {
            key,
            symbol: market.symbol,
            category: market.category,
            timeframe: tf.id,
            durationMs: tf.durationMs,
            entryCutoffMs: tf.entryCutoffMs,
            tierCents: tier.amountCents,
            cutoffNotifiedRoundId: null,
            liveRound: this._createRound({
              symbol: market.symbol,
              timeframe: tf.id,
              durationMs: tf.durationMs,
              entryCutoffMs: tf.entryCutoffMs,
              tierCents: tier.amountCents,
              status: 'LIVE',
              lockTime,
              closeTime,
              lockPrice: currentPrice,
            }),
            openRound: this._createRound({
              symbol: market.symbol,
              timeframe: tf.id,
              durationMs: tf.durationMs,
              entryCutoffMs: tf.entryCutoffMs,
              tierCents: tier.amountCents,
              status: 'OPEN',
              lockTime: nextLockTime,
              closeTime: nextCloseTime,
              lockPrice: null,
            }),
            lastSettled: recent[0] || null,
          });
        }
      }
    }
  }

  _createRound({
    symbol,
    timeframe,
    durationMs,
    entryCutoffMs,
    tierCents,
    status,
    lockTime,
    closeTime,
    lockPrice,
  }) {
    const roundNumber = computeRoundNumber(lockTime, durationMs);
    const roundId = `${symbol}_${timeframe}_${tierCents}_${lockTime}`;
    const cutoff = entryCutoffMs ?? TIMEFRAME_BY_ID[timeframe]?.entryCutoffMs ?? 15_000;
    return {
      roundId,
      roundNumber,
      symbol,
      timeframe,
      tierCents,
      status,
      lockTime,
      entryCloseTime: lockTime - cutoff,
      entryCutoffMs: cutoff,
      closeTime,
      lockPrice,
      players: [],
    };
  }

  _seedInitialHistoryIfEmpty() {
    const existing = this.db.getRecentRounds({ limit: 1 });
    if (existing.length > 0) return;

    const now = Date.now();
    const seedSpecs = [
      { symbol: 'BTC/USDT', timeframe: '1m', tierCents: 1000, deltaPct: 0.0014, playerCount: 9 },
      { symbol: 'XAU/USD', timeframe: '1m', tierCents: 5000, deltaPct: -0.0009, playerCount: 8 },
      { symbol: 'ETH/USDT', timeframe: '1m', tierCents: 1000, deltaPct: 0.0018, playerCount: 7 },
    ];

    for (let idx = 0; idx < seedSpecs.length; idx++) {
      const spec = seedSpecs[idx];
      const market = MARKET_BY_SYMBOL[spec.symbol];
      const tf = TIMEFRAME_BY_ID[spec.timeframe];
      const lockTime =
        Math.floor(now / tf.durationMs) * tf.durationMs - (idx + 1) * tf.durationMs;
      const closeTime = lockTime + tf.durationMs;
      const roundNumber = computeRoundNumber(lockTime, tf.durationMs);
      const roundId = `${spec.symbol}_${spec.timeframe}_${spec.tierCents}_${lockTime}`;
      const base = this.priceFeed.getPrice(spec.symbol) || market.basePrice;
      const lockPrice = Number(base.toFixed(market.decimals));
      const closePrice = Number((base * (1 + spec.deltaPct)).toFixed(market.decimals));

      const shuffled = [...this.bots].sort(() => Math.random() - 0.5).slice(0, spec.playerCount);
      const players = [];
      for (let i = 0; i < shuffled.length; i++) {
        const bot = shuffled[i];
        const direction = i % 2 === 0 ? 'UP' : 'DOWN';
        const betId = `bet_${crypto.randomBytes(6).toString('hex')}`;
        const { bet } = this.db.debitStakeAndCreateBet({
          betId,
          roundId,
          roundNumber,
          symbol: spec.symbol,
          timeframe: spec.timeframe,
          tierCents: spec.tierCents,
          userId: bot.id,
          direction,
          createdAt: lockTime - tf.entryCutoffMs - (spec.playerCount - i) * 3000,
        });
        players.push({
          betId: bet.id,
          userId: bet.userId,
          username: bet.username,
          avatarColor: bet.avatarColor,
          isBot: true,
          direction,
          stakeCents: spec.tierCents,
          createdAt: bet.createdAt,
        });
      }

      const calc = calculateSettlement({
        players,
        lockPrice,
        closePrice,
        feeRate: MASTER_FEE_RATE,
      });

      const txRef = `MW-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
      const settlement = {
        roundId,
        roundNumber,
        symbol: spec.symbol,
        category: market.category,
        timeframe: spec.timeframe,
        tierCents: spec.tierCents,
        lockTime,
        closeTime,
        lockPrice,
        closePrice,
        ...calc,
        txRef,
        settledAt: closeTime,
      };

      this.db.recordRoundSettlement(settlement);

      const key = roomKey(spec.symbol, spec.timeframe, spec.tierCents);
      const room = this.rooms.get(key);
      if (room) {
        room.lastSettled = settlement;
      }
    }
  }

  _seedInitialLiveBots() {
    for (const market of MARKETS) {
      const r1m10 = this.rooms.get(roomKey(market.symbol, '1m', 1000));
      this._populateRoomWithBots(r1m10, 'live', 6 + Math.floor(Math.random() * 5));
      this._populateRoomWithBots(r1m10, 'open', 4 + Math.floor(Math.random() * 3), true);

      if (['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'XAU/USD', 'WTI/USD'].includes(market.symbol)) {
        const r1m50 = this.rooms.get(roomKey(market.symbol, '1m', 5000));
        this._populateRoomWithBots(r1m50, 'live', 5 + Math.floor(Math.random() * 4));
        this._populateRoomWithBots(r1m50, 'open', 3 + Math.floor(Math.random() * 3), true);
      }

      if (['BTC/USDT', 'XAU/USD'].includes(market.symbol)) {
        for (const tf of TIMEFRAMES) {
          if (tf.id === '1m') continue;
          const room = this.rooms.get(roomKey(market.symbol, tf.id, 1000));
          this._populateRoomWithBots(room, 'live', 4 + Math.floor(Math.random() * 5));
          this._populateRoomWithBots(room, 'open', 2 + Math.floor(Math.random() * 2), true);
        }
      }
    }
  }

  _populateRoomWithBots(room, target, targetCount, ignoreCutoffOnBoot = false) {
    if (!room || !this.botsEnabled) return;
    const round = target === 'live' ? room.liveRound : room.openRound;

    if (
      target === 'open' &&
      !ignoreCutoffOnBoot &&
      Date.now() >= round.entryCloseTime
    ) {
      return;
    }

    const existingIds = new Set(round.players.map((p) => p.userId));
    const available = this.bots
      .filter((b) => !existingIds.has(b.id))
      .sort(() => Math.random() - 0.5);

    const needed = Math.max(0, targetCount - round.players.length);
    for (let i = 0; i < Math.min(needed, available.length); i++) {
      const bot = available[i];
      const upCount = round.players.filter((p) => p.direction === 'UP').length;
      const downCount = round.players.filter((p) => p.direction === 'DOWN').length;

      let direction;
      if (upCount === 0) direction = 'UP';
      else if (downCount === 0) direction = 'DOWN';
      else if (upCount - downCount >= 3) direction = 'DOWN';
      else if (downCount - upCount >= 3) direction = 'UP';
      else direction = Math.random() < 0.5 ? 'UP' : 'DOWN';

      try {
        this._addPlayerToRound(room, round, bot.id, direction);
      } catch {
        // ignore bot bet errors
      }
    }
  }

  _addPlayerToRound(room, round, userId, direction) {
    const betId = `bet_${crypto.randomBytes(6).toString('hex')}`;
    const now = Date.now();
    const { user, bet } = this.db.debitStakeAndCreateBet({
      betId,
      roundId: round.roundId,
      roundNumber: round.roundNumber,
      symbol: room.symbol,
      timeframe: room.timeframe,
      tierCents: room.tierCents,
      userId,
      direction,
      createdAt: now,
    });

    const playerEntry = {
      betId: bet.id,
      userId: bet.userId,
      username: bet.username,
      avatarColor: bet.avatarColor,
      isBot: bet.isBot,
      direction: bet.direction,
      stakeCents: bet.stakeCents,
      createdAt: bet.createdAt,
    };
    round.players.push(playerEntry);
    return { user, playerEntry };
  }

  start() {
    this.tickTimer = setInterval(() => {
      this._tickRounds();
    }, 500);

    this.botTimer = setInterval(() => {
      this._tickBots();
    }, 3000);
  }

  stop() {
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
    if (this.botTimer) {
      clearInterval(this.botTimer);
      this.botTimer = null;
    }
  }

  setBotsEnabled(enabled) {
    this.botsEnabled = Boolean(enabled);
    if (this.botsEnabled) {
      for (const [key, count] of this.watchedRoomCounts.entries()) {
        if (count > 0) {
          const room = this.rooms.get(key);
          if (room && room.openRound.players.length < 4 && Date.now() < room.openRound.entryCloseTime) {
            this._populateRoomWithBots(room, 'open', 5);
            this.emit('roomUpdate', this.getRoomSnapshot(room.symbol, room.timeframe, room.tierCents));
          }
        }
      }
    }
    this.emit('botsStatusChanged', this.botsEnabled);
    return this.botsEnabled;
  }

  trackRoomWatcher(symbol, timeframe, tierCents, delta) {
    const key = roomKey(symbol, timeframe, tierCents);
    const next = Math.max(0, (this.watchedRoomCounts.get(key) || 0) + delta);
    if (next === 0) {
      this.watchedRoomCounts.delete(key);
    } else {
      this.watchedRoomCounts.set(key, next);
      if (delta > 0 && this.botsEnabled) {
        const room = this.rooms.get(key);
        if (room) {
          if (room.liveRound.players.length < 4) {
            this._populateRoomWithBots(room, 'live', 6);
          }
          if (room.openRound.players.length < 2) {
            this._populateRoomWithBots(room, 'open', 3);
          }
        }
      }
    }
  }

  _tickBots() {
    if (!this.botsEnabled) return;

    const now = Date.now();
    const priorityKeys = new Set([
      roomKey('BTC/USDT', '1m', 1000),
      roomKey('ETH/USDT', '1m', 1000),
      roomKey('XAU/USD', '1m', 1000),
      roomKey('WTI/USD', '1m', 1000),
    ]);

    for (const [key, watchers] of this.watchedRoomCounts.entries()) {
      if (watchers > 0) priorityKeys.add(key);
    }

    for (const key of priorityKeys) {
      const room = this.rooms.get(key);
      if (!room) continue;
      if (now >= room.openRound.entryCloseTime) continue;

      const maxBots = 9 + (room.openRound.roundNumber % 4);
      if (room.openRound.players.length < maxBots && Math.random() < 0.72) {
        this._populateRoomWithBots(room, 'open', room.openRound.players.length + 1);
        this.emit('roomUpdate', this.getRoomSnapshot(room.symbol, room.timeframe, room.tierCents));
      }
    }
  }

  _tickRounds() {
    const now = Date.now();
    let anySettled = false;

    for (const room of this.rooms.values()) {
      if (
        now >= room.openRound.entryCloseTime &&
        now < room.liveRound.closeTime &&
        room.cutoffNotifiedRoundId !== room.openRound.roundId
      ) {
        room.cutoffNotifiedRoundId = room.openRound.roundId;
        if ((this.watchedRoomCounts.get(room.key) || 0) > 0) {
          this.emit('roomUpdate', this.getRoomSnapshot(room.symbol, room.timeframe, room.tierCents));
        }
      }

      if (now >= room.liveRound.closeTime) {
        this._rolloverRoom(room, now);
        anySettled = true;
      }
    }

    if (anySettled) {
      this.emit('globalStatsChanged');
    }
  }

  _rolloverRoom(room, now) {
    const closePrice = this.priceFeed.getPrice(room.symbol);
    const closingRound = room.liveRound;

    let settlement = null;
    let updatedUserBalances = new Map();

    if (closingRound.players.length > 0) {
      const calc = calculateSettlement({
        players: closingRound.players,
        lockPrice: closingRound.lockPrice,
        closePrice,
        feeRate: MASTER_FEE_RATE,
      });

      const txRef = `MW-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
      settlement = {
        roundId: closingRound.roundId,
        roundNumber: closingRound.roundNumber,
        symbol: room.symbol,
        category: room.category,
        timeframe: room.timeframe,
        tierCents: room.tierCents,
        lockTime: closingRound.lockTime,
        closeTime: closingRound.closeTime,
        lockPrice: closingRound.lockPrice,
        closePrice,
        ...calc,
        txRef,
        settledAt: now,
      };

      updatedUserBalances = this.db.recordRoundSettlement(settlement);
      room.lastSettled = settlement;
    }

    const nextLockTime = Math.floor(now / room.durationMs) * room.durationMs;
    const nextCloseTime = nextLockTime + room.durationMs;

    const promoted = room.openRound;
    promoted.status = 'LIVE';
    promoted.lockTime = nextLockTime;
    promoted.closeTime = nextCloseTime;
    promoted.lockPrice = closePrice;
    room.liveRound = promoted;

    room.openRound = this._createRound({
      symbol: room.symbol,
      timeframe: room.timeframe,
      durationMs: room.durationMs,
      entryCutoffMs: room.entryCutoffMs,
      tierCents: room.tierCents,
      status: 'OPEN',
      lockTime: nextCloseTime,
      closeTime: nextCloseTime + room.durationMs,
      lockPrice: null,
    });
    room.cutoffNotifiedRoundId = null;

    const isWatched = (this.watchedRoomCounts.get(room.key) || 0) > 0;
    const isFlagship =
      room.timeframe === '1m' &&
      room.tierCents === 1000 &&
      ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'XAU/USD', 'WTI/USD'].includes(room.symbol);

    if (this.botsEnabled && (isWatched || isFlagship)) {
      if (room.liveRound.players.length < 4) {
        this._populateRoomWithBots(room, 'live', 6);
      }
      if (room.openRound.players.length < 2) {
        this._populateRoomWithBots(room, 'open', 3);
      }
    }

    const snapshot = this.getRoomSnapshot(room.symbol, room.timeframe, room.tierCents);
    this.emit('roomUpdate', snapshot);

    if (settlement) {
      this.emit('roundSettled', {
        roomKey: room.key,
        settlement,
        updatedUserBalances: Object.fromEntries(updatedUserBalances),
      });
    }
  }

  placeBet({ userId, symbol, timeframe, tierCents, direction, nowMs }) {
    if (!MARKET_BY_SYMBOL[symbol]) {
      throw new Error(`Unsupported market pair: ${symbol}`);
    }
    if (!TIMEFRAME_BY_ID[timeframe]) {
      throw new Error(`Unsupported timeframe: ${timeframe}`);
    }
    const parsedTier = Number(tierCents);
    if (!TIER_BY_CENTS[parsedTier]) {
      throw new Error(`Unsupported stake tier: ${tierCents}`);
    }
    const cleanDir = String(direction || '').toUpperCase();
    if (cleanDir !== 'UP' && cleanDir !== 'DOWN') {
      throw new Error('Direction must be UP or DOWN');
    }

    const key = roomKey(symbol, timeframe, parsedTier);
    const room = this.rooms.get(key);
    if (!room) throw new Error('Prediction room not found');

    // HARD ANTI-SNIPE ENFORCEMENT: Reject bets once entry cutoff is reached!
    const now = nowMs != null ? nowMs : Date.now();
    if (now >= room.openRound.entryCloseTime) {
      const secsToNext = Math.max(1, Math.ceil((room.openRound.lockTime - now) / 1000));
      throw new Error(
        `Anti-Snipe Lock Active: Entries for Round #${room.openRound.roundNumber} closed ${Math.round(
          room.entryCutoffMs / 1000
        )}s before candle open. Next entry window opens in ${secsToNext}s.`
      );
    }

    const { user, playerEntry } = this._addPlayerToRound(
      room,
      room.openRound,
      userId,
      cleanDir
    );

    if (
      this.botsEnabled &&
      room.openRound.players.length < 4 &&
      now < room.openRound.entryCloseTime
    ) {
      this._populateRoomWithBots(room, 'open', 5);
    }

    const snapshot = this.getRoomSnapshot(symbol, timeframe, parsedTier);
    this.emit('roomUpdate', snapshot);
    this.emit('globalStatsChanged');

    return {
      user,
      bet: playerEntry,
      roundId: room.openRound.roundId,
      roundNumber: room.openRound.roundNumber,
      room: snapshot,
    };
  }

  _serializeRound(round, currentPrice, now = Date.now()) {
    const upCount = round.players.filter((p) => p.direction === 'UP').length;
    const downCount = round.players.filter((p) => p.direction === 'DOWN').length;
    const totalPoolCents = round.players.reduce((sum, p) => sum + p.stakeCents, 0);
    const masterFeeCents = Math.round(totalPoolCents * MASTER_FEE_RATE);
    const distributablePoolCents = totalPoolCents - masterFeeCents;
    const estUpPayoutCents =
      upCount > 0 ? Math.floor(distributablePoolCents / upCount) : 0;
    const estDownPayoutCents =
      downCount > 0 ? Math.floor(distributablePoolCents / downCount) : 0;

    let leadingSide = 'TIE';
    if (round.lockPrice != null && currentPrice != null) {
      if (currentPrice > round.lockPrice) leadingSide = 'UP';
      else if (currentPrice < round.lockPrice) leadingSide = 'DOWN';
    }

    const entriesOpen = round.status === 'OPEN' && now < round.entryCloseTime;
    const phase =
      round.status === 'LIVE'
        ? 'LIVE'
        : entriesOpen
        ? 'OPEN'
        : 'LOCKED_CUTOFF';

    return {
      roundId: round.roundId,
      roundNumber: round.roundNumber,
      symbol: round.symbol,
      timeframe: round.timeframe,
      tierCents: round.tierCents,
      status: round.status,
      phase,
      entriesOpen,
      entryCloseTime: round.entryCloseTime,
      entryCutoffMs: round.entryCutoffMs,
      lockTime: round.lockTime,
      closeTime: round.closeTime,
      lockPrice: round.lockPrice,
      leadingSide,
      playerCount: round.players.length,
      upCount,
      downCount,
      totalPoolCents,
      masterFeeCents,
      distributablePoolCents,
      estUpPayoutCents,
      estDownPayoutCents,
      players: round.players,
    };
  }

  getRoomSnapshot(symbol, timeframe, tierCents) {
    const key = roomKey(symbol, timeframe, Number(tierCents));
    const room = this.rooms.get(key);
    if (!room) return null;

    const now = Date.now();
    const currentPrice = this.priceFeed.getPrice(symbol);
    const recentRounds = this.db.getRecentRounds({
      symbol,
      timeframe,
      tierCents: Number(tierCents),
      limit: 12,
    });

    return {
      roomKey: key,
      symbol,
      category: room.category,
      timeframe,
      tierCents: Number(tierCents),
      serverTime: now,
      currentPrice,
      liveRound: this._serializeRound(room.liveRound, currentPrice, now),
      openRound: this._serializeRound(room.openRound, currentPrice, now),
      lastSettled: room.lastSettled || recentRounds[0] || null,
      recentRounds,
    };
  }

  getGlobalStats(onlineClients = 0) {
    let livePlayersTotal = 0;
    let openPlayersTotal = 0;
    let totalActivePoolCents = 0;
    const byMarket = {};
    const byMarketTimeframe = {};

    for (const m of MARKETS) {
      byMarket[m.symbol] = 0;
      byMarketTimeframe[m.symbol] = {};
      for (const tf of TIMEFRAMES) {
        byMarketTimeframe[m.symbol][tf.id] = 0;
      }
    }

    for (const room of this.rooms.values()) {
      const liveCount = room.liveRound.players.length;
      const openCount = room.openRound.players.length;
      livePlayersTotal += liveCount;
      openPlayersTotal += openCount;
      totalActivePoolCents += (liveCount + openCount) * room.tierCents;
      byMarket[room.symbol] = (byMarket[room.symbol] || 0) + liveCount + openCount;
      byMarketTimeframe[room.symbol][room.timeframe] =
        (byMarketTimeframe[room.symbol][room.timeframe] || 0) + liveCount + openCount;
    }

    return {
      onlineClients,
      livePlayersTotal,
      openPlayersTotal,
      totalPlayingNow: livePlayersTotal + openPlayersTotal,
      totalActivePoolCents,
      botsEnabled: this.botsEnabled,
      byMarket,
      byMarketTimeframe,
      serverTime: Date.now(),
    };
  }
}

module.exports = {
  GameEngine,
  calculateSettlement,
  roomKey,
  parseRoomKey,
};
