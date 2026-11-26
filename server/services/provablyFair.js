const crypto = require('crypto');

const HOUSE_EDGE = 0.01; // 1% Stake Originals-standard edge (99% RTP)

function generateServerSeed() {
  return crypto.randomBytes(32).toString('hex');
}

function hashServerSeed(serverSeed) {
  return crypto.createHash('sha256').update(serverSeed).digest('hex');
}

/**
 * Deterministic provably-fair float generator in [0, 1) using HMAC-SHA256
 * (Stake Originals standard byte-stream algorithm)
 */
function generateFloats(serverSeed, clientSeed, nonce, count = 1) {
  const floats = [];
  let cursor = 0;

  while (floats.length < count) {
    const hmac = crypto
      .createHmac('sha256', serverSeed)
      .update(`${clientSeed}:${nonce}:${cursor}`)
      .digest();

    for (let offset = 0; offset < hmac.length && floats.length < count; offset += 4) {
      const value =
        hmac[offset] / 256 +
        hmac[offset + 1] / 65536 +
        hmac[offset + 2] / 16777216 +
        hmac[offset + 3] / 4294967296;
      floats.push(value);
    }
    cursor += 1;
  }

  return floats;
}

// ==================== 1. CRASH ====================
function calculateCrashPoint(serverSeed, roundSalt) {
  const hash = crypto
    .createHmac('sha256', serverSeed)
    .update(String(roundSalt))
    .digest('hex');

  // 1 in 33 instant 1.00x crash (~3% house edge on 1.00x / ~97-99% RTP curve)
  const h = parseInt(hash.slice(0, 13), 16);
  const e = 2 ** 52;
  if (h % 33 === 0) return 1.0;

  const raw = Math.floor(((100 * e - h) / (e - h))) / 100;
  return Math.max(1.01, Math.min(10000, Number(raw.toFixed(2))));
}

// ==================== 2. PUMP (Stake Balloon Pump) ====================
const PUMP_CONFIGS = {
  easy: { totalPumps: 24, popsCount: 1, label: 'Easy' },
  medium: { totalPumps: 22, popsCount: 3, label: 'Medium' },
  hard: { totalPumps: 20, popsCount: 5, label: 'Hard' },
  expert: { totalPumps: 15, popsCount: 5, label: 'Expert' },
};

function getPumpMultiplier(difficulty, pumpsSurvived) {
  const cfg = PUMP_CONFIGS[difficulty] || PUMP_CONFIGS.medium;
  if (pumpsSurvived <= 0) return 1.0;
  const safeSlots = cfg.totalPumps - cfg.popsCount;
  if (pumpsSurvived > safeSlots) return 1.0;

  let prob = 1;
  for (let i = 0; i < pumpsSurvived; i++) {
    prob *= (safeSlots - i) / (cfg.totalPumps - i);
  }
  return Number(((1 - HOUSE_EDGE) / prob).toFixed(2));
}

function getPumpPopThreshold(serverSeed, clientSeed, nonce, difficulty) {
  const cfg = PUMP_CONFIGS[difficulty] || PUMP_CONFIGS.medium;
  // Build array of totalPumps slots with popsCount pop traps, Fisher-Yates shuffle
  const deck = Array.from({ length: cfg.totalPumps }, (_, i) => i < cfg.popsCount);
  const floats = generateFloats(serverSeed, clientSeed, nonce, cfg.totalPumps);

  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(floats[i] * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  // 1-indexed pump number at which the balloon pops!
  const firstPopIdx = deck.findIndex(Boolean);
  return firstPopIdx === -1 ? cfg.totalPumps : firstPopIdx + 1;
}

// ==================== 3. MINES (5x5 Grid) ====================
function getMinesMultiplier(mineCount, revealedSafeCount) {
  if (revealedSafeCount <= 0) return 1.0;
  const totalTiles = 25;
  const safeTiles = totalTiles - mineCount;
  if (revealedSafeCount > safeTiles) return 1.0;

  let prob = 1;
  for (let i = 0; i < revealedSafeCount; i++) {
    prob *= (safeTiles - i) / (totalTiles - i);
  }
  return Number(((1 - HOUSE_EDGE) / prob).toFixed(2));
}

function generateMinePositions(serverSeed, clientSeed, nonce, mineCount) {
  const indices = Array.from({ length: 25 }, (_, i) => i);
  const floats = generateFloats(serverSeed, clientSeed, nonce, 25);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(floats[i] * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices.slice(0, mineCount).sort((a, b) => a - b);
}

// ==================== 4. PLINKO ====================
const PLINKO_MULTIPLIERS = {
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

function generatePlinkoOutcome(serverSeed, clientSeed, nonce, rows, risk) {
  const validRows = [8, 12, 16].includes(Number(rows)) ? Number(rows) : 12;
  const validRisk = ['low', 'medium', 'high'].includes(risk) ? risk : 'medium';
  const floats = generateFloats(serverSeed, clientSeed, nonce, validRows);
  const path = floats.map((f) => (f < 0.5 ? 0 : 1)); // 0 = Left, 1 = Right
  const bucketIndex = path.reduce((sum, step) => sum + step, 0);
  const table = PLINKO_MULTIPLIERS[validRows][validRisk];
  const multiplier = table[bucketIndex];
  return { rows: validRows, risk: validRisk, path, bucketIndex, multiplier, table };
}

// ==================== 5. DICE ====================
function generateDiceOutcome(serverSeed, clientSeed, nonce, target, condition) {
  const [f] = generateFloats(serverSeed, clientSeed, nonce, 1);
  const roll = Number((Math.floor(f * 10001) / 100).toFixed(2)); // 0.00 to 100.00
  const cleanTarget = Math.max(2, Math.min(98, Number(target)));
  const isOver = condition !== 'under';
  const winChance = isOver ? 100 - cleanTarget : cleanTarget;
  const multiplier = Number(((1 - HOUSE_EDGE) * (100 / winChance)).toFixed(4));
  const won = isOver ? roll > cleanTarget : roll < cleanTarget;
  return {
    roll,
    target: cleanTarget,
    condition: isOver ? 'over' : 'under',
    winChance: Number(winChance.toFixed(2)),
    multiplier,
    won,
  };
}

// ==================== 6. LIMBO ====================
function generateLimboOutcome(serverSeed, clientSeed, nonce, targetMultiplier) {
  const [f] = generateFloats(serverSeed, clientSeed, nonce, 1);
  const cleanTarget = Math.max(1.01, Math.min(1_000_000, Number(targetMultiplier)));
  const raw = (1 - HOUSE_EDGE) / Math.max(f, 1e-7);
  const resultMultiplier = Math.max(1.0, Math.min(1_000_000, Number(raw.toFixed(2))));
  const winChance = Number((((1 - HOUSE_EDGE) / cleanTarget) * 100).toFixed(4));
  const won = resultMultiplier >= cleanTarget;
  return {
    targetMultiplier: cleanTarget,
    resultMultiplier,
    winChance,
    won,
  };
}

// ==================== 7. KENO (40 tiles, 10 drawn) ====================
// Exact Stake Originals style payout curves by risk & pick count
function getKenoPayoutTable(pickCount, risk = 'medium') {
  const n = Math.max(1, Math.min(10, Number(pickCount)));
  // Compute hypergeometric probabilities and map clean risk-skewed payouts
  const comb = (a, b) => {
    if (b < 0 || b > a) return 0;
    let res = 1;
    for (let i = 1; i <= Math.min(b, a - b); i++) {
      res = (res * (a - i + 1)) / i;
    }
    return res;
  };

  const totalWays = comb(40, 10);
  const probs = [];
  for (let k = 0; k <= n; k++) {
    probs.push((comb(n, k) * comb(40 - n, 10 - k)) / totalWays);
  }

  const exponent = risk === 'low' ? 1.05 : risk === 'high' ? 1.85 : 1.4;
  const minHit =
    risk === 'high'
      ? Math.max(1, Math.ceil(n * 0.45))
      : risk === 'low'
      ? Math.max(1, Math.floor(n * 0.25))
      : Math.max(1, Math.ceil(n * 0.3));

  const weights = probs.map((p, k) => (k < minHit ? 0 : Math.pow(1 / Math.max(p, 1e-9), exponent - 1)));
  const expectedWeight = weights.reduce((acc, w, k) => acc + w * probs[k], 0);
  const scale = expectedWeight > 0 ? (1 - HOUSE_EDGE) / expectedWeight : 0;

  return weights.map((w) => {
    const val = w * scale;
    if (val < 0.1) return 0;
    if (val >= 100) return Math.round(val);
    return Number(val.toFixed(2));
  });
}

function generateKenoOutcome(serverSeed, clientSeed, nonce, picks, risk = 'medium') {
  const cleanPicks = [...new Set(picks.map(Number).filter((x) => x >= 1 && x <= 40))].slice(0, 10);
  if (cleanPicks.length === 0) throw new Error('Select at least 1 tile (1-40)');

  const pool = Array.from({ length: 40 }, (_, i) => i + 1);
  const floats = generateFloats(serverSeed, clientSeed, nonce, 40);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(floats[i] * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const drawn = pool.slice(0, 10);
  const drawnSet = new Set(drawn);
  const hits = cleanPicks.filter((p) => drawnSet.has(p));
  const payoutTable = getKenoPayoutTable(cleanPicks.length, risk);
  const multiplier = payoutTable[hits.length] || 0;

  return {
    picks: cleanPicks,
    drawn,
    hits,
    hitCount: hits.length,
    risk,
    payoutTable,
    multiplier,
  };
}

// ==================== 8. DRAGON TOWER (9 Floors) ====================
const TOWER_CONFIGS = {
  easy: { cols: 4, bombs: 1, rows: 9, label: 'Easy' },
  medium: { cols: 3, bombs: 1, rows: 9, label: 'Medium' },
  hard: { cols: 2, bombs: 1, rows: 9, label: 'Hard' },
  expert: { cols: 3, bombs: 2, rows: 9, label: 'Expert' },
};

function getTowerMultiplier(difficulty, floorCleared) {
  const cfg = TOWER_CONFIGS[difficulty] || TOWER_CONFIGS.medium;
  if (floorCleared <= 0) return 1.0;
  const safeProbPerRow = (cfg.cols - cfg.bombs) / cfg.cols;
  const mult = (1 - HOUSE_EDGE) / Math.pow(safeProbPerRow, floorCleared);
  return Number(mult.toFixed(2));
}

function generateTowerGrid(serverSeed, clientSeed, nonce, difficulty) {
  const cfg = TOWER_CONFIGS[difficulty] || TOWER_CONFIGS.medium;
  const floats = generateFloats(serverSeed, clientSeed, nonce, cfg.rows * cfg.cols);
  const rows = [];

  for (let r = 0; r < cfg.rows; r++) {
    const cols = Array.from({ length: cfg.cols }, (_, c) => c);
    for (let i = cols.length - 1; i > 0; i--) {
      const f = floats[r * cfg.cols + i];
      const j = Math.floor(f * (i + 1));
      [cols[i], cols[j]] = [cols[j], cols[i]];
    }
    rows.push(cols.slice(0, cfg.bombs).sort((a, b) => a - b));
  }
  return rows; // array of bomb column indices per floor (0 = bottom floor, 8 = top)
}

// ==================== 9. WHEEL ====================
function getWheelSegments(segments = 20, risk = 'medium') {
  const n = [10, 20, 30, 40, 50].includes(Number(segments)) ? Number(segments) : 20;
  const arr = [];

  if (risk === 'high') {
    // 1 massive jackpot segment = n * 0.99x, rest 0x!
    const jackpot = Number((n * (1 - HOUSE_EDGE)).toFixed(2));
    for (let i = 0; i < n; i++) {
      arr.push(i === 0 ? jackpot : 0);
    }
    return arr;
  }

  if (risk === 'low') {
    // Mostly 1.2x, occasional 1.5x, few 0x
    for (let i = 0; i < n; i++) {
      if (i % 5 === 0) arr.push(1.5);
      else if (i % 5 === 4) arr.push(0);
      else arr.push(1.2);
    }
    return arr;
  }

  // Medium: vibrant mix of 0x, 1.5x, 2x, 3x, 5x (balanced ~99% RTP)
  const pattern = [3.0, 0, 1.5, 0, 2.0, 0, 1.5, 0, 1.9, 0];
  for (let i = 0; i < n; i++) {
    arr.push(pattern[i % pattern.length]);
  }
  return arr;
}

function generateWheelOutcome(serverSeed, clientSeed, nonce, segments = 20, risk = 'medium') {
  const wheel = getWheelSegments(segments, risk);
  const [f] = generateFloats(serverSeed, clientSeed, nonce, 1);
  const index = Math.floor(f * wheel.length);
  const multiplier = wheel[index];
  return {
    segments: wheel.length,
    risk,
    wheel,
    index,
    multiplier,
  };
}

// ==================== 10. BLACKJACK ====================
const CARD_SUITS = ['spades', 'hearts', 'diamonds', 'clubs'];
const CARD_RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

function cardValue(rank) {
  if (rank === 'A') return 11;
  if (['K', 'Q', 'J'].includes(rank)) return 10;
  return Number(rank);
}

function evaluateBlackjackHand(cards) {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    if (c.rank === 'A') {
      aces += 1;
      total += 11;
    } else {
      total += cardValue(c.rank);
    }
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }
  const isSoft = aces > 0 && total <= 21;
  const isBlackjack = cards.length === 2 && total === 21;
  return { total, isSoft, isBlackjack, isBust: total > 21 };
}

function generateBlackjackShoe(serverSeed, clientSeed, nonce, count = 24) {
  const floats = generateFloats(serverSeed, clientSeed, nonce, count);
  return floats.map((f) => {
    const idx = Math.floor(f * 52);
    const suit = CARD_SUITS[Math.floor(idx / 13)];
    const rank = CARD_RANKS[idx % 13];
    return { suit, rank, value: cardValue(rank) };
  });
}

module.exports = {
  HOUSE_EDGE,
  PUMP_CONFIGS,
  PLINKO_MULTIPLIERS,
  TOWER_CONFIGS,
  generateServerSeed,
  hashServerSeed,
  generateFloats,
  calculateCrashPoint,
  getPumpMultiplier,
  getPumpPopThreshold,
  getMinesMultiplier,
  generateMinePositions,
  generatePlinkoOutcome,
  generateDiceOutcome,
  generateLimboOutcome,
  getKenoPayoutTable,
  generateKenoOutcome,
  getTowerMultiplier,
  generateTowerGrid,
  getWheelSegments,
  generateWheelOutcome,
  evaluateBlackjackHand,
  generateBlackjackShoe,
};
