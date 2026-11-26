const EventEmitter = require('events');
const crypto = require('crypto');
const {
  PUMP_CONFIGS,
  TOWER_CONFIGS,
  getPumpMultiplier,
  getPumpPopThreshold,
  getMinesMultiplier,
  generateMinePositions,
  generatePlinkoOutcome,
  generateDiceOutcome,
  generateLimboOutcome,
  generateKenoOutcome,
  getTowerMultiplier,
  generateTowerGrid,
  generateWheelOutcome,
  evaluateBlackjackHand,
  generateBlackjackShoe,
} = require('./provablyFair');

class OriginalsEngine extends EventEmitter {
  constructor({ db }) {
    super();
    this.db = db;
    // Active stateful sessions per userId (in-memory, server-authoritative)
    this.pumpSessions = new Map();
    this.minesSessions = new Map();
    this.towerSessions = new Map();
    this.blackjackSessions = new Map();
  }

  getFairnessInfo(userId) {
    const seed = this.db.getOrCreateUserSeed(userId);
    return {
      serverSeedHash: seed.serverSeedHash,
      clientSeed: seed.clientSeed,
      nonce: seed.nonce,
    };
  }

  rotateSeed(userId, nextClientSeed) {
    if (
      this.pumpSessions.has(userId) ||
      this.minesSessions.has(userId) ||
      this.towerSessions.has(userId) ||
      this.blackjackSessions.has(userId)
    ) {
      throw new Error('Finish or cash out your active game before rotating seeds.');
    }
    return this.db.rotateUserSeed(userId, nextClientSeed);
  }

  getActiveSessions(userId) {
    return {
      pump: this._serializePump(this.pumpSessions.get(userId)),
      mines: this._serializeMines(this.minesSessions.get(userId)),
      tower: this._serializeTower(this.towerSessions.get(userId)),
      blackjack: this._serializeBlackjack(this.blackjackSessions.get(userId)),
    };
  }

  // ==================== PUMP (Stake Balloon Pump) ====================
  _serializePump(s, reveal = false) {
    if (!s) return null;
    const cfg = PUMP_CONFIGS[s.difficulty];
    const maxSafePumps = cfg.totalPumps - cfg.popsCount;
    const currentMult = getPumpMultiplier(s.difficulty, s.pumps);
    const nextMult =
      s.pumps < maxSafePumps ? getPumpMultiplier(s.difficulty, s.pumps + 1) : currentMult;
    const remainingSlots = cfg.totalPumps - s.pumps;
    const nextPopChancePct =
      remainingSlots > 0
        ? Number(((cfg.popsCount / remainingSlots) * 100).toFixed(1))
        : 100;

    return {
      sessionId: s.sessionId,
      difficulty: s.difficulty,
      stakeCents: s.stakeCents,
      pumps: s.pumps,
      maxSafePumps,
      totalPumps: cfg.totalPumps,
      popsCount: cfg.popsCount,
      currentMultiplier: currentMult,
      nextMultiplier: nextMult,
      currentPayoutCents: Math.floor(s.stakeCents * currentMult),
      nextPopChancePct,
      status: s.status,
      popAtPump: reveal || s.status !== 'ACTIVE' ? s.popAtPump : null,
      serverSeedHash: s.serverSeedHash,
      clientSeed: s.clientSeed,
      nonce: s.nonce,
    };
  }

  startPump({ userId, stakeCents, difficulty = 'medium' }) {
    if (this.pumpSessions.has(userId)) {
      throw new Error('You already have an active Pump balloon — pump or cash out first.');
    }
    const cleanDiff = PUMP_CONFIGS[difficulty] ? difficulty : 'medium';
    const parsedStake = Math.round(Number(stakeCents));
    const user = this.db.debitUserStake(userId, parsedStake, `PUMP (${cleanDiff}) stake`);
    const seed = this.db.consumeUserNonce(userId);
    const popAtPump = getPumpPopThreshold(
      seed.serverSeed,
      seed.clientSeed,
      seed.nonce,
      cleanDiff
    );

    const session = {
      sessionId: `pump_${crypto.randomBytes(5).toString('hex')}`,
      userId,
      difficulty: cleanDiff,
      stakeCents: parsedStake,
      pumps: 0,
      popAtPump,
      status: 'ACTIVE',
      serverSeedHash: seed.serverSeedHash,
      clientSeed: seed.clientSeed,
      nonce: seed.nonce,
    };
    this.pumpSessions.set(userId, session);
    this.emit('userUpdated', user);
    return { user, session: this._serializePump(session) };
  }

  actionPump({ userId }) {
    const session = this.pumpSessions.get(userId);
    if (!session || session.status !== 'ACTIVE') {
      throw new Error('No active Pump session. Start a new balloon first.');
    }

    session.pumps += 1;
    const cfg = PUMP_CONFIGS[session.difficulty];
    const maxSafe = cfg.totalPumps - cfg.popsCount;

    if (session.pumps >= session.popAtPump) {
      // Balloon POPPED!
      session.status = 'POPPED';
      this.pumpSessions.delete(userId);
      const { user, record } = this.db.settleOriginalBet({
        userId,
        game: 'pump',
        stakeCents: session.stakeCents,
        multiplier: 0,
        payoutCents: 0,
        status: 'LOST',
        details: {
          difficulty: session.difficulty,
          pumps: session.pumps,
          popAtPump: session.popAtPump,
        },
        serverSeedHash: session.serverSeedHash,
        clientSeed: session.clientSeed,
        nonce: session.nonce,
        alreadyDebited: true,
      });
      this.emit('betSettled', record);
      this.emit('userUpdated', user);
      return { user, popped: true, session: this._serializePump(session, true), record };
    }

    // Auto-cashout if reached the absolute maximum safe pump!
    if (session.pumps >= maxSafe) {
      return this.cashoutPump({ userId });
    }

    return {
      popped: false,
      cashedOut: false,
      session: this._serializePump(session),
    };
  }

  cashoutPump({ userId }) {
    const session = this.pumpSessions.get(userId);
    if (!session || session.status !== 'ACTIVE') {
      throw new Error('No active Pump session to cash out.');
    }
    if (session.pumps < 1) {
      throw new Error('Pump at least once before cashing out.');
    }

    session.status = 'CASHED_OUT';
    this.pumpSessions.delete(userId);
    const mult = getPumpMultiplier(session.difficulty, session.pumps);
    const payoutCents = Math.floor(session.stakeCents * mult);

    const { user, record } = this.db.settleOriginalBet({
      userId,
      game: 'pump',
      stakeCents: session.stakeCents,
      multiplier: mult,
      payoutCents,
      status: 'WON',
      details: {
        difficulty: session.difficulty,
        pumps: session.pumps,
        popAtPump: session.popAtPump,
      },
      serverSeedHash: session.serverSeedHash,
      clientSeed: session.clientSeed,
      nonce: session.nonce,
      alreadyDebited: true,
    });
    this.emit('betSettled', record);
    this.emit('userUpdated', user);
    return { user, popped: false, cashedOut: true, session: this._serializePump(session, true), record };
  }

  // ==================== MINES (5x5 Grid) ====================
  _serializeMines(s, reveal = false) {
    if (!s) return null;
    const currentMult = getMinesMultiplier(s.mineCount, s.revealed.length);
    const safeLeft = 25 - s.mineCount - s.revealed.length;
    const nextMult =
      safeLeft > 0 ? getMinesMultiplier(s.mineCount, s.revealed.length + 1) : currentMult;

    return {
      sessionId: s.sessionId,
      stakeCents: s.stakeCents,
      mineCount: s.mineCount,
      revealed: s.revealed,
      mines: reveal || s.status !== 'ACTIVE' ? s.mines : null,
      hitMineTile: s.hitMineTile ?? null,
      currentMultiplier: currentMult,
      nextMultiplier: nextMult,
      currentPayoutCents: Math.floor(s.stakeCents * currentMult),
      status: s.status,
      serverSeedHash: s.serverSeedHash,
      clientSeed: s.clientSeed,
      nonce: s.nonce,
    };
  }

  startMines({ userId, stakeCents, mineCount = 3 }) {
    if (this.minesSessions.has(userId)) {
      throw new Error('Finish or cash out your active Mines game first.');
    }
    const cleanMines = Math.max(1, Math.min(24, Math.floor(Number(mineCount))));
    const parsedStake = Math.round(Number(stakeCents));
    const user = this.db.debitUserStake(userId, parsedStake, `MINES (${cleanMines} mines) stake`);
    const seed = this.db.consumeUserNonce(userId);
    const mines = generateMinePositions(seed.serverSeed, seed.clientSeed, seed.nonce, cleanMines);

    const session = {
      sessionId: `mines_${crypto.randomBytes(5).toString('hex')}`,
      userId,
      stakeCents: parsedStake,
      mineCount: cleanMines,
      mines,
      revealed: [],
      hitMineTile: null,
      status: 'ACTIVE',
      serverSeedHash: seed.serverSeedHash,
      clientSeed: seed.clientSeed,
      nonce: seed.nonce,
    };
    this.minesSessions.set(userId, session);
    this.emit('userUpdated', user);
    return { user, session: this._serializeMines(session) };
  }

  revealMineTile({ userId, tileIndex }) {
    const session = this.minesSessions.get(userId);
    if (!session || session.status !== 'ACTIVE') {
      throw new Error('No active Mines board. Place a bet first.');
    }
    const idx = Math.floor(Number(tileIndex));
    if (idx < 0 || idx > 24) throw new Error('Invalid tile index (0-24)');
    if (session.revealed.includes(idx)) throw new Error('Tile already revealed');

    if (session.mines.includes(idx)) {
      session.hitMineTile = idx;
      session.status = 'LOST';
      this.minesSessions.delete(userId);
      const { user, record } = this.db.settleOriginalBet({
        userId,
        game: 'mines',
        stakeCents: session.stakeCents,
        multiplier: 0,
        payoutCents: 0,
        status: 'LOST',
        details: {
          mineCount: session.mineCount,
          revealedCount: session.revealed.length,
          hitTile: idx,
        },
        serverSeedHash: session.serverSeedHash,
        clientSeed: session.clientSeed,
        nonce: session.nonce,
        alreadyDebited: true,
      });
      this.emit('betSettled', record);
      this.emit('userUpdated', user);
      return { user, hitMine: true, session: this._serializeMines(session, true), record };
    }

    session.revealed.push(idx);
    const maxSafe = 25 - session.mineCount;
    if (session.revealed.length >= maxSafe) {
      return this.cashoutMines({ userId });
    }

    return { hitMine: false, cashedOut: false, session: this._serializeMines(session) };
  }

  cashoutMines({ userId }) {
    const session = this.minesSessions.get(userId);
    if (!session || session.status !== 'ACTIVE') {
      throw new Error('No active Mines session to cash out.');
    }
    if (session.revealed.length < 1) {
      throw new Error('Reveal at least 1 safe gem before cashing out.');
    }

    session.status = 'CASHED_OUT';
    this.minesSessions.delete(userId);
    const mult = getMinesMultiplier(session.mineCount, session.revealed.length);
    const payoutCents = Math.floor(session.stakeCents * mult);

    const { user, record } = this.db.settleOriginalBet({
      userId,
      game: 'mines',
      stakeCents: session.stakeCents,
      multiplier: mult,
      payoutCents,
      status: 'WON',
      details: {
        mineCount: session.mineCount,
        revealedCount: session.revealed.length,
      },
      serverSeedHash: session.serverSeedHash,
      clientSeed: session.clientSeed,
      nonce: session.nonce,
      alreadyDebited: true,
    });
    this.emit('betSettled', record);
    this.emit('userUpdated', user);
    return { user, hitMine: false, cashedOut: true, session: this._serializeMines(session, true), record };
  }

  // ==================== DRAGON TOWER (9 Floors) ====================
  _serializeTower(s, reveal = false) {
    if (!s) return null;
    const cfg = TOWER_CONFIGS[s.difficulty];
    const currentMult = getTowerMultiplier(s.difficulty, s.currentFloor);
    const nextMult =
      s.currentFloor < cfg.rows
        ? getTowerMultiplier(s.difficulty, s.currentFloor + 1)
        : currentMult;

    return {
      sessionId: s.sessionId,
      difficulty: s.difficulty,
      cols: cfg.cols,
      bombsPerRow: cfg.bombs,
      rows: cfg.rows,
      stakeCents: s.stakeCents,
      currentFloor: s.currentFloor,
      picks: s.picks,
      hitBomb: s.hitBomb || null,
      gridBombs: reveal || s.status !== 'ACTIVE' ? s.gridBombs : null,
      currentMultiplier: currentMult,
      nextMultiplier: nextMult,
      currentPayoutCents: Math.floor(s.stakeCents * currentMult),
      status: s.status,
      serverSeedHash: s.serverSeedHash,
      clientSeed: s.clientSeed,
      nonce: s.nonce,
    };
  }

  startTower({ userId, stakeCents, difficulty = 'medium' }) {
    if (this.towerSessions.has(userId)) {
      throw new Error('Finish or cash out your active Dragon Tower climb first.');
    }
    const cleanDiff = TOWER_CONFIGS[difficulty] ? difficulty : 'medium';
    const parsedStake = Math.round(Number(stakeCents));
    const user = this.db.debitUserStake(userId, parsedStake, `TOWER (${cleanDiff}) stake`);
    const seed = this.db.consumeUserNonce(userId);
    const gridBombs = generateTowerGrid(seed.serverSeed, seed.clientSeed, seed.nonce, cleanDiff);

    const session = {
      sessionId: `tower_${crypto.randomBytes(5).toString('hex')}`,
      userId,
      difficulty: cleanDiff,
      stakeCents: parsedStake,
      currentFloor: 0,
      picks: [],
      hitBomb: null,
      gridBombs,
      status: 'ACTIVE',
      serverSeedHash: seed.serverSeedHash,
      clientSeed: seed.clientSeed,
      nonce: seed.nonce,
    };
    this.towerSessions.set(userId, session);
    this.emit('userUpdated', user);
    return { user, session: this._serializeTower(session) };
  }

  pickTowerTile({ userId, colIndex }) {
    const session = this.towerSessions.get(userId);
    if (!session || session.status !== 'ACTIVE') {
      throw new Error('No active Dragon Tower climb. Start a game first.');
    }
    const cfg = TOWER_CONFIGS[session.difficulty];
    const col = Math.floor(Number(colIndex));
    if (col < 0 || col >= cfg.cols) throw new Error('Invalid column selected');

    const floorBombs = session.gridBombs[session.currentFloor];
    if (floorBombs.includes(col)) {
      session.hitBomb = { floor: session.currentFloor, col };
      session.status = 'LOST';
      this.towerSessions.delete(userId);
      const { user, record } = this.db.settleOriginalBet({
        userId,
        game: 'tower',
        stakeCents: session.stakeCents,
        multiplier: 0,
        payoutCents: 0,
        status: 'LOST',
        details: { difficulty: session.difficulty, floorReached: session.currentFloor },
        serverSeedHash: session.serverSeedHash,
        clientSeed: session.clientSeed,
        nonce: session.nonce,
        alreadyDebited: true,
      });
      this.emit('betSettled', record);
      this.emit('userUpdated', user);
      return { user, hitBomb: true, session: this._serializeTower(session, true), record };
    }

    session.picks.push(col);
    session.currentFloor += 1;

    if (session.currentFloor >= cfg.rows) {
      return this.cashoutTower({ userId });
    }

    return { hitBomb: false, cashedOut: false, session: this._serializeTower(session) };
  }

  cashoutTower({ userId }) {
    const session = this.towerSessions.get(userId);
    if (!session || session.status !== 'ACTIVE') {
      throw new Error('No active Dragon Tower climb to cash out.');
    }
    if (session.currentFloor < 1) {
      throw new Error('Clear at least Floor 1 before cashing out.');
    }

    session.status = 'CASHED_OUT';
    this.towerSessions.delete(userId);
    const mult = getTowerMultiplier(session.difficulty, session.currentFloor);
    const payoutCents = Math.floor(session.stakeCents * mult);

    const { user, record } = this.db.settleOriginalBet({
      userId,
      game: 'tower',
      stakeCents: session.stakeCents,
      multiplier: mult,
      payoutCents,
      status: 'WON',
      details: { difficulty: session.difficulty, floorCleared: session.currentFloor },
      serverSeedHash: session.serverSeedHash,
      clientSeed: session.clientSeed,
      nonce: session.nonce,
      alreadyDebited: true,
    });
    this.emit('betSettled', record);
    this.emit('userUpdated', user);
    return { user, hitBomb: false, cashedOut: true, session: this._serializeTower(session, true), record };
  }

  // ==================== INSTANT PROVABLY-FAIR ORIGINALS ====================
  playPlinko({ userId, stakeCents, rows = 12, risk = 'medium' }) {
    const parsedStake = Math.round(Number(stakeCents));
    if (parsedStake < 100) throw new Error('Minimum bet is $1.00');
    const seed = this.db.consumeUserNonce(userId);
    const outcome = generatePlinkoOutcome(seed.serverSeed, seed.clientSeed, seed.nonce, rows, risk);
    const payoutCents = Math.floor(parsedStake * outcome.multiplier);
    const status = payoutCents >= parsedStake ? 'WON' : 'LOST';

    const { user, record } = this.db.settleOriginalBet({
      userId,
      game: 'plinko',
      stakeCents: parsedStake,
      multiplier: outcome.multiplier,
      payoutCents,
      status,
      details: outcome,
      serverSeedHash: seed.serverSeedHash,
      clientSeed: seed.clientSeed,
      nonce: seed.nonce,
      alreadyDebited: false,
    });

    this.emit('betSettled', record);
    this.emit('userUpdated', user);
    return { user, outcome, record };
  }

  playDice({ userId, stakeCents, target = 50, condition = 'over' }) {
    const parsedStake = Math.round(Number(stakeCents));
    if (parsedStake < 100) throw new Error('Minimum bet is $1.00');
    const seed = this.db.consumeUserNonce(userId);
    const outcome = generateDiceOutcome(seed.serverSeed, seed.clientSeed, seed.nonce, target, condition);
    const payoutCents = outcome.won ? Math.floor(parsedStake * outcome.multiplier) : 0;

    const { user, record } = this.db.settleOriginalBet({
      userId,
      game: 'dice',
      stakeCents: parsedStake,
      multiplier: outcome.won ? outcome.multiplier : 0,
      payoutCents,
      status: outcome.won ? 'WON' : 'LOST',
      details: outcome,
      serverSeedHash: seed.serverSeedHash,
      clientSeed: seed.clientSeed,
      nonce: seed.nonce,
      alreadyDebited: false,
    });

    this.emit('betSettled', record);
    this.emit('userUpdated', user);
    return { user, outcome, record };
  }

  playLimbo({ userId, stakeCents, targetMultiplier = 2.0 }) {
    const parsedStake = Math.round(Number(stakeCents));
    if (parsedStake < 100) throw new Error('Minimum bet is $1.00');
    const seed = this.db.consumeUserNonce(userId);
    const outcome = generateLimboOutcome(
      seed.serverSeed,
      seed.clientSeed,
      seed.nonce,
      targetMultiplier
    );
    const payoutCents = outcome.won ? Math.floor(parsedStake * outcome.targetMultiplier) : 0;

    const { user, record } = this.db.settleOriginalBet({
      userId,
      game: 'limbo',
      stakeCents: parsedStake,
      multiplier: outcome.won ? outcome.targetMultiplier : 0,
      payoutCents,
      status: outcome.won ? 'WON' : 'LOST',
      details: outcome,
      serverSeedHash: seed.serverSeedHash,
      clientSeed: seed.clientSeed,
      nonce: seed.nonce,
      alreadyDebited: false,
    });

    this.emit('betSettled', record);
    this.emit('userUpdated', user);
    return { user, outcome, record };
  }

  playKeno({ userId, stakeCents, picks, risk = 'medium' }) {
    const parsedStake = Math.round(Number(stakeCents));
    if (parsedStake < 100) throw new Error('Minimum bet is $1.00');
    const seed = this.db.consumeUserNonce(userId);
    const outcome = generateKenoOutcome(seed.serverSeed, seed.clientSeed, seed.nonce, picks, risk);
    const payoutCents = Math.floor(parsedStake * outcome.multiplier);

    const { user, record } = this.db.settleOriginalBet({
      userId,
      game: 'keno',
      stakeCents: parsedStake,
      multiplier: outcome.multiplier,
      payoutCents,
      status: payoutCents >= parsedStake ? 'WON' : 'LOST',
      details: outcome,
      serverSeedHash: seed.serverSeedHash,
      clientSeed: seed.clientSeed,
      nonce: seed.nonce,
      alreadyDebited: false,
    });

    this.emit('betSettled', record);
    this.emit('userUpdated', user);
    return { user, outcome, record };
  }

  playWheel({ userId, stakeCents, segments = 20, risk = 'medium' }) {
    const parsedStake = Math.round(Number(stakeCents));
    if (parsedStake < 100) throw new Error('Minimum bet is $1.00');
    const seed = this.db.consumeUserNonce(userId);
    const outcome = generateWheelOutcome(
      seed.serverSeed,
      seed.clientSeed,
      seed.nonce,
      segments,
      risk
    );
    const payoutCents = Math.floor(parsedStake * outcome.multiplier);

    const { user, record } = this.db.settleOriginalBet({
      userId,
      game: 'wheel',
      stakeCents: parsedStake,
      multiplier: outcome.multiplier,
      payoutCents,
      status: payoutCents >= parsedStake ? 'WON' : 'LOST',
      details: outcome,
      serverSeedHash: seed.serverSeedHash,
      clientSeed: seed.clientSeed,
      nonce: seed.nonce,
      alreadyDebited: false,
    });

    this.emit('betSettled', record);
    this.emit('userUpdated', user);
    return { user, outcome, record };
  }

  // ==================== 10. BLACKJACK ====================
  _drawCard(session) {
    const card = session.shoe[session.shoeCursor];
    session.shoeCursor += 1;
    return card;
  }

  _serializeBlackjack(s) {
    if (!s) return null;
    const hideHole = s.status === 'ACTIVE';
    const visibleDealerCards = hideHole ? [s.dealerCards[0]] : s.dealerCards;
    const dealerEval = evaluateBlackjackHand(visibleDealerCards);

    const activeHand = s.hands[s.activeHandIndex] || null;
    const canHit = s.status === 'ACTIVE' && activeHand && activeHand.status === 'ACTIVE';
    const canStand = canHit;
    const canDouble =
      canHit &&
      activeHand.cards.length === 2 &&
      !activeHand.doubled;
    const canSplit =
      canHit &&
      s.hands.length === 1 &&
      activeHand.cards.length === 2 &&
      activeHand.cards[0].value === activeHand.cards[1].value;

    return {
      sessionId: s.sessionId,
      status: s.status,
      activeHandIndex: s.activeHandIndex,
      totalStakeCents: s.hands.reduce((acc, h) => acc + h.stakeCents, 0),
      totalPayoutCents: s.totalPayoutCents || 0,
      dealerCards: visibleDealerCards,
      dealerHoleHidden: hideHole,
      dealerTotal: dealerEval.total,
      dealerIsSoft: dealerEval.isSoft,
      hands: s.hands.map((h) => {
        const ev = evaluateBlackjackHand(h.cards);
        return {
          cards: h.cards,
          stakeCents: h.stakeCents,
          doubled: h.doubled,
          status: h.status,
          outcome: h.outcome,
          payoutCents: h.payoutCents || 0,
          total: ev.total,
          isSoft: ev.isSoft,
          isBlackjack: ev.isBlackjack,
          isBust: ev.isBust,
        };
      }),
      canHit: Boolean(canHit),
      canStand: Boolean(canStand),
      canDouble: Boolean(canDouble),
      canSplit: Boolean(canSplit),
      serverSeedHash: s.serverSeedHash,
      clientSeed: s.clientSeed,
      nonce: s.nonce,
    };
  }

  _finishBlackjackSession(session) {
    const hasLiveHand = session.hands.some((h) => h.status !== 'BUSTED');
    if (hasLiveHand) {
      let dEval = evaluateBlackjackHand(session.dealerCards);
      while (dEval.total < 17) {
        session.dealerCards.push(this._drawCard(session));
        dEval = evaluateBlackjackHand(session.dealerCards);
      }
    }

    const dealerEval = evaluateBlackjackHand(session.dealerCards);
    let totalStakeCents = 0;
    let totalPayoutCents = 0;

    for (const h of session.hands) {
      totalStakeCents += h.stakeCents;
      const pEval = evaluateBlackjackHand(h.cards);

      if (pEval.isBust) {
        h.status = 'SETTLED';
        h.outcome = 'BUST';
        h.payoutCents = 0;
      } else if (pEval.isBlackjack && session.hands.length === 1 && !dealerEval.isBlackjack) {
        // Natural Blackjack pays 3:2 (2.5x)
        h.status = 'SETTLED';
        h.outcome = 'BLACKJACK';
        h.payoutCents = Math.floor(h.stakeCents * 2.5);
      } else if (dealerEval.isBlackjack && !(pEval.isBlackjack && session.hands.length === 1)) {
        h.status = 'SETTLED';
        h.outcome = 'LOSE';
        h.payoutCents = 0;
      } else if (dealerEval.isBust || pEval.total > dealerEval.total) {
        h.status = 'SETTLED';
        h.outcome = 'WIN';
        h.payoutCents = h.stakeCents * 2;
      } else if (pEval.total === dealerEval.total) {
        h.status = 'SETTLED';
        h.outcome = 'PUSH';
        h.payoutCents = h.stakeCents;
      } else {
        h.status = 'SETTLED';
        h.outcome = 'LOSE';
        h.payoutCents = 0;
      }
      totalPayoutCents += h.payoutCents;
    }

    session.status = 'SETTLED';
    session.totalPayoutCents = totalPayoutCents;
    this.blackjackSessions.delete(session.userId);

    const mult = totalStakeCents > 0 ? Number((totalPayoutCents / totalStakeCents).toFixed(2)) : 0;
    const overallStatus = totalPayoutCents >= totalStakeCents ? 'WON' : 'LOST';

    const { user, record } = this.db.settleOriginalBet({
      userId: session.userId,
      game: 'blackjack',
      stakeCents: totalStakeCents,
      multiplier: mult,
      payoutCents: totalPayoutCents,
      status: overallStatus,
      details: {
        dealerTotal: dealerEval.total,
        hands: session.hands.map((h) => ({
          outcome: h.outcome,
          total: evaluateBlackjackHand(h.cards).total,
          stakeCents: h.stakeCents,
          payoutCents: h.payoutCents,
        })),
      },
      serverSeedHash: session.serverSeedHash,
      clientSeed: session.clientSeed,
      nonce: session.nonce,
      alreadyDebited: true,
    });

    this.emit('betSettled', record);
    this.emit('userUpdated', user);
    return { user, session: this._serializeBlackjack(session), record };
  }

  _advanceOrFinishBlackjack(session) {
    while (session.activeHandIndex < session.hands.length) {
      const h = session.hands[session.activeHandIndex];
      if (h.status === 'ACTIVE') {
        const ev = evaluateBlackjackHand(h.cards);
        if (ev.total >= 21) {
          h.status = ev.isBust ? 'BUSTED' : 'STOOD';
          session.activeHandIndex += 1;
          continue;
        }
        return { user: this.db.getUserById(session.userId), session: this._serializeBlackjack(session) };
      }
      session.activeHandIndex += 1;
    }
    return this._finishBlackjackSession(session);
  }

  startBlackjack({ userId, stakeCents }) {
    if (this.blackjackSessions.has(userId)) {
      throw new Error('Finish your active Blackjack hand first.');
    }
    const parsedStake = Math.round(Number(stakeCents));
    const user = this.db.debitUserStake(userId, parsedStake, 'BLACKJACK deal');
    const seed = this.db.consumeUserNonce(userId);
    const shoe = generateBlackjackShoe(seed.serverSeed, seed.clientSeed, seed.nonce, 28);

    const session = {
      sessionId: `bj_${crypto.randomBytes(5).toString('hex')}`,
      userId,
      shoe,
      shoeCursor: 0,
      status: 'ACTIVE',
      activeHandIndex: 0,
      dealerCards: [],
      hands: [
        {
          cards: [],
          stakeCents: parsedStake,
          doubled: false,
          status: 'ACTIVE',
          outcome: null,
          payoutCents: 0,
        },
      ],
      totalPayoutCents: 0,
      serverSeedHash: seed.serverSeedHash,
      clientSeed: seed.clientSeed,
      nonce: seed.nonce,
    };

    // Standard casino deal order: P1, D1, P2, D2 (hole)
    session.hands[0].cards.push(this._drawCard(session));
    session.dealerCards.push(this._drawCard(session));
    session.hands[0].cards.push(this._drawCard(session));
    session.dealerCards.push(this._drawCard(session));

    this.blackjackSessions.set(userId, session);
    this.emit('userUpdated', user);

    // Instant settlement on natural Blackjack for player or dealer
    const pEval = evaluateBlackjackHand(session.hands[0].cards);
    const dEval = evaluateBlackjackHand(session.dealerCards);
    if (pEval.isBlackjack || dEval.isBlackjack) {
      return this._finishBlackjackSession(session);
    }

    return { user, session: this._serializeBlackjack(session) };
  }

  actionBlackjack({ userId, action }) {
    const session = this.blackjackSessions.get(userId);
    if (!session || session.status !== 'ACTIVE') {
      throw new Error('No active Blackjack hand. Click Deal to start.');
    }

    const hand = session.hands[session.activeHandIndex];
    if (!hand || hand.status !== 'ACTIVE') {
      return this._advanceOrFinishBlackjack(session);
    }

    if (action === 'hit') {
      hand.cards.push(this._drawCard(session));
      const ev = evaluateBlackjackHand(hand.cards);
      if (ev.isBust) {
        hand.status = 'BUSTED';
        session.activeHandIndex += 1;
      } else if (ev.total === 21) {
        hand.status = 'STOOD';
        session.activeHandIndex += 1;
      }
      return this._advanceOrFinishBlackjack(session);
    }

    if (action === 'stand') {
      hand.status = 'STOOD';
      session.activeHandIndex += 1;
      return this._advanceOrFinishBlackjack(session);
    }

    if (action === 'double') {
      if (hand.cards.length !== 2 || hand.doubled) {
        throw new Error('Double Down is only available on a 2-card hand.');
      }
      const updatedUser = this.db.debitUserStake(userId, hand.stakeCents, 'BLACKJACK double down');
      hand.stakeCents *= 2;
      hand.doubled = true;
      hand.cards.push(this._drawCard(session));
      const ev = evaluateBlackjackHand(hand.cards);
      hand.status = ev.isBust ? 'BUSTED' : 'STOOD';
      session.activeHandIndex += 1;
      this.emit('userUpdated', updatedUser);
      return this._advanceOrFinishBlackjack(session);
    }

    if (action === 'split') {
      if (
        session.hands.length !== 1 ||
        hand.cards.length !== 2 ||
        hand.cards[0].value !== hand.cards[1].value
      ) {
        throw new Error('Split is only available on a matching pair.');
      }
      const updatedUser = this.db.debitUserStake(userId, hand.stakeCents, 'BLACKJACK split hand');
      const secondCard = hand.cards.pop();
      const hand2 = {
        cards: [secondCard, this._drawCard(session)],
        stakeCents: hand.stakeCents,
        doubled: false,
        status: 'ACTIVE',
        outcome: null,
        payoutCents: 0,
      };
      hand.cards.push(this._drawCard(session));
      session.hands.push(hand2);
      this.emit('userUpdated', updatedUser);
      return this._advanceOrFinishBlackjack(session);
    }

    throw new Error('Invalid Blackjack action');
  }
}

module.exports = { OriginalsEngine };
