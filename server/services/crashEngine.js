const EventEmitter = require('events');
const crypto = require('crypto');
const {
  generateServerSeed,
  hashServerSeed,
  calculateCrashPoint,
} = require('./provablyFair');

const BETTING_DURATION_MS = 6500;
const CRASHED_COOLDOWN_MS = 3200;
const GROWTH_RATE = 0.000068; // Exponential curve: ~2.0x in 10.2s, ~5.0x in 23.6s, ~10.0x in 33.8s

function multiplierAtElapsed(elapsedMs) {
  return Math.max(1.0, Number(Math.exp(GROWTH_RATE * Math.max(0, elapsedMs)).toFixed(2)));
}

class CrashEngine extends EventEmitter {
  constructor({ db, botsEnabled = true }) {
    super();
    this.db = db;
    this.botsEnabled = botsEnabled;
    this.bots = db.ensureBots();
    this.roundNumber = 2400;
    this.history = [2.41, 1.18, 6.84, 1.04, 3.19, 14.52, 1.62, 2.08, 4.45, 1.33];
    this.phase = 'BETTING'; // 'BETTING' | 'FLYING' | 'CRASHED'
    this.phaseStartedAt = Date.now();
    this.phaseEndsAt = this.phaseStartedAt + BETTING_DURATION_MS;
    this.currentMultiplier = 1.0;
    this.crashPoint = 2.0;
    this.serverSeed = generateServerSeed();
    this.serverSeedHash = hashServerSeed(this.serverSeed);
    this.players = new Map(); // userId -> playerEntry
    this.tickTimer = null;

    this._prepareNewRound();
  }

  setBotsEnabled(enabled) {
    this.botsEnabled = Boolean(enabled);
  }

  _prepareNewRound() {
    this.roundNumber += 1;
    this.phase = 'BETTING';
    this.phaseStartedAt = Date.now();
    this.phaseEndsAt = this.phaseStartedAt + BETTING_DURATION_MS;
    this.currentMultiplier = 1.0;
    this.serverSeed = generateServerSeed();
    this.serverSeedHash = hashServerSeed(this.serverSeed);
    this.crashPoint = calculateCrashPoint(this.serverSeed, `crash:${this.roundNumber}`);
    this.players = new Map();

    if (this.botsEnabled) {
      this._seedBotBets();
    }
    this.emit('state', this.getSnapshot());
  }

  _seedBotBets() {
    const count = 5 + Math.floor(Math.random() * 6);
    const chosen = [...this.bots].sort(() => Math.random() - 0.5).slice(0, count);
    const stakes = [500, 1000, 2500, 5000, 10000];
    for (const bot of chosen) {
      const stakeCents = stakes[Math.floor(Math.random() * stakes.length)];
      const autoCashout = Number((1.25 + Math.random() * 3.8).toFixed(2));
      try {
        this.placeBet({ userId: bot.id, stakeCents, autoCashout, silentEmit: true });
      } catch {
        // ignore bot errors
      }
    }
  }

  start() {
    this.tickTimer = setInterval(() => this._tick(), 65);
  }

  stop() {
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
  }

  _tick() {
    const now = Date.now();

    if (this.phase === 'BETTING') {
      if (now >= this.phaseEndsAt) {
        this.phase = 'FLYING';
        this.phaseStartedAt = now;
        this.currentMultiplier = 1.0;

        // Handle instant 1.00x crash immediately
        if (this.crashPoint <= 1.0) {
          this._triggerCrash(now);
          return;
        }
        this.emit('state', this.getSnapshot());
      }
      return;
    }

    if (this.phase === 'FLYING') {
      const elapsed = now - this.phaseStartedAt;
      const mult = multiplierAtElapsed(elapsed);

      if (mult >= this.crashPoint) {
        this.currentMultiplier = this.crashPoint;
        // Process any auto-cashouts strictly <= crashPoint first (rare edge when exact match)
        this._processAutoCashouts(this.crashPoint - 0.01);
        this._triggerCrash(now);
        return;
      }

      this.currentMultiplier = mult;
      this._processAutoCashouts(mult);
      this.emit('tick', {
        roundNumber: this.roundNumber,
        phase: this.phase,
        multiplier: this.currentMultiplier,
        elapsedMs: elapsed,
        players: this._serializePlayers(),
      });
      return;
    }

    if (this.phase === 'CRASHED') {
      if (now >= this.phaseEndsAt) {
        this._prepareNewRound();
      }
    }
  }

  _processAutoCashouts(mult) {
    for (const entry of this.players.values()) {
      if (
        entry.status === 'ACTIVE' &&
        entry.autoCashout != null &&
        mult >= entry.autoCashout
      ) {
        this._executeCashout(entry, entry.autoCashout);
      }
    }
  }

  _executeCashout(entry, cashoutMult) {
    entry.status = 'CASHED_OUT';
    entry.cashoutMultiplier = Number(cashoutMult.toFixed(2));
    entry.payoutCents = Math.floor(entry.stakeCents * entry.cashoutMultiplier);

    const { user, record } = this.db.settleOriginalBet({
      userId: entry.userId,
      game: 'crash',
      stakeCents: entry.stakeCents,
      multiplier: entry.cashoutMultiplier,
      payoutCents: entry.payoutCents,
      status: 'WON',
      details: {
        roundNumber: this.roundNumber,
        cashoutMultiplier: entry.cashoutMultiplier,
        crashPoint: this.crashPoint,
      },
      serverSeedHash: this.serverSeedHash,
      clientSeed: `crash:${this.roundNumber}`,
      nonce: this.roundNumber,
      alreadyDebited: true,
    });

    if (!entry.isBot) {
      this.emit('userUpdated', user);
    }
    this.emit('betSettled', record);
    return { user, entry, record };
  }

  _triggerCrash(now) {
    this.phase = 'CRASHED';
    this.currentMultiplier = this.crashPoint;
    this.phaseStartedAt = now;
    this.phaseEndsAt = now + CRASHED_COOLDOWN_MS;
    this.history = [this.crashPoint, ...this.history].slice(0, 18);

    for (const entry of this.players.values()) {
      if (entry.status === 'ACTIVE') {
        entry.status = 'BUSTED';
        entry.payoutCents = 0;
        const { user, record } = this.db.settleOriginalBet({
          userId: entry.userId,
          game: 'crash',
          stakeCents: entry.stakeCents,
          multiplier: 0,
          payoutCents: 0,
          status: 'LOST',
          details: {
            roundNumber: this.roundNumber,
            crashPoint: this.crashPoint,
          },
          serverSeedHash: this.serverSeedHash,
          clientSeed: `crash:${this.roundNumber}`,
          nonce: this.roundNumber,
          alreadyDebited: true,
        });
        if (!entry.isBot) {
          this.emit('userUpdated', user);
        }
        this.emit('betSettled', record);
      }
    }

    this.emit('state', this.getSnapshot());
  }

  placeBet({ userId, stakeCents, autoCashout = null, silentEmit = false }) {
    if (this.phase !== 'BETTING') {
      throw new Error('Wait for the next Crash takeoff window to place a bet.');
    }
    if (this.players.has(userId)) {
      throw new Error('You already have an active bet in this Crash round.');
    }

    const parsedStake = Math.round(Number(stakeCents));
    const parsedAuto =
      autoCashout != null && Number(autoCashout) >= 1.01
        ? Number(Number(autoCashout).toFixed(2))
        : null;

    const user = this.db.debitUserStake(
      userId,
      parsedStake,
      `CRASH #${this.roundNumber} stake`
    );

    const entry = {
      betId: `cr_${crypto.randomBytes(5).toString('hex')}`,
      userId: user.id,
      username: user.username,
      avatarColor: user.avatarColor,
      isBot: user.isBot,
      stakeCents: parsedStake,
      autoCashout: parsedAuto,
      status: 'ACTIVE',
      cashoutMultiplier: null,
      payoutCents: 0,
    };

    this.players.set(userId, entry);
    if (!silentEmit) {
      this.emit('state', this.getSnapshot());
      if (!user.isBot) this.emit('userUpdated', user);
    }

    return { user, entry, state: this.getSnapshot() };
  }

  cashOut({ userId }) {
    if (this.phase !== 'FLYING') {
      throw new Error('Cash out is only available while the rocket is flying.');
    }
    const entry = this.players.get(userId);
    if (!entry) {
      throw new Error('You do not have an active bet in this Crash round.');
    }
    if (entry.status !== 'ACTIVE') {
      throw new Error('Position already settled.');
    }

    const result = this._executeCashout(entry, this.currentMultiplier);
    this.emit('state', this.getSnapshot());
    return { ...result, state: this.getSnapshot() };
  }

  _serializePlayers() {
    return Array.from(this.players.values()).sort((a, b) => b.stakeCents - a.stakeCents);
  }

  getSnapshot() {
    return {
      roundNumber: this.roundNumber,
      phase: this.phase,
      multiplier: this.currentMultiplier,
      phaseStartedAt: this.phaseStartedAt,
      phaseEndsAt: this.phaseEndsAt,
      serverTime: Date.now(),
      serverSeedHash: this.serverSeedHash,
      revealedServerSeed: this.phase === 'CRASHED' ? this.serverSeed : null,
      crashPoint: this.phase === 'CRASHED' ? this.crashPoint : null,
      history: this.history,
      players: this._serializePlayers(),
    };
  }
}

module.exports = { CrashEngine };
