const path = require('path');
const fs = require('fs');
const http = require('http');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');

const {
  MARKETS,
  TIMEFRAMES,
  STAKE_TIERS,
  MASTER_FEE_RATE,
  MASTER_WALLET_ADDRESS,
  TOPUP_AMOUNT_CENTS,
} = require('./config');
const { createDatabase } = require('./db');
const { PriceFeedService } = require('./services/priceFeed');
const { GameEngine, roomKey, parseRoomKey } = require('./services/gameEngine');
const { CrashEngine } = require('./services/crashEngine');
const { OriginalsEngine } = require('./services/originalsEngine');
const {
  PUMP_CONFIGS,
  PLINKO_MULTIPLIERS,
  TOWER_CONFIGS,
  getKenoPayoutTable,
  getWheelSegments,
} = require('./services/provablyFair');

const PORT = Number(process.env.PORT || 4000);

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const db = createDatabase();
const priceFeed = new PriceFeedService({ enableExternalFeeds: true });
const gameEngine = new GameEngine({
  db,
  priceFeed,
  botsEnabled: true,
  seedInitialHistory: true,
});
const crashEngine = new CrashEngine({ db, botsEnabled: true });
const originalsEngine = new OriginalsEngine({ db });

priceFeed.start();
gameEngine.start();
crashEngine.start();

// Track connected clients & which room each socket is viewing
const socketMeta = new Map();

function notifyUserSockets(user) {
  if (!user) return;
  for (const [socketId, meta] of socketMeta.entries()) {
    if (meta.userId === user.id) {
      io.to(socketId).emit('user:updated', user);
    }
  }
}

crashEngine.on('state', (snapshot) => {
  io.emit('crash:state', snapshot);
});
crashEngine.on('tick', (tick) => {
  io.emit('crash:tick', tick);
});
crashEngine.on('userUpdated', notifyUserSockets);
crashEngine.on('betSettled', (record) => {
  io.emit('originals:bet', record);
  io.emit('master_wallet:update', db.getMasterWalletSummary(50));
});

originalsEngine.on('userUpdated', notifyUserSockets);
originalsEngine.on('betSettled', (record) => {
  io.emit('originals:bet', record);
  io.emit('master_wallet:update', db.getMasterWalletSummary(50));
});

function broadcastGlobalStats() {
  io.emit('global:stats', gameEngine.getGlobalStats(io.engine.clientsCount));
}

priceFeed.on('tick', (tickers) => {
  io.emit('market:ticks', {
    serverTime: Date.now(),
    tickers,
  });
});

gameEngine.on('roomUpdate', (snapshot) => {
  io.to(`room:${snapshot.roomKey}`).emit('room:state', snapshot);
});

gameEngine.on('roundSettled', ({ roomKey: key, settlement, updatedUserBalances }) => {
  // Broadcast settlement to room viewers and globally for Master Wallet / toast updates
  io.to(`room:${key}`).emit('round:settled', settlement);
  io.emit('master_wallet:update', db.getMasterWalletSummary(50));
  io.emit('global:settlement', {
    roundId: settlement.roundId,
    roundNumber: settlement.roundNumber,
    symbol: settlement.symbol,
    timeframe: settlement.timeframe,
    tierCents: settlement.tierCents,
    outcome: settlement.outcome,
    totalPoolCents: settlement.totalPoolCents,
    masterFeeCents: settlement.masterFeeCents,
    winnerCount: settlement.winnerCount,
    payoutPerWinnerCents: settlement.payoutPerWinnerCents,
    settledAt: settlement.settledAt,
  });

  // Notify affected human players of their updated wallet balance
  for (const [socketId, meta] of socketMeta.entries()) {
    if (meta.userId && updatedUserBalances[meta.userId] != null) {
      const user = db.getUserById(meta.userId);
      if (user) {
        io.to(socketId).emit('user:updated', user);
      }
    }
  }
});

gameEngine.on('globalStatsChanged', broadcastGlobalStats);
gameEngine.on('botsStatusChanged', broadcastGlobalStats);

io.on('connection', (socket) => {
  socketMeta.set(socket.id, { userId: null, roomKey: null });

  // Send immediate bootstrap state
  socket.emit('market:ticks', {
    serverTime: Date.now(),
    tickers: priceFeed.getAllTickers(),
  });
  socket.emit('global:stats', gameEngine.getGlobalStats(io.engine.clientsCount));
  socket.emit('crash:state', crashEngine.getSnapshot());
  broadcastGlobalStats();

  socket.on('user:identify', ({ userId }) => {
    const meta = socketMeta.get(socket.id);
    if (meta) {
      meta.userId = userId || null;
    }
  });

  socket.on('room:subscribe', ({ symbol, timeframe, tierCents }) => {
    const meta = socketMeta.get(socket.id);
    if (!meta) return;

    if (meta.roomKey) {
      socket.leave(`room:${meta.roomKey}`);
      const prev = parseRoomKey(meta.roomKey);
      gameEngine.trackRoomWatcher(prev.symbol, prev.timeframe, prev.tierCents, -1);
    }

    const nextKey = roomKey(symbol, timeframe, Number(tierCents));
    meta.roomKey = nextKey;
    socket.join(`room:${nextKey}`);
    gameEngine.trackRoomWatcher(symbol, timeframe, Number(tierCents), 1);

    const snapshot = gameEngine.getRoomSnapshot(symbol, timeframe, Number(tierCents));
    if (snapshot) {
      socket.emit('room:state', snapshot);
      socket.emit('market:history', {
        symbol,
        points: priceFeed.getHistory(symbol),
        candles: priceFeed.getCandles(symbol),
      });
    }
    broadcastGlobalStats();
  });

  socket.on('disconnect', () => {
    const meta = socketMeta.get(socket.id);
    if (meta && meta.roomKey) {
      const prev = parseRoomKey(meta.roomKey);
      gameEngine.trackRoomWatcher(prev.symbol, prev.timeframe, prev.tierCents, -1);
    }
    socketMeta.delete(socket.id);
    broadcastGlobalStats();
  });
});

// ==================== REST API ====================

app.get('/api/bootstrap', (_req, res) => {
  res.json({
    markets: MARKETS,
    timeframes: TIMEFRAMES,
    tiers: STAKE_TIERS,
    masterFeeRate: MASTER_FEE_RATE,
    masterWalletAddress: MASTER_WALLET_ADDRESS,
    tickers: priceFeed.getAllTickers(),
    globalStats: gameEngine.getGlobalStats(io.engine.clientsCount),
    masterWallet: db.getMasterWalletSummary(30),
  });
});

app.get('/api/markets/:symbol/history', (req, res) => {
  const symbol = decodeURIComponent(req.params.symbol);
  res.json({
    symbol,
    points: priceFeed.getHistory(symbol),
    candles: priceFeed.getCandles(symbol),
  });
});

app.get('/api/room', (req, res) => {
  const { symbol = 'BTC/USDT', timeframe = '1m', tierCents = '1000' } = req.query;
  const snapshot = gameEngine.getRoomSnapshot(symbol, timeframe, Number(tierCents));
  if (!snapshot) {
    return res.status(404).json({ error: 'Prediction room not found' });
  }
  return res.json(snapshot);
});

app.post('/api/users/login', (req, res) => {
  try {
    const { username } = req.body || {};
    const user = db.getOrCreateUser(username);
    return res.json({ user });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.get('/api/users/:userId', (req, res) => {
  const user = db.getUserById(req.params.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  return res.json({ user });
});

app.post('/api/users/:userId/topup', (req, res) => {
  try {
    const user = db.topUpUser(req.params.userId, TOPUP_AMOUNT_CENTS);
    for (const [socketId, meta] of socketMeta.entries()) {
      if (meta.userId === user.id) {
        io.to(socketId).emit('user:updated', user);
      }
    }
    return res.json({ user, addedCents: TOPUP_AMOUNT_CENTS });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.get('/api/users/:userId/bets', (req, res) => {
  const bets = db.getUserBets(req.params.userId, 50);
  res.json({ bets });
});

app.post('/api/bets', (req, res) => {
  try {
    const { userId, symbol, timeframe, tierCents, direction } = req.body || {};
    if (!userId) {
      return res.status(401).json({ error: 'Please sign in with a username first' });
    }
    const result = gameEngine.placeBet({
      userId,
      symbol,
      timeframe,
      tierCents: Number(tierCents),
      direction,
    });

    for (const [socketId, meta] of socketMeta.entries()) {
      if (meta.userId === userId) {
        io.to(socketId).emit('user:updated', result.user);
      }
    }

    return res.json(result);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.get('/api/master-wallet', (req, res) => {
  const limit = Math.min(200, Number(req.query.limit || 60));
  res.json(db.getMasterWalletSummary(limit));
});

app.get('/api/rounds/recent', (req, res) => {
  const { symbol, timeframe, tierCents, limit = '25' } = req.query;
  const rounds = db.getRecentRounds({
    symbol: symbol || undefined,
    timeframe: timeframe || undefined,
    tierCents: tierCents ? Number(tierCents) : undefined,
    limit: Math.min(100, Number(limit)),
  });
  res.json({ rounds });
});

app.get('/api/leaderboard', (_req, res) => {
  res.json({ leaderboard: db.getLeaderboard(25) });
});

app.post('/api/settings/bots', (req, res) => {
  const { enabled } = req.body || {};
  const next = gameEngine.setBotsEnabled(Boolean(enabled));
  crashEngine.setBotsEnabled(next);
  res.json({ botsEnabled: next });
});

// ==================== PULSE ORIGINALS (STAKE-STYLE GAMES) ====================

app.get('/api/originals/config', (_req, res) => {
  res.json({
    pump: PUMP_CONFIGS,
    plinko: PLINKO_MULTIPLIERS,
    tower: TOWER_CONFIGS,
    crash: crashEngine.getSnapshot(),
    recentBets: db.getRecentOriginalsBets({ limit: 25 }),
  });
});

app.get('/api/originals/recent', (req, res) => {
  const { game, userId, limit = '25' } = req.query;
  res.json({
    bets: db.getRecentOriginalsBets({
      game: game || undefined,
      userId: userId || undefined,
      limit: Math.min(80, Number(limit)),
    }),
  });
});

app.get('/api/originals/sessions/:userId', (req, res) => {
  const { userId } = req.params;
  res.json({
    sessions: originalsEngine.getActiveSessions(userId),
    fairness: originalsEngine.getFairnessInfo(userId),
  });
});

app.post('/api/originals/fairness/rotate', (req, res) => {
  try {
    const { userId, clientSeed } = req.body || {};
    if (!userId) return res.status(401).json({ error: 'Sign in required' });
    return res.json(originalsEngine.rotateSeed(userId, clientSeed));
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// 1. CRASH (Live Multiplayer)
app.get('/api/originals/crash/state', (_req, res) => {
  res.json(crashEngine.getSnapshot());
});

app.post('/api/originals/crash/bet', (req, res) => {
  try {
    const { userId, stakeCents, autoCashout } = req.body || {};
    if (!userId) return res.status(401).json({ error: 'Sign in required' });
    return res.json(crashEngine.placeBet({ userId, stakeCents, autoCashout }));
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.post('/api/originals/crash/cashout', (req, res) => {
  try {
    const { userId } = req.body || {};
    if (!userId) return res.status(401).json({ error: 'Sign in required' });
    return res.json(crashEngine.cashOut({ userId }));
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// 2. PUMP (Stake Balloon Pump)
app.post('/api/originals/pump/start', (req, res) => {
  try {
    const { userId, stakeCents, difficulty } = req.body || {};
    if (!userId) return res.status(401).json({ error: 'Sign in required' });
    return res.json(originalsEngine.startPump({ userId, stakeCents, difficulty }));
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.post('/api/originals/pump/pump', (req, res) => {
  try {
    const { userId } = req.body || {};
    if (!userId) return res.status(401).json({ error: 'Sign in required' });
    return res.json(originalsEngine.actionPump({ userId }));
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.post('/api/originals/pump/cashout', (req, res) => {
  try {
    const { userId } = req.body || {};
    if (!userId) return res.status(401).json({ error: 'Sign in required' });
    return res.json(originalsEngine.cashoutPump({ userId }));
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// 3. MINES (5x5 Grid)
app.post('/api/originals/mines/start', (req, res) => {
  try {
    const { userId, stakeCents, mineCount } = req.body || {};
    if (!userId) return res.status(401).json({ error: 'Sign in required' });
    return res.json(originalsEngine.startMines({ userId, stakeCents, mineCount }));
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.post('/api/originals/mines/reveal', (req, res) => {
  try {
    const { userId, tileIndex } = req.body || {};
    if (!userId) return res.status(401).json({ error: 'Sign in required' });
    return res.json(originalsEngine.revealMineTile({ userId, tileIndex }));
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.post('/api/originals/mines/cashout', (req, res) => {
  try {
    const { userId } = req.body || {};
    if (!userId) return res.status(401).json({ error: 'Sign in required' });
    return res.json(originalsEngine.cashoutMines({ userId }));
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// 4. PLINKO
app.post('/api/originals/plinko/drop', (req, res) => {
  try {
    const { userId, stakeCents, rows, risk } = req.body || {};
    if (!userId) return res.status(401).json({ error: 'Sign in required' });
    return res.json(originalsEngine.playPlinko({ userId, stakeCents, rows, risk }));
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// 5. DICE
app.post('/api/originals/dice/roll', (req, res) => {
  try {
    const { userId, stakeCents, target, condition } = req.body || {};
    if (!userId) return res.status(401).json({ error: 'Sign in required' });
    return res.json(originalsEngine.playDice({ userId, stakeCents, target, condition }));
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// 6. LIMBO
app.post('/api/originals/limbo/play', (req, res) => {
  try {
    const { userId, stakeCents, targetMultiplier } = req.body || {};
    if (!userId) return res.status(401).json({ error: 'Sign in required' });
    return res.json(originalsEngine.playLimbo({ userId, stakeCents, targetMultiplier }));
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// 7. KENO
app.get('/api/originals/keno/table', (req, res) => {
  const { picks = '5', risk = 'medium' } = req.query;
  res.json({ table: getKenoPayoutTable(Number(picks), String(risk)) });
});

app.post('/api/originals/keno/play', (req, res) => {
  try {
    const { userId, stakeCents, picks, risk } = req.body || {};
    if (!userId) return res.status(401).json({ error: 'Sign in required' });
    return res.json(originalsEngine.playKeno({ userId, stakeCents, picks, risk }));
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// 8. DRAGON TOWER
app.post('/api/originals/tower/start', (req, res) => {
  try {
    const { userId, stakeCents, difficulty } = req.body || {};
    if (!userId) return res.status(401).json({ error: 'Sign in required' });
    return res.json(originalsEngine.startTower({ userId, stakeCents, difficulty }));
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.post('/api/originals/tower/pick', (req, res) => {
  try {
    const { userId, colIndex } = req.body || {};
    if (!userId) return res.status(401).json({ error: 'Sign in required' });
    return res.json(originalsEngine.pickTowerTile({ userId, colIndex }));
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.post('/api/originals/tower/cashout', (req, res) => {
  try {
    const { userId } = req.body || {};
    if (!userId) return res.status(401).json({ error: 'Sign in required' });
    return res.json(originalsEngine.cashoutTower({ userId }));
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// 9. WHEEL
app.get('/api/originals/wheel/segments', (req, res) => {
  const { segments = '20', risk = 'medium' } = req.query;
  res.json({ wheel: getWheelSegments(Number(segments), String(risk)) });
});

app.post('/api/originals/wheel/spin', (req, res) => {
  try {
    const { userId, stakeCents, segments, risk } = req.body || {};
    if (!userId) return res.status(401).json({ error: 'Sign in required' });
    return res.json(originalsEngine.playWheel({ userId, stakeCents, segments, risk }));
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// 10. BLACKJACK
app.post('/api/originals/blackjack/deal', (req, res) => {
  try {
    const { userId, stakeCents } = req.body || {};
    if (!userId) return res.status(401).json({ error: 'Sign in required' });
    return res.json(originalsEngine.startBlackjack({ userId, stakeCents }));
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.post('/api/originals/blackjack/action', (req, res) => {
  try {
    const { userId, action } = req.body || {};
    if (!userId) return res.status(401).json({ error: 'Sign in required' });
    return res.json(originalsEngine.actionBlackjack({ userId, action }));
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// Serve production frontend bundle if built
const clientDist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
      return next();
    }
    return res.sendFile(path.join(clientDist, 'index.html'));
  });
}

httpServer.listen(PORT, () => {
  console.log(`PulsePredict server running on http://localhost:${PORT}`);
});

function shutdown() {
  priceFeed.stop();
  gameEngine.stop();
  crashEngine.stop();
  db.close();
  httpServer.close(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
