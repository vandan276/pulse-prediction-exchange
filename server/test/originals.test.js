const test = require('node:test');
const assert = require('node:assert/strict');
const { createDatabase } = require('../db');
const { OriginalsEngine } = require('../services/originalsEngine');
const { CrashEngine } = require('../services/crashEngine');
const {
  getPumpMultiplier,
  getMinesMultiplier,
  generatePlinkoOutcome,
  generateDiceOutcome,
} = require('../services/provablyFair');

test('Provably-fair RNG is deterministic for identical seeds and nonces', () => {
  const a = generatePlinkoOutcome('seed_alpha', 'client_1', 7, 12, 'high');
  const b = generatePlinkoOutcome('seed_alpha', 'client_1', 7, 12, 'high');
  assert.deepEqual(a.path, b.path);
  assert.equal(a.bucketIndex, b.bucketIndex);
  assert.equal(a.multiplier, b.multiplier);

  const d1 = generateDiceOutcome('seed_alpha', 'client_1', 8, 50, 'over');
  const d2 = generateDiceOutcome('seed_alpha', 'client_1', 8, 50, 'over');
  assert.equal(d1.roll, d2.roll);
  assert.equal(d1.won, d2.won);
});

test('Pump game escalates multipliers and settles cleanly into user wallet & Master Vault', () => {
  const db = createDatabase(':memory:');
  const orig = new OriginalsEngine({ db });
  const player = db.getOrCreateUser('PumpTester');

  // Verify easy pump multiplier escalates cleanly
  assert.ok(getPumpMultiplier('easy', 1) > 1.0);
  assert.ok(getPumpMultiplier('hard', 3) > getPumpMultiplier('easy', 3));

  const started = orig.startPump({ userId: player.id, stakeCents: 2000, difficulty: 'easy' });
  assert.equal(started.user.balanceCents, 98_000);
  // Force safe threshold for deterministic cashout test
  orig.pumpSessions.get(player.id).popAtPump = 10;

  const p1 = orig.actionPump({ userId: player.id });
  assert.equal(p1.popped, false);
  assert.equal(p1.session.pumps, 1);

  const p2 = orig.actionPump({ userId: player.id });
  assert.equal(p2.popped, false);
  assert.equal(p2.session.pumps, 2);

  const cash = orig.cashoutPump({ userId: player.id });
  assert.equal(cash.cashedOut, true);
  assert.ok(cash.record.payoutCents > 2000);
  assert.equal(cash.user.balanceCents, 98_000 + cash.record.payoutCents);

  const mw = db.getMasterWalletSummary();
  assert.equal(mw.originals.totalBetsCount, 1);
  assert.equal(mw.originals.totalWageredCents, 2000);
  assert.equal(mw.originals.netHouseCents, 2000 - cash.record.payoutCents);

  db.close();
});

test('Mines 5x5 game reveals safe gems, cashes out accurately, and handles mine explosion', () => {
  const db = createDatabase(':memory:');
  const orig = new OriginalsEngine({ db });
  const player = db.getOrCreateUser('MinesTester');

  assert.ok(getMinesMultiplier(5, 1) > 1.2);
  const { session } = orig.startMines({ userId: player.id, stakeCents: 1000, mineCount: 3 });
  assert.equal(session.mines, null); // mines hidden while active

  const internal = orig.minesSessions.get(player.id);
  const safeTile = Array.from({ length: 25 }, (_, i) => i).find(
    (i) => !internal.mines.includes(i)
  );
  const step1 = orig.revealMineTile({ userId: player.id, tileIndex: safeTile });
  assert.equal(step1.hitMine, false);
  assert.equal(step1.session.revealed.length, 1);

  const cash = orig.cashoutMines({ userId: player.id });
  assert.equal(cash.cashedOut, true);
  assert.ok(cash.session.mines.length === 3); // mines revealed on finish
  assert.ok(cash.record.payoutCents > 1000);

  // Start second board and hit a mine directly
  orig.startMines({ userId: player.id, stakeCents: 1000, mineCount: 5 });
  const mineTile = orig.minesSessions.get(player.id).mines[0];
  const boom = orig.revealMineTile({ userId: player.id, tileIndex: mineTile });
  assert.equal(boom.hitMine, true);
  assert.equal(boom.record.payoutCents, 0);
  assert.equal(boom.record.status, 'LOST');

  db.close();
});

test('Plinko, Dice, Limbo, Keno, Dragon Tower, Wheel, and Crash all settle atomically', () => {
  const db = createDatabase(':memory:');
  const orig = new OriginalsEngine({ db });
  const crash = new CrashEngine({ db, botsEnabled: false });
  const player = db.getOrCreateUser('AllGamesVIP');

  // Plinko
  const pl = orig.playPlinko({ userId: player.id, stakeCents: 1000, rows: 12, risk: 'medium' });
  assert.equal(pl.outcome.path.length, 12);
  assert.ok(pl.record.payoutCents >= 0);

  // Dice
  const dc = orig.playDice({ userId: player.id, stakeCents: 1000, target: 50, condition: 'over' });
  assert.ok(dc.outcome.roll >= 0 && dc.outcome.roll <= 100);

  // Limbo
  const lm = orig.playLimbo({ userId: player.id, stakeCents: 1000, targetMultiplier: 2.5 });
  assert.ok(lm.outcome.resultMultiplier >= 1.0);

  // Keno
  const kn = orig.playKeno({ userId: player.id, stakeCents: 1000, picks: [1, 7, 14, 21, 35], risk: 'medium' });
  assert.equal(kn.outcome.drawn.length, 10);

  // Wheel
  const wh = orig.playWheel({ userId: player.id, stakeCents: 1000, segments: 20, risk: 'medium' });
  assert.equal(wh.outcome.wheel.length, 20);

  // Dragon Tower
  orig.startTower({ userId: player.id, stakeCents: 1000, difficulty: 'easy' });
  const towerInternal = orig.towerSessions.get(player.id);
  const safeCol = [0, 1, 2, 3].find((c) => !towerInternal.gridBombs[0].includes(c));
  const tStep = orig.pickTowerTile({ userId: player.id, colIndex: safeCol });
  assert.equal(tStep.hitBomb, false);
  const tCash = orig.cashoutTower({ userId: player.id });
  assert.equal(tCash.cashedOut, true);
  assert.ok(tCash.record.payoutCents > 1000);

  // Crash multiplayer
  crash.phase = 'BETTING';
  crash.crashPoint = 5.0;
  crash.placeBet({ userId: player.id, stakeCents: 1000, autoCashout: 3.0 });
  crash.phase = 'FLYING';
  crash.currentMultiplier = 2.0;
  const crCash = crash.cashOut({ userId: player.id });
  assert.equal(crCash.entry.status, 'CASHED_OUT');
  assert.equal(crCash.record.payoutCents, 2000);

  const mw = db.getMasterWalletSummary();
  assert.equal(mw.originals.totalBetsCount, 7);

  // Blackjack: deal + hit/stand settlement
  const bjStart = orig.startBlackjack({ userId: player.id, stakeCents: 2000 });
  assert.equal(bjStart.session.hands.length, 1);
  if (bjStart.session.status === 'ACTIVE') {
    const bjEnd = orig.actionBlackjack({ userId: player.id, action: 'stand' });
    assert.equal(bjEnd.session.status, 'SETTLED');
    assert.ok(['WIN', 'LOSE', 'PUSH', 'BLACKJACK', 'BUST'].includes(bjEnd.session.hands[0].outcome));
  }

  const mwAfterBj = db.getMasterWalletSummary();
  assert.equal(mwAfterBj.originals.totalBetsCount, 8);

  crash.stop();
  db.close();
});
