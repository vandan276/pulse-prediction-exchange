const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');
const {
  DEFAULT_USER_BALANCE_CENTS,
  DEMO_BOT_PROFILES,
  MASTER_WALLET_ADDRESS,
} = require('./config');

const AVATAR_COLORS = [
  '#10B981',
  '#3B82F6',
  '#F59E0B',
  '#EC4899',
  '#8B5CF6',
  '#06B6D4',
  '#F97316',
  '#22D3EE',
];

function createDatabase(dbFilePath) {
  const resolvedPath =
    dbFilePath || path.join(__dirname, 'data', 'prediction_game.sqlite');

  if (resolvedPath !== ':memory:') {
    fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
  }

  const db = new DatabaseSync(resolvedPath);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    PRAGMA synchronous = NORMAL;

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      avatar_color TEXT NOT NULL,
      balance_cents INTEGER NOT NULL DEFAULT 100000,
      is_bot INTEGER NOT NULL DEFAULT 0,
      total_bets INTEGER NOT NULL DEFAULT 0,
      total_wins INTEGER NOT NULL DEFAULT 0,
      total_wagered_cents INTEGER NOT NULL DEFAULT 0,
      total_won_cents INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settled_rounds (
      id TEXT PRIMARY KEY,
      round_number INTEGER NOT NULL,
      symbol TEXT NOT NULL,
      category TEXT NOT NULL,
      timeframe TEXT NOT NULL,
      tier_cents INTEGER NOT NULL,
      lock_time INTEGER NOT NULL,
      close_time INTEGER NOT NULL,
      lock_price REAL NOT NULL,
      close_price REAL NOT NULL,
      outcome TEXT NOT NULL,
      player_count INTEGER NOT NULL,
      up_count INTEGER NOT NULL,
      down_count INTEGER NOT NULL,
      total_pool_cents INTEGER NOT NULL,
      master_fee_cents INTEGER NOT NULL,
      distributable_pool_cents INTEGER NOT NULL,
      winner_count INTEGER NOT NULL,
      payout_per_winner_cents INTEGER NOT NULL,
      tx_ref TEXT NOT NULL,
      settled_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_rounds_lookup
      ON settled_rounds(symbol, timeframe, tier_cents, settled_at DESC);
    CREATE INDEX IF NOT EXISTS idx_rounds_recent
      ON settled_rounds(settled_at DESC);

    CREATE TABLE IF NOT EXISTS bets (
      id TEXT PRIMARY KEY,
      round_id TEXT NOT NULL,
      round_number INTEGER NOT NULL,
      symbol TEXT NOT NULL,
      timeframe TEXT NOT NULL,
      tier_cents INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      username TEXT NOT NULL,
      avatar_color TEXT NOT NULL,
      is_bot INTEGER NOT NULL DEFAULT 0,
      direction TEXT NOT NULL,
      stake_cents INTEGER NOT NULL,
      payout_cents INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'PENDING',
      created_at INTEGER NOT NULL,
      settled_at INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_bets_round ON bets(round_id);
    CREATE INDEX IF NOT EXISTS idx_bets_user ON bets(user_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS master_wallet_ledger (
      id TEXT PRIMARY KEY,
      round_id TEXT NOT NULL,
      round_number INTEGER NOT NULL,
      symbol TEXT NOT NULL,
      category TEXT NOT NULL,
      timeframe TEXT NOT NULL,
      tier_cents INTEGER NOT NULL,
      total_pool_cents INTEGER NOT NULL,
      fee_cents INTEGER NOT NULL,
      dust_cents INTEGER NOT NULL DEFAULT 0,
      distributable_cents INTEGER NOT NULL,
      winner_count INTEGER NOT NULL,
      payout_per_winner_cents INTEGER NOT NULL,
      tx_ref TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_ledger_recent ON master_wallet_ledger(created_at DESC);

    CREATE TABLE IF NOT EXISTS wallet_transactions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      balance_after_cents INTEGER NOT NULL,
      round_id TEXT,
      note TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_wallet_tx_user ON wallet_transactions(user_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS user_seeds (
      user_id TEXT PRIMARY KEY,
      server_seed TEXT NOT NULL,
      client_seed TEXT NOT NULL,
      nonce INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS originals_bets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      username TEXT NOT NULL,
      avatar_color TEXT NOT NULL,
      is_bot INTEGER NOT NULL DEFAULT 0,
      game TEXT NOT NULL,
      stake_cents INTEGER NOT NULL,
      multiplier REAL NOT NULL DEFAULT 0,
      payout_cents INTEGER NOT NULL DEFAULT 0,
      house_delta_cents INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL,
      details_json TEXT,
      server_seed_hash TEXT,
      client_seed TEXT,
      nonce INTEGER,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_originals_recent ON originals_bets(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_originals_user ON originals_bets(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_originals_game ON originals_bets(game, created_at DESC);

    CREATE TABLE IF NOT EXISTS payment_transactions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      rail TEXT NOT NULL,
      provider TEXT NOT NULL,
      asset TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      fee_cents INTEGER NOT NULL DEFAULT 0,
      net_cents INTEGER NOT NULL,
      destination TEXT,
      provider_ref TEXT NOT NULL,
      status TEXT NOT NULL,
      metadata_json TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_payments_user ON payment_transactions(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_payments_ref ON payment_transactions(provider_ref);
  `);

  // Safe schema migration for real email/password authentication
  const userCols = db.prepare('PRAGMA table_info(users)').all().map((c) => c.name);
  if (!userCols.includes('email')) {
    db.exec('ALTER TABLE users ADD COLUMN email TEXT');
  }
  if (!userCols.includes('password_hash')) {
    db.exec('ALTER TABLE users ADD COLUMN password_hash TEXT');
  }
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique
      ON users(lower(email)) WHERE email IS NOT NULL;
  `);

  function runTransaction(fn) {
    db.exec('BEGIN IMMEDIATE');
    try {
      const result = fn();
      db.exec('COMMIT');
      return result;
    } catch (err) {
      try {
        db.exec('ROLLBACK');
      } catch {
        // ignore rollback error
      }
      throw err;
    }
  }

  function sanitizeUsername(raw) {
    return String(raw || '')
      .trim()
      .replace(/[^a-zA-Z0-9_-]/g, '')
      .slice(0, 20);
  }

  function formatUser(row) {
    if (!row) return null;
    return {
      id: row.id,
      username: row.username,
      email: row.email || undefined,
      avatarColor: row.avatar_color,
      balanceCents: Number(row.balance_cents),
      isBot: Boolean(row.is_bot),
      totalBets: Number(row.total_bets),
      totalWins: Number(row.total_wins),
      totalWageredCents: Number(row.total_wagered_cents),
      totalWonCents: Number(row.total_won_cents),
      netProfitCents: Number(row.total_won_cents) - Number(row.total_wagered_cents),
      winRate:
        Number(row.total_bets) > 0
          ? Number(((Number(row.total_wins) / Number(row.total_bets)) * 100).toFixed(1))
          : 0,
      createdAt: Number(row.created_at),
    };
  }

  function ensureBots() {
    const stmtGet = db.prepare('SELECT * FROM users WHERE username = ?');
    const stmtInsert = db.prepare(`
      INSERT INTO users (id, username, avatar_color, balance_cents, is_bot, created_at)
      VALUES (?, ?, ?, ?, 1, ?)
    `);

    const bots = [];
    const now = Date.now();
    for (const bot of DEMO_BOT_PROFILES) {
      let row = stmtGet.get(bot.username);
      if (!row) {
        const id = `bot_${bot.username.toLowerCase()}`;
        stmtInsert.run(id, bot.username, bot.avatarColor, 5_000_000, now);
        row = stmtGet.get(bot.username);
      }
      bots.push(formatUser(row));
    }
    return bots;
  }

  function getOrCreateUser(rawUsername) {
    const username = sanitizeUsername(rawUsername);
    if (username.length < 2) {
      throw new Error('Username must be at least 2 alphanumeric characters');
    }

    const existing = db
      .prepare('SELECT * FROM users WHERE lower(username) = lower(?)')
      .get(username);

    if (existing) {
      if (existing.is_bot) {
        throw new Error('That username belongs to a demo bot — pick another handle');
      }
      return formatUser(existing);
    }

    const id = `usr_${crypto.randomBytes(6).toString('hex')}`;
    const avatarColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
    const now = Date.now();

    runTransaction(() => {
      db.prepare(`
        INSERT INTO users (id, username, avatar_color, balance_cents, is_bot, created_at)
        VALUES (?, ?, ?, ?, 0, ?)
      `).run(id, username, avatarColor, DEFAULT_USER_BALANCE_CENTS, now);

      db.prepare(`
        INSERT INTO wallet_transactions (id, user_id, type, amount_cents, balance_after_cents, round_id, note, created_at)
        VALUES (?, ?, 'DEPOSIT', ?, ?, NULL, 'Welcome virtual balance', ?)
      `).run(
        `tx_${crypto.randomBytes(6).toString('hex')}`,
        id,
        DEFAULT_USER_BALANCE_CENTS,
        DEFAULT_USER_BALANCE_CENTS,
        now
      );
    });

    return getUserById(id);
  }

  function getUserById(userId) {
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    return formatUser(row);
  }

  function registerUser({ username, email, passwordHash }) {
    const cleanUsername = sanitizeUsername(username);
    const cleanEmail = String(email || '').trim().toLowerCase();
    if (cleanUsername.length < 3) {
      throw new Error('Username must be at least 3 alphanumeric characters');
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      throw new Error('Please enter a valid email address');
    }

    const existingEmail = db
      .prepare('SELECT id FROM users WHERE lower(email) = lower(?)')
      .get(cleanEmail);
    if (existingEmail) {
      throw new Error('An account with this email already exists. Please sign in.');
    }

    const existingUsername = db
      .prepare('SELECT id, is_bot FROM users WHERE lower(username) = lower(?)')
      .get(cleanUsername);
    if (existingUsername) {
      throw new Error(
        existingUsername.is_bot
          ? 'That username is reserved. Please pick another handle.'
          : 'That username is already taken. Please pick another handle.'
      );
    }

    const id = `usr_${crypto.randomBytes(6).toString('hex')}`;
    const avatarColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
    const now = Date.now();

    runTransaction(() => {
      db.prepare(`
        INSERT INTO users (id, username, email, password_hash, avatar_color, balance_cents, is_bot, created_at)
        VALUES (?, ?, ?, ?, ?, 0, 0, ?)
      `).run(id, cleanUsername, cleanEmail, passwordHash, avatarColor, now);
    });

    return getUserById(id);
  }

  function findAuthUser(identifier) {
    const clean = String(identifier || '').trim().toLowerCase();
    if (!clean) return null;
    const row = db
      .prepare(
        'SELECT * FROM users WHERE is_bot = 0 AND (lower(email) = ? OR lower(username) = ?) LIMIT 1'
      )
      .get(clean, clean);
    if (!row) return null;
    return {
      user: formatUser(row),
      passwordHash: row.password_hash || null,
    };
  }

  function topUpUser(userId, amountCents) {
    return runTransaction(() => {
      const row = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
      if (!row) throw new Error('User not found');
      const nextBalance = Number(row.balance_cents) + amountCents;
      const now = Date.now();
      db.prepare('UPDATE users SET balance_cents = ? WHERE id = ?').run(nextBalance, userId);
      db.prepare(`
        INSERT INTO wallet_transactions (id, user_id, type, amount_cents, balance_after_cents, round_id, note, created_at)
        VALUES (?, ?, 'DEPOSIT', ?, ?, NULL, 'Virtual wallet top-up', ?)
      `).run(
        `tx_${crypto.randomBytes(6).toString('hex')}`,
        userId,
        amountCents,
        nextBalance,
        now
      );
      return getUserById(userId);
    });
  }

  function debitStakeAndCreateBet({
    betId,
    roundId,
    roundNumber,
    symbol,
    timeframe,
    tierCents,
    userId,
    direction,
    createdAt,
  }) {
    return runTransaction(() => {
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
      if (!user) throw new Error('Player account not found');

      let currentBalance = Number(user.balance_cents);
      if (user.is_bot && currentBalance < tierCents * 10) {
        currentBalance += 5_000_000;
        db.prepare('UPDATE users SET balance_cents = ? WHERE id = ?').run(currentBalance, userId);
      }

      if (currentBalance < tierCents) {
        throw new Error('Insufficient balance. Use the +$500 top-up button to add virtual funds.');
      }

      const existingBet = db
        .prepare('SELECT id FROM bets WHERE round_id = ? AND user_id = ?')
        .get(roundId, userId);
      if (existingBet) {
        throw new Error('You have already placed a prediction for this round');
      }

      const nextBalance = currentBalance - tierCents;
      db.prepare(`
        UPDATE users
        SET balance_cents = ?, total_bets = total_bets + 1, total_wagered_cents = total_wagered_cents + ?
        WHERE id = ?
      `).run(nextBalance, tierCents, userId);

      db.prepare(`
        INSERT INTO bets (
          id, round_id, round_number, symbol, timeframe, tier_cents,
          user_id, username, avatar_color, is_bot, direction, stake_cents,
          payout_cents, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'PENDING', ?)
      `).run(
        betId,
        roundId,
        roundNumber,
        symbol,
        timeframe,
        tierCents,
        user.id,
        user.username,
        user.avatar_color,
        user.is_bot,
        direction,
        tierCents,
        createdAt
      );

      if (!user.is_bot) {
        db.prepare(`
          INSERT INTO wallet_transactions (id, user_id, type, amount_cents, balance_after_cents, round_id, note, created_at)
          VALUES (?, ?, 'BET_STAKE', ?, ?, ?, ?, ?)
        `).run(
          `tx_${crypto.randomBytes(6).toString('hex')}`,
          user.id,
          -tierCents,
          nextBalance,
          roundId,
          `${symbol} ${timeframe} #${roundNumber} (${direction})`,
          createdAt
        );
      }

      return {
        user: getUserById(user.id),
        bet: {
          id: betId,
          roundId,
          roundNumber,
          symbol,
          timeframe,
          tierCents,
          userId: user.id,
          username: user.username,
          avatarColor: user.avatar_color,
          isBot: Boolean(user.is_bot),
          direction,
          stakeCents: tierCents,
          payoutCents: 0,
          status: 'PENDING',
          createdAt,
        },
      };
    });
  }

  function recordRoundSettlement(settlement) {
    return runTransaction(() => {
      const now = settlement.settledAt;

      db.prepare(`
        INSERT OR REPLACE INTO settled_rounds (
          id, round_number, symbol, category, timeframe, tier_cents,
          lock_time, close_time, lock_price, close_price, outcome,
          player_count, up_count, down_count, total_pool_cents,
          master_fee_cents, distributable_pool_cents, winner_count,
          payout_per_winner_cents, tx_ref, settled_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        settlement.roundId,
        settlement.roundNumber,
        settlement.symbol,
        settlement.category,
        settlement.timeframe,
        settlement.tierCents,
        settlement.lockTime,
        settlement.closeTime,
        settlement.lockPrice,
        settlement.closePrice,
        settlement.outcome,
        settlement.playerCount,
        settlement.upCount,
        settlement.downCount,
        settlement.totalPoolCents,
        settlement.masterFeeCents,
        settlement.distributablePoolCents,
        settlement.winnerCount,
        settlement.payoutPerWinnerCents,
        settlement.txRef,
        now
      );

      const updateBetStmt = db.prepare(`
        UPDATE bets SET status = ?, payout_cents = ?, settled_at = ? WHERE id = ?
      `);
      const getUserBalStmt = db.prepare('SELECT balance_cents, is_bot FROM users WHERE id = ?');
      const creditWinStmt = db.prepare(`
        UPDATE users
        SET balance_cents = balance_cents + ?, total_wins = total_wins + 1, total_won_cents = total_won_cents + ?
        WHERE id = ?
      `);
      const creditRefundStmt = db.prepare(`
        UPDATE users
        SET balance_cents = balance_cents + ?, total_won_cents = total_won_cents + ?
        WHERE id = ?
      `);
      const insertTxStmt = db.prepare(`
        INSERT INTO wallet_transactions (id, user_id, type, amount_cents, balance_after_cents, round_id, note, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const updatedUsers = new Map();

      for (const p of settlement.players) {
        updateBetStmt.run(p.status, p.payoutCents, now, p.betId);

        if (p.payoutCents > 0) {
          const uRow = getUserBalStmt.get(p.userId);
          if (!uRow) continue;
          const nextBal = Number(uRow.balance_cents) + p.payoutCents;

          if (p.status === 'WON') {
            creditWinStmt.run(p.payoutCents, p.payoutCents, p.userId);
            if (!uRow.is_bot) {
              insertTxStmt.run(
                `tx_${crypto.randomBytes(6).toString('hex')}`,
                p.userId,
                'WIN_PAYOUT',
                p.payoutCents,
                nextBal,
                settlement.roundId,
                `Won ${settlement.symbol} ${settlement.timeframe} #${settlement.roundNumber} (equal split)`,
                now
              );
              updatedUsers.set(p.userId, nextBal);
            }
          } else if (p.status === 'REFUNDED') {
            creditRefundStmt.run(p.payoutCents, p.payoutCents, p.userId);
            if (!uRow.is_bot) {
              insertTxStmt.run(
                `tx_${crypto.randomBytes(6).toString('hex')}`,
                p.userId,
                'REFUND',
                p.payoutCents,
                nextBal,
                settlement.roundId,
                `Refund ${settlement.symbol} ${settlement.timeframe} #${settlement.roundNumber} (${settlement.outcome})`,
                now
              );
              updatedUsers.set(p.userId, nextBal);
            }
          }
        }
      }

      if (settlement.masterFeeCents > 0) {
        db.prepare(`
          INSERT INTO master_wallet_ledger (
            id, round_id, round_number, symbol, category, timeframe, tier_cents,
            total_pool_cents, fee_cents, dust_cents, distributable_cents,
            winner_count, payout_per_winner_cents, tx_ref, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          `mw_${crypto.randomBytes(6).toString('hex')}`,
          settlement.roundId,
          settlement.roundNumber,
          settlement.symbol,
          settlement.category,
          settlement.timeframe,
          settlement.tierCents,
          settlement.totalPoolCents,
          settlement.masterFeeCents,
          settlement.dustCents || 0,
          settlement.distributablePoolCents,
          settlement.winnerCount,
          settlement.payoutPerWinnerCents,
          settlement.txRef,
          now
        );
      }

      return updatedUsers;
    });
  }

  function hydrateRoundWithPlayers(row) {
    if (!row) return null;
    const betRows = db
      .prepare('SELECT * FROM bets WHERE round_id = ? ORDER BY created_at ASC')
      .all(row.id);

    const players = betRows.map((b) => ({
      betId: b.id,
      userId: b.user_id,
      username: b.username,
      avatarColor: b.avatar_color,
      isBot: Boolean(b.is_bot),
      direction: b.direction,
      stakeCents: Number(b.stake_cents),
      payoutCents: Number(b.payout_cents),
      status: b.status,
      createdAt: Number(b.created_at),
    }));

    return {
      roundId: row.id,
      roundNumber: Number(row.round_number),
      symbol: row.symbol,
      category: row.category,
      timeframe: row.timeframe,
      tierCents: Number(row.tier_cents),
      lockTime: Number(row.lock_time),
      closeTime: Number(row.close_time),
      lockPrice: Number(row.lock_price),
      closePrice: Number(row.close_price),
      outcome: row.outcome,
      playerCount: Number(row.player_count),
      upCount: Number(row.up_count),
      downCount: Number(row.down_count),
      totalPoolCents: Number(row.total_pool_cents),
      masterFeeCents: Number(row.master_fee_cents),
      distributablePoolCents: Number(row.distributable_pool_cents),
      winnerCount: Number(row.winner_count),
      payoutPerWinnerCents: Number(row.payout_per_winner_cents),
      txRef: row.tx_ref,
      settledAt: Number(row.settled_at),
      players,
      winners: players.filter((p) => p.status === 'WON'),
    };
  }

  function getRecentRounds({ symbol, timeframe, tierCents, limit = 20 } = {}) {
    const clauses = [];
    const params = [];
    if (symbol) {
      clauses.push('symbol = ?');
      params.push(symbol);
    }
    if (timeframe) {
      clauses.push('timeframe = ?');
      params.push(timeframe);
    }
    if (tierCents) {
      clauses.push('tier_cents = ?');
      params.push(Number(tierCents));
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = db
      .prepare(`SELECT * FROM settled_rounds ${where} ORDER BY settled_at DESC LIMIT ?`)
      .all(...params, limit);

    return rows.map(hydrateRoundWithPlayers);
  }

  function getUserBets(userId, limit = 40) {
    const rows = db
      .prepare(`
        SELECT b.*, r.lock_price, r.close_price, r.outcome, r.total_pool_cents,
               r.master_fee_cents, r.winner_count, r.payout_per_winner_cents
        FROM bets b
        LEFT JOIN settled_rounds r ON r.id = b.round_id
        WHERE b.user_id = ?
        ORDER BY b.created_at DESC
        LIMIT ?
      `)
      .all(userId, limit);

    return rows.map((b) => ({
      betId: b.id,
      roundId: b.round_id,
      roundNumber: Number(b.round_number),
      symbol: b.symbol,
      timeframe: b.timeframe,
      tierCents: Number(b.tier_cents),
      direction: b.direction,
      stakeCents: Number(b.stake_cents),
      payoutCents: Number(b.payout_cents),
      status: b.status,
      lockPrice: b.lock_price != null ? Number(b.lock_price) : null,
      closePrice: b.close_price != null ? Number(b.close_price) : null,
      outcome: b.outcome || null,
      totalPoolCents: b.total_pool_cents != null ? Number(b.total_pool_cents) : null,
      masterFeeCents: b.master_fee_cents != null ? Number(b.master_fee_cents) : null,
      winnerCount: b.winner_count != null ? Number(b.winner_count) : null,
      createdAt: Number(b.created_at),
      settledAt: b.settled_at != null ? Number(b.settled_at) : null,
    }));
  }

  function getMasterWalletSummary(limit = 50) {
    const totals = db
      .prepare(`
        SELECT
          COALESCE(SUM(fee_cents + dust_cents), 0) AS total_balance_cents,
          COALESCE(SUM(fee_cents), 0) AS total_fee_cents,
          COALESCE(SUM(dust_cents), 0) AS total_dust_cents,
          COALESCE(SUM(total_pool_cents), 0) AS total_volume_cents,
          COALESCE(SUM(distributable_cents - dust_cents), 0) AS total_distributed_cents,
          COUNT(*) AS settled_rounds_count
        FROM master_wallet_ledger
      `)
      .get();

    const byCategory = db
      .prepare(`
        SELECT
          category,
          COUNT(*) AS rounds_count,
          COALESCE(SUM(total_pool_cents), 0) AS volume_cents,
          COALESCE(SUM(fee_cents + dust_cents), 0) AS fee_cents
        FROM master_wallet_ledger
        GROUP BY category
      `)
      .all();

    const byTimeframe = db
      .prepare(`
        SELECT
          timeframe,
          COUNT(*) AS rounds_count,
          COALESCE(SUM(total_pool_cents), 0) AS volume_cents,
          COALESCE(SUM(fee_cents + dust_cents), 0) AS fee_cents
        FROM master_wallet_ledger
        GROUP BY timeframe
      `)
      .all();

    const ledger = db
      .prepare(`
        SELECT * FROM master_wallet_ledger
        ORDER BY created_at DESC
        LIMIT ?
      `)
      .all(limit)
      .map((row) => ({
        id: row.id,
        roundId: row.round_id,
        roundNumber: Number(row.round_number),
        symbol: row.symbol,
        category: row.category,
        timeframe: row.timeframe,
        tierCents: Number(row.tier_cents),
        totalPoolCents: Number(row.total_pool_cents),
        feeCents: Number(row.fee_cents),
        dustCents: Number(row.dust_cents),
        totalMasterCreditCents: Number(row.fee_cents) + Number(row.dust_cents),
        distributableCents: Number(row.distributable_cents),
        winnerCount: Number(row.winner_count),
        payoutPerWinnerCents: Number(row.payout_per_winner_cents),
        txRef: row.tx_ref,
        createdAt: Number(row.created_at),
      }));

    const origTotals = db
      .prepare(`
        SELECT
          COALESCE(SUM(stake_cents), 0) AS total_wagered_cents,
          COALESCE(SUM(payout_cents), 0) AS total_payout_cents,
          COALESCE(SUM(house_delta_cents), 0) AS net_house_cents,
          COUNT(*) AS total_bets_count
        FROM originals_bets
      `)
      .get();

    const origByGame = db
      .prepare(`
        SELECT
          game,
          COUNT(*) AS bets_count,
          COALESCE(SUM(stake_cents), 0) AS wagered_cents,
          COALESCE(SUM(payout_cents), 0) AS payout_cents,
          COALESCE(SUM(house_delta_cents), 0) AS house_delta_cents
        FROM originals_bets
        GROUP BY game
        ORDER BY wagered_cents DESC
      `)
      .all();

    const originalsLedger = db
      .prepare(`
        SELECT * FROM originals_bets
        ORDER BY created_at DESC
        LIMIT ?
      `)
      .all(Math.min(limit, 50))
      .map((row) => ({
        id: row.id,
        userId: row.user_id,
        username: row.username,
        avatarColor: row.avatar_color,
        isBot: Boolean(row.is_bot),
        game: row.game,
        stakeCents: Number(row.stake_cents),
        multiplier: Number(row.multiplier),
        payoutCents: Number(row.payout_cents),
        houseDeltaCents: Number(row.house_delta_cents),
        status: row.status,
        serverSeedHash: row.server_seed_hash,
        clientSeed: row.client_seed,
        nonce: row.nonce != null ? Number(row.nonce) : null,
        createdAt: Number(row.created_at),
      }));

    const predictionBalance = Number(totals.total_balance_cents);
    const originalsNetHouse = Number(origTotals.net_house_cents);

    return {
      address: MASTER_WALLET_ADDRESS,
      feeRatePercent: 10,
      totalBalanceCents: predictionBalance,
      combinedTreasuryCents: predictionBalance + originalsNetHouse,
      totalFeeCents: Number(totals.total_fee_cents),
      totalDustCents: Number(totals.total_dust_cents),
      totalVolumeCents: Number(totals.total_volume_cents),
      totalDistributedCents: Number(totals.total_distributed_cents),
      settledRoundsCount: Number(totals.settled_rounds_count),
      byCategory: byCategory.map((r) => ({
        category: r.category,
        roundsCount: Number(r.rounds_count),
        volumeCents: Number(r.volume_cents),
        feeCents: Number(r.fee_cents),
      })),
      byTimeframe: byTimeframe.map((r) => ({
        timeframe: r.timeframe,
        roundsCount: Number(r.rounds_count),
        volumeCents: Number(r.volume_cents),
        feeCents: Number(r.fee_cents),
      })),
      ledger,
      originals: {
        totalWageredCents: Number(origTotals.total_wagered_cents),
        totalPayoutCents: Number(origTotals.total_payout_cents),
        netHouseCents: originalsNetHouse,
        totalBetsCount: Number(origTotals.total_bets_count),
        byGame: origByGame.map((g) => ({
          game: g.game,
          betsCount: Number(g.bets_count),
          wageredCents: Number(g.wagered_cents),
          payoutCents: Number(g.payout_cents),
          houseDeltaCents: Number(g.house_delta_cents),
        })),
        ledger: originalsLedger,
      },
    };
  }

  function getOrCreateUserSeed(userId) {
    let row = db.prepare('SELECT * FROM user_seeds WHERE user_id = ?').get(userId);
    if (!row) {
      const serverSeed = crypto.randomBytes(32).toString('hex');
      const clientSeed = `pulse_${crypto.randomBytes(6).toString('hex')}`;
      const now = Date.now();
      db.prepare(`
        INSERT INTO user_seeds (user_id, server_seed, client_seed, nonce, updated_at)
        VALUES (?, ?, ?, 0, ?)
      `).run(userId, serverSeed, clientSeed, now);
      row = db.prepare('SELECT * FROM user_seeds WHERE user_id = ?').get(userId);
    }
    return {
      userId: row.user_id,
      serverSeed: row.server_seed,
      serverSeedHash: crypto.createHash('sha256').update(row.server_seed).digest('hex'),
      clientSeed: row.client_seed,
      nonce: Number(row.nonce),
    };
  }

  function consumeUserNonce(userId) {
    return runTransaction(() => {
      const seed = getOrCreateUserSeed(userId);
      const nextNonce = seed.nonce + 1;
      db.prepare('UPDATE user_seeds SET nonce = ?, updated_at = ? WHERE user_id = ?').run(
        nextNonce,
        Date.now(),
        userId
      );
      return { ...seed, nonce: nextNonce };
    });
  }

  function rotateUserSeed(userId, nextClientSeed) {
    return runTransaction(() => {
      const previous = getOrCreateUserSeed(userId);
      const serverSeed = crypto.randomBytes(32).toString('hex');
      const cleanClient =
        String(nextClientSeed || '').trim().slice(0, 40) || previous.clientSeed;
      db.prepare(`
        UPDATE user_seeds
        SET server_seed = ?, client_seed = ?, nonce = 0, updated_at = ?
        WHERE user_id = ?
      `).run(serverSeed, cleanClient, Date.now(), userId);

      const current = getOrCreateUserSeed(userId);
      return {
        revealedPreviousServerSeed: previous.serverSeed,
        previousServerSeedHash: previous.serverSeedHash,
        current: {
          serverSeedHash: current.serverSeedHash,
          clientSeed: current.clientSeed,
          nonce: current.nonce,
        },
      };
    });
  }

  function debitUserStake(userId, stakeCents, note) {
    return runTransaction(() => {
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
      if (!user) throw new Error('Player account not found');
      if (!Number.isInteger(stakeCents) || stakeCents < 100) {
        throw new Error('Minimum bet is $1.00');
      }
      if (stakeCents > 10_000_000) {
        throw new Error('Maximum bet is $100,000.00');
      }

      let bal = Number(user.balance_cents);
      if (user.is_bot && bal < stakeCents * 10) {
        bal += 5_000_000;
        db.prepare('UPDATE users SET balance_cents = ? WHERE id = ?').run(bal, userId);
      }
      if (bal < stakeCents) {
        throw new Error('Insufficient balance. Tap +500 in the header to top up.');
      }

      const nextBal = bal - stakeCents;
      const now = Date.now();
      db.prepare(`
        UPDATE users
        SET balance_cents = ?, total_bets = total_bets + 1, total_wagered_cents = total_wagered_cents + ?
        WHERE id = ?
      `).run(nextBal, stakeCents, userId);

      if (!user.is_bot) {
        db.prepare(`
          INSERT INTO wallet_transactions (id, user_id, type, amount_cents, balance_after_cents, round_id, note, created_at)
          VALUES (?, ?, 'ORIGINALS_STAKE', ?, ?, NULL, ?, ?)
        `).run(
          `tx_${crypto.randomBytes(6).toString('hex')}`,
          userId,
          -stakeCents,
          nextBal,
          note || 'PULSE Originals bet',
          now
        );
      }

      return getUserById(userId);
    });
  }

  function settleOriginalBet({
    userId,
    game,
    stakeCents,
    multiplier,
    payoutCents,
    status,
    details,
    serverSeedHash,
    clientSeed,
    nonce,
    alreadyDebited = false,
  }) {
    return runTransaction(() => {
      const userRow = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
      if (!userRow) throw new Error('Player account not found');

      const now = Date.now();
      let bal = Number(userRow.balance_cents);

      if (!alreadyDebited) {
        if (userRow.is_bot && bal < stakeCents * 10) {
          bal += 5_000_000;
          db.prepare('UPDATE users SET balance_cents = ? WHERE id = ?').run(bal, userId);
        }
        if (bal < stakeCents) {
          throw new Error('Insufficient balance. Tap +500 in the header to top up.');
        }
        bal -= stakeCents;
        db.prepare(`
          UPDATE users
          SET balance_cents = ?, total_bets = total_bets + 1, total_wagered_cents = total_wagered_cents + ?
          WHERE id = ?
        `).run(bal, stakeCents, userId);
      }

      const cleanPayout = Math.max(0, Math.floor(payoutCents));
      const isWin = cleanPayout > 0 && status === 'WON';
      const nextBal = bal + cleanPayout;

      if (cleanPayout > 0) {
        db.prepare(`
          UPDATE users
          SET balance_cents = ?,
              total_wins = total_wins + ?,
              total_won_cents = total_won_cents + ?
          WHERE id = ?
        `).run(nextBal, isWin ? 1 : 0, cleanPayout, userId);
      }

      const betId = `orig_${crypto.randomBytes(6).toString('hex')}`;
      const houseDeltaCents = stakeCents - cleanPayout;

      db.prepare(`
        INSERT INTO originals_bets (
          id, user_id, username, avatar_color, is_bot, game,
          stake_cents, multiplier, payout_cents, house_delta_cents,
          status, details_json, server_seed_hash, client_seed, nonce, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        betId,
        userRow.id,
        userRow.username,
        userRow.avatar_color,
        userRow.is_bot,
        game,
        stakeCents,
        Number(multiplier || 0),
        cleanPayout,
        houseDeltaCents,
        status,
        JSON.stringify(details || {}),
        serverSeedHash || null,
        clientSeed || null,
        nonce != null ? nonce : null,
        now
      );

      if (!userRow.is_bot && cleanPayout > 0) {
        db.prepare(`
          INSERT INTO wallet_transactions (id, user_id, type, amount_cents, balance_after_cents, round_id, note, created_at)
          VALUES (?, ?, 'ORIGINALS_WIN', ?, ?, ?, ?, ?)
        `).run(
          `tx_${crypto.randomBytes(6).toString('hex')}`,
          userId,
          cleanPayout,
          nextBal,
          betId,
          `${game.toUpperCase()} win (${Number(multiplier).toFixed(2)}x)`,
          now
        );
      }

      return {
        user: getUserById(userId),
        record: {
          id: betId,
          userId: userRow.id,
          username: userRow.username,
          avatarColor: userRow.avatar_color,
          isBot: Boolean(userRow.is_bot),
          game,
          stakeCents,
          multiplier: Number(multiplier || 0),
          payoutCents: cleanPayout,
          houseDeltaCents,
          status,
          details: details || {},
          serverSeedHash: serverSeedHash || null,
          clientSeed: clientSeed || null,
          nonce: nonce != null ? nonce : null,
          createdAt: now,
        },
      };
    });
  }

  function getRecentOriginalsBets({ game, userId, limit = 25 } = {}) {
    const clauses = [];
    const params = [];
    if (game) {
      clauses.push('game = ?');
      params.push(game);
    }
    if (userId) {
      clauses.push('user_id = ?');
      params.push(userId);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = db
      .prepare(`SELECT * FROM originals_bets ${where} ORDER BY created_at DESC LIMIT ?`)
      .all(...params, limit);

    return rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      username: row.username,
      avatarColor: row.avatar_color,
      isBot: Boolean(row.is_bot),
      game: row.game,
      stakeCents: Number(row.stake_cents),
      multiplier: Number(row.multiplier),
      payoutCents: Number(row.payout_cents),
      houseDeltaCents: Number(row.house_delta_cents),
      status: row.status,
      details: row.details_json ? JSON.parse(row.details_json) : {},
      serverSeedHash: row.server_seed_hash,
      clientSeed: row.client_seed,
      nonce: row.nonce != null ? Number(row.nonce) : null,
      createdAt: Number(row.created_at),
    }));
  }

  function formatPaymentRow(row) {
    if (!row) return null;
    return {
      id: row.id,
      userId: row.user_id,
      type: row.type,
      rail: row.rail,
      provider: row.provider,
      asset: row.asset,
      amountCents: Number(row.amount_cents),
      feeCents: Number(row.fee_cents),
      netCents: Number(row.net_cents),
      destination: row.destination || null,
      providerRef: row.provider_ref,
      status: row.status,
      metadata: row.metadata_json ? JSON.parse(row.metadata_json) : {},
      createdAt: Number(row.created_at),
      updatedAt: Number(row.updated_at),
    };
  }

  function createDepositRecord({
    id,
    userId,
    rail,
    provider,
    asset,
    amountCents,
    feeCents,
    netCents,
    destination,
    providerRef,
    metadata,
  }) {
    const now = Date.now();
    db.prepare(`
      INSERT INTO payment_transactions (
        id, user_id, type, rail, provider, asset,
        amount_cents, fee_cents, net_cents, destination,
        provider_ref, status, metadata_json, created_at, updated_at
      ) VALUES (?, ?, 'DEPOSIT', ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?)
    `).run(
      id,
      userId,
      rail,
      provider,
      asset,
      amountCents,
      feeCents,
      netCents,
      destination || null,
      providerRef,
      JSON.stringify(metadata || {}),
      now,
      now
    );
    return formatPaymentRow(
      db.prepare('SELECT * FROM payment_transactions WHERE id = ?').get(id)
    );
  }

  function completeDepositRecord(transactionId, externalTxHash) {
    return runTransaction(() => {
      const row = db
        .prepare('SELECT * FROM payment_transactions WHERE id = ?')
        .get(transactionId);
      if (!row) throw new Error('Deposit transaction not found');
      if (row.type !== 'DEPOSIT') throw new Error('Transaction is not a deposit');
      if (row.status === 'COMPLETED') {
        return {
          alreadyCompleted: true,
          transaction: formatPaymentRow(row),
          user: getUserById(row.user_id),
        };
      }
      if (row.status !== 'PENDING' && row.status !== 'PROCESSING') {
        throw new Error(`Deposit cannot be completed from status ${row.status}`);
      }

      const userRow = db.prepare('SELECT * FROM users WHERE id = ?').get(row.user_id);
      if (!userRow) throw new Error('User not found');

      const now = Date.now();
      const nextBal = Number(userRow.balance_cents) + Number(row.net_cents);
      const nextRef = externalTxHash || row.provider_ref;

      db.prepare(`
        UPDATE payment_transactions
        SET status = 'COMPLETED', provider_ref = ?, updated_at = ?
        WHERE id = ?
      `).run(nextRef, now, transactionId);

      db.prepare('UPDATE users SET balance_cents = ? WHERE id = ?').run(
        nextBal,
        row.user_id
      );

      db.prepare(`
        INSERT INTO wallet_transactions (id, user_id, type, amount_cents, balance_after_cents, round_id, note, created_at)
        VALUES (?, ?, 'DEPOSIT', ?, ?, ?, ?, ?)
      `).run(
        `tx_${crypto.randomBytes(6).toString('hex')}`,
        row.user_id,
        Number(row.net_cents),
        nextBal,
        transactionId,
        `Deposit via ${row.asset} (${row.provider})`,
        now
      );

      return {
        alreadyCompleted: false,
        transaction: formatPaymentRow(
          db.prepare('SELECT * FROM payment_transactions WHERE id = ?').get(transactionId)
        ),
        user: getUserById(row.user_id),
      };
    });
  }

  function createWithdrawalRecord({
    id,
    userId,
    rail,
    provider,
    asset,
    amountCents,
    feeCents,
    netCents,
    destination,
    providerRef,
    metadata,
  }) {
    return runTransaction(() => {
      const userRow = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
      if (!userRow) throw new Error('Player account not found');
      const currentBal = Number(userRow.balance_cents);
      if (currentBal < amountCents) {
        throw new Error('Insufficient wallet balance for this withdrawal.');
      }

      const nextBal = currentBal - amountCents;
      const now = Date.now();

      db.prepare('UPDATE users SET balance_cents = ? WHERE id = ?').run(nextBal, userId);

      db.prepare(`
        INSERT INTO payment_transactions (
          id, user_id, type, rail, provider, asset,
          amount_cents, fee_cents, net_cents, destination,
          provider_ref, status, metadata_json, created_at, updated_at
        ) VALUES (?, ?, 'WITHDRAWAL', ?, ?, ?, ?, ?, ?, ?, ?, 'PROCESSING', ?, ?, ?)
      `).run(
        id,
        userId,
        rail,
        provider,
        asset,
        amountCents,
        feeCents,
        netCents,
        destination,
        providerRef,
        JSON.stringify(metadata || {}),
        now,
        now
      );

      db.prepare(`
        INSERT INTO wallet_transactions (id, user_id, type, amount_cents, balance_after_cents, round_id, note, created_at)
        VALUES (?, ?, 'WITHDRAWAL', ?, ?, ?, ?, ?)
      `).run(
        `tx_${crypto.randomBytes(6).toString('hex')}`,
        userId,
        -amountCents,
        nextBal,
        id,
        `Withdrawal via ${asset} to ${String(destination).slice(0, 18)}`,
        now
      );

      return {
        transaction: formatPaymentRow(
          db.prepare('SELECT * FROM payment_transactions WHERE id = ?').get(id)
        ),
        user: getUserById(userId),
      };
    });
  }

  function updateWithdrawalStatus(transactionId, status, externalTxHash) {
    return runTransaction(() => {
      const row = db
        .prepare('SELECT * FROM payment_transactions WHERE id = ?')
        .get(transactionId);
      if (!row) throw new Error('Withdrawal not found');
      if (row.type !== 'WITHDRAWAL') throw new Error('Not a withdrawal');
      if (row.status === 'COMPLETED' || row.status === 'FAILED' || row.status === 'CANCELLED') {
        return {
          transaction: formatPaymentRow(row),
          user: getUserById(row.user_id),
        };
      }

      const now = Date.now();
      const nextRef = externalTxHash || row.provider_ref;
      db.prepare(`
        UPDATE payment_transactions
        SET status = ?, provider_ref = ?, updated_at = ?
        WHERE id = ?
      `).run(status, nextRef, now, transactionId);

      // Refund user automatically if withdrawal failed or was cancelled
      if (status === 'FAILED' || status === 'CANCELLED') {
        const userRow = db.prepare('SELECT balance_cents FROM users WHERE id = ?').get(row.user_id);
        if (userRow) {
          const refundedBal = Number(userRow.balance_cents) + Number(row.amount_cents);
          db.prepare('UPDATE users SET balance_cents = ? WHERE id = ?').run(
            refundedBal,
            row.user_id
          );
          db.prepare(`
            INSERT INTO wallet_transactions (id, user_id, type, amount_cents, balance_after_cents, round_id, note, created_at)
            VALUES (?, ?, 'WITHDRAWAL_REFUND', ?, ?, ?, ?, ?)
          `).run(
            `tx_${crypto.randomBytes(6).toString('hex')}`,
            row.user_id,
            Number(row.amount_cents),
            refundedBal,
            transactionId,
            `Withdrawal ${status.toLowerCase()} refund`,
            now
          );
        }
      }

      return {
        transaction: formatPaymentRow(
          db.prepare('SELECT * FROM payment_transactions WHERE id = ?').get(transactionId)
        ),
        user: getUserById(row.user_id),
      };
    });
  }

  function getUserPayments(userId, limit = 30) {
    const rows = db
      .prepare(`
        SELECT * FROM payment_transactions
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT ?
      `)
      .all(userId, limit);
    return rows.map(formatPaymentRow);
  }

  function getPaymentById(transactionId) {
    return formatPaymentRow(
      db.prepare('SELECT * FROM payment_transactions WHERE id = ?').get(transactionId)
    );
  }

  function getLeaderboard(limit = 25) {
    const rows = db
      .prepare(`
        SELECT * FROM users
        WHERE total_bets > 0
        ORDER BY (total_won_cents - total_wagered_cents) DESC, total_wins DESC
        LIMIT ?
      `)
      .all(limit);

    return rows.map(formatUser);
  }

  function close() {
    db.close();
  }

  return {
    db,
    ensureBots,
    getOrCreateUser,
    registerUser,
    findAuthUser,
    getUserById,
    topUpUser,
    debitStakeAndCreateBet,
    recordRoundSettlement,
    getRecentRounds,
    getUserBets,
    getMasterWalletSummary,
    getOrCreateUserSeed,
    consumeUserNonce,
    rotateUserSeed,
    debitUserStake,
    settleOriginalBet,
    getRecentOriginalsBets,
    createDepositRecord,
    completeDepositRecord,
    createWithdrawalRecord,
    updateWithdrawalStatus,
    getUserPayments,
    getPaymentById,
    getLeaderboard,
    close,
  };
}

module.exports = { createDatabase };
