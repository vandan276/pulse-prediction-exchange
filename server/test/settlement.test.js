const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateSettlement, GameEngine } = require('../services/gameEngine');
const { createDatabase } = require('../db');
const { PriceFeedService } = require('../services/priceFeed');
const { TIMEFRAMES, MARKETS } = require('../config');

test('10% Master Wallet fee and exact equal split among winners (even division)', () => {
  // 10 players x $10 = $100.00 pool (10000 cents)
  // 10% Master Wallet = $10.00 (1000 cents)
  // 90% Distributable = $90.00 (9000 cents)
  // 3 UP winners => $30.00 (3000 cents) each!
  const players = [
    ...Array.from({ length: 3 }, (_, i) => ({
      betId: `up_${i}`,
      userId: `u_up_${i}`,
      direction: 'UP',
      stakeCents: 1000,
    })),
    ...Array.from({ length: 7 }, (_, i) => ({
      betId: `dn_${i}`,
      userId: `u_dn_${i}`,
      direction: 'DOWN',
      stakeCents: 1000,
    })),
  ];

  const res = calculateSettlement({
    players,
    lockPrice: 95000,
    closePrice: 95125.5,
  });

  assert.equal(res.outcome, 'UP');
  assert.equal(res.totalPoolCents, 10000);
  assert.equal(res.masterFeeCents, 1000);
  assert.equal(res.dustCents, 0);
  assert.equal(res.distributablePoolCents, 9000);
  assert.equal(res.winnerCount, 3);
  assert.equal(res.payoutPerWinnerCents, 3000);
  assert.equal(res.winners.length, 3);
  for (const w of res.winners) {
    assert.equal(w.payoutCents, 3000);
    assert.equal(w.status, 'WON');
  }
  const losers = res.players.filter((p) => p.direction === 'DOWN');
  for (const l of losers) {
    assert.equal(l.payoutCents, 0);
    assert.equal(l.status, 'LOST');
  }
});

test('10% Master Wallet fee and equal split with indivisible cents preserves conservation of money', () => {
  // 10 players x $10 = $100.00 (10000 cents)
  // 10% Master Wallet = $10.00 (1000 cents)
  // 90% = 9000 cents / 7 winners = 1285 cents each ($12.85) = 8995 cents total + 5 cents dust
  const players = [
    ...Array.from({ length: 7 }, (_, i) => ({
      betId: `dn_${i}`,
      userId: `u_dn_${i}`,
      direction: 'DOWN',
      stakeCents: 1000,
    })),
    ...Array.from({ length: 3 }, (_, i) => ({
      betId: `up_${i}`,
      userId: `u_up_${i}`,
      direction: 'UP',
      stakeCents: 1000,
    })),
  ];

  const res = calculateSettlement({
    players,
    lockPrice: 2685.5,
    closePrice: 2680.0,
  });

  assert.equal(res.outcome, 'DOWN');
  assert.equal(res.masterFeeCents, 1000);
  assert.equal(res.payoutPerWinnerCents, 1285);
  assert.equal(res.dustCents, 5);
  assert.equal(
    res.payoutPerWinnerCents * res.winnerCount + res.masterFeeCents + res.dustCents,
    res.totalPoolCents
  );
});

test('Exact price tie (DRAW) refunds 100% of stakes with 0 fee', () => {
  const players = [
    { betId: 'b1', userId: 'u1', direction: 'UP', stakeCents: 5000 },
    { betId: 'b2', userId: 'u2', direction: 'DOWN', stakeCents: 5000 },
  ];
  const res = calculateSettlement({
    players,
    lockPrice: 71.85,
    closePrice: 71.85,
  });

  assert.equal(res.outcome, 'DRAW');
  assert.equal(res.masterFeeCents, 0);
  assert.equal(res.winnerCount, 0);
  assert.ok(res.players.every((p) => p.status === 'REFUNDED' && p.payoutCents === 5000));
});

test('Zero winners (everyone chose losing side) refunds stakes cleanly', () => {
  const players = [
    { betId: 'b1', userId: 'u1', direction: 'UP', stakeCents: 1000 },
    { betId: 'b2', userId: 'u2', direction: 'UP', stakeCents: 1000 },
  ];
  const res = calculateSettlement({
    players,
    lockPrice: 3300,
    closePrice: 3250,
  });

  assert.equal(res.outcome, 'NO_WINNERS');
  assert.equal(res.masterFeeCents, 0);
  assert.ok(res.players.every((p) => p.status === 'REFUNDED' && p.payoutCents === 1000));
});

test('End-to-end DB + GameEngine bet, settlement, wallet credit, and Master Wallet ledger', () => {
  const db = createDatabase(':memory:');
  const priceFeed = new PriceFeedService({ enableExternalFeeds: false });
  const engine = new GameEngine({
    db,
    priceFeed,
    botsEnabled: false,
    seedInitialHistory: false,
  });

  // Verify all 7 timeframes and both crypto + commodities exist
  assert.deepEqual(
    TIMEFRAMES.map((t) => t.id),
    ['1m', '5m', '10m', '15m', '30m', '1h', '1d']
  );
  assert.ok(MARKETS.some((m) => m.category === 'crypto'));
  assert.ok(MARKETS.some((m) => m.category === 'commodity'));

  const alice = db.getOrCreateUser('Alice');
  const bob = db.getOrCreateUser('Bob');
  const charlie = db.getOrCreateUser('Charlie');
  const dave = db.getOrCreateUser('Dave');

  // 4 players bet $50 each on Gold (XAU/USD) 1m -> Total Pool = $200.00
  // Place bets explicitly during the open entry window (25s before lock, well before the 15s anti-snipe cutoff)
  const room = engine.rooms.get('XAU/USD|1m|5000');
  const safeEntryTime = room.openRound.entryCloseTime - 10_000;

  // Alice & Bob bet UP; Charlie & Dave bet DOWN
  engine.placeBet({ userId: alice.id, symbol: 'XAU/USD', timeframe: '1m', tierCents: 5000, direction: 'UP', nowMs: safeEntryTime });
  engine.placeBet({ userId: bob.id, symbol: 'XAU/USD', timeframe: '1m', tierCents: 5000, direction: 'UP', nowMs: safeEntryTime });
  engine.placeBet({ userId: charlie.id, symbol: 'XAU/USD', timeframe: '1m', tierCents: 5000, direction: 'DOWN', nowMs: safeEntryTime });
  engine.placeBet({ userId: dave.id, symbol: 'XAU/USD', timeframe: '1m', tierCents: 5000, direction: 'DOWN', nowMs: safeEntryTime });

  // Promote openRound to liveRound and simulate UP winning
  room.liveRound = room.openRound;
  room.liveRound.status = 'LIVE';
  room.liveRound.lockPrice = 2680.0;
  room.openRound = engine._createRound({
    symbol: 'XAU/USD',
    timeframe: '1m',
    durationMs: 60000,
    tierCents: 5000,
    status: 'OPEN',
    lockTime: room.liveRound.closeTime,
    closeTime: room.liveRound.closeTime + 60000,
    lockPrice: null,
  });

  // Move live price above lockPrice -> UP wins!
  priceFeed.tickers.get('XAU/USD').price = 2692.5;
  engine._rolloverRoom(room, Date.now());

  // Total Pool = $200.00 (20000 cents)
  // 10% Master Wallet = $20.00 (2000 cents)
  // 90% Distributable = $180.00 (18000 cents)
  // 2 winners (Alice & Bob) => $90.00 (9000 cents) each!
  const aliceAfter = db.getUserById(alice.id);
  const bobAfter = db.getUserById(bob.id);
  const charlieAfter = db.getUserById(charlie.id);
  const mw = db.getMasterWalletSummary();

  // Started at 100000 cents, paid 5000, won 9000 => 104000 cents ($1,040.00)
  assert.equal(aliceAfter.balanceCents, 104000);
  assert.equal(bobAfter.balanceCents, 104000);
  // Charlie started at 100000 cents, paid 5000, lost => 95000 cents ($950.00)
  assert.equal(charlieAfter.balanceCents, 95000);

  // Master wallet received exact $20.00 (2000 cents)
  assert.equal(mw.totalBalanceCents, 2000);
  assert.equal(mw.totalFeeCents, 2000);
  assert.equal(mw.settledRoundsCount, 1);
  assert.equal(mw.ledger[0].payoutPerWinnerCents, 9000);
  assert.equal(mw.ledger[0].winnerCount, 2);

  engine.stop();
  priceFeed.stop();
  db.close();
});

test('Anti-Snipe Lock rejects last-second bets after entryCloseTime (final 15s of 1m round)', () => {
  const db = createDatabase(':memory:');
  const priceFeed = new PriceFeedService({ enableExternalFeeds: false });
  const engine = new GameEngine({
    db,
    priceFeed,
    botsEnabled: false,
    seedInitialHistory: false,
  });

  const sniper = db.getOrCreateUser('LastSecSniper');
  const fairPlayer = db.getOrCreateUser('FairTrader');
  const room = engine.rooms.get('BTC/USDT|1m|1000');

  // Verify entryCloseTime is strictly 15 seconds before lockTime on 1m timeframe
  assert.equal(room.openRound.lockTime - room.openRound.entryCloseTime, 15_000);

  // Fair player entering 16s before lock succeeds
  const ok = engine.placeBet({
    userId: fairPlayer.id,
    symbol: 'BTC/USDT',
    timeframe: '1m',
    tierCents: 1000,
    direction: 'UP',
    nowMs: room.openRound.lockTime - 16_000,
  });
  assert.equal(ok.bet.direction, 'UP');

  // Sniper attempting to enter 5s before lock (inside 15s anti-snipe buffer) is rejected
  assert.throws(
    () =>
      engine.placeBet({
        userId: sniper.id,
        symbol: 'BTC/USDT',
        timeframe: '1m',
        tierCents: 1000,
        direction: 'DOWN',
        nowMs: room.openRound.lockTime - 5_000,
      }),
    /Anti-Snipe Lock Active/
  );

  // Sniper's balance remains untouched
  assert.equal(db.getUserById(sniper.id).balanceCents, 100_000);

  engine.stop();
  priceFeed.stop();
  db.close();
});
