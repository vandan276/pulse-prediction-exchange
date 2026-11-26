const EventEmitter = require('events');
const crypto = require('crypto');

const PAYMENT_METHODS = [
  // Primary Live Gateway Rail — USDTautopay (BEP-20)
  {
    id: 'USDT-BEP20',
    rail: 'CRYPTO',
    label: 'USDT (BEP-20)',
    network: 'BSC Mainnet · USDTautopay',
    minDepositCents: 500, // $5.00
    maxDepositCents: 10_000_000, // $100,000
    minWithdrawCents: 1000, // $10.00
    maxWithdrawCents: 5_000_000,
    depositFeeFlatCents: 0,
    withdrawFeeFlatCents: 100, // $1.00
    eta: '~1–3 mins (15 conf)',
    placeholder: '0x... (BSC BEP-20 wallet address)',
    liveGateway: true,
  },
  // Additional Rails (Sandbox / Future Providers)
  {
    id: 'USDT-TRC20',
    rail: 'CRYPTO',
    label: 'USDT (TRC20)',
    network: 'TRON',
    minDepositCents: 1000,
    maxDepositCents: 10_000_000,
    minWithdrawCents: 1000,
    maxWithdrawCents: 5_000_000,
    depositFeeFlatCents: 0,
    withdrawFeeFlatCents: 100,
    eta: '~1–3 mins',
    placeholder: 'T... (TRON TRC20 wallet address)',
    liveGateway: false,
  },
  {
    id: 'USDT-ERC20',
    rail: 'CRYPTO',
    label: 'USDT (ERC20)',
    network: 'Ethereum',
    minDepositCents: 2000,
    maxDepositCents: 10_000_000,
    minWithdrawCents: 2000,
    maxWithdrawCents: 5_000_000,
    depositFeeFlatCents: 0,
    withdrawFeeFlatCents: 300,
    eta: '~2–5 mins',
    placeholder: '0x... (Ethereum ERC20 address)',
    liveGateway: false,
  },
  {
    id: 'BTC',
    rail: 'CRYPTO',
    label: 'Bitcoin (BTC)',
    network: 'Bitcoin Mainnet',
    minDepositCents: 2000,
    maxDepositCents: 10_000_000,
    minWithdrawCents: 2500,
    maxWithdrawCents: 5_000_000,
    depositFeeFlatCents: 0,
    withdrawFeeFlatCents: 250,
    eta: '~10 mins',
    placeholder: 'bc1q... (Bitcoin address)',
    liveGateway: false,
  },
  {
    id: 'SOL',
    rail: 'CRYPTO',
    label: 'Solana (SOL)',
    network: 'Solana',
    minDepositCents: 1000,
    maxDepositCents: 10_000_000,
    minWithdrawCents: 1000,
    maxWithdrawCents: 5_000_000,
    depositFeeFlatCents: 0,
    withdrawFeeFlatCents: 25,
    eta: '~15 secs',
    placeholder: 'Solana wallet address',
    liveGateway: false,
  },
  {
    id: 'UPI',
    rail: 'UPI',
    label: 'UPI Instant',
    network: 'NPCI / Razorpay',
    minDepositCents: 1000,
    maxDepositCents: 2_500_000,
    minWithdrawCents: 1000,
    maxWithdrawCents: 2_500_000,
    depositFeeFlatCents: 0,
    withdrawFeeFlatCents: 0,
    eta: 'Instant',
    placeholder: 'yourname@upi / phone@paytm',
    liveGateway: false,
  },
  {
    id: 'CARD',
    rail: 'CARD',
    label: 'Visa / Mastercard',
    network: 'Stripe / Gateway',
    minDepositCents: 1000,
    maxDepositCents: 5_000_000,
    minWithdrawCents: 2000,
    maxWithdrawCents: 2_500_000,
    depositFeeFlatCents: 0,
    withdrawFeeFlatCents: 150,
    eta: 'Instant – 1 day',
    placeholder: 'Cardholder / Bank IBAN or Last 4',
    liveGateway: false,
  },
  {
    id: 'BANK',
    rail: 'BANK',
    label: 'Bank Transfer (IMPS / Wire)',
    network: 'Direct Bank Rail',
    minDepositCents: 2500,
    maxDepositCents: 10_000_000,
    minWithdrawCents: 2500,
    maxWithdrawCents: 10_000_000,
    depositFeeFlatCents: 0,
    withdrawFeeFlatCents: 0,
    eta: '~15 mins – 1 day',
    placeholder: 'Account No. / IFSC or Routing',
    liveGateway: false,
  },
];

const METHOD_BY_ID = Object.fromEntries(PAYMENT_METHODS.map((m) => [m.id, m]));

function generateSandboxDestination(method, userId) {
  const hash = crypto
    .createHash('sha256')
    .update(`${method.id}:${userId}:pulse_deposit`)
    .digest('hex');

  if (method.id === 'USDT-TRC20') return `T${hash.slice(0, 33).toUpperCase()}`;
  if (method.id === 'USDT-ERC20' || method.id === 'USDT-BEP20') {
    return `0x${hash.slice(0, 40)}`;
  }
  if (method.id === 'BTC') return `bc1q${hash.slice(0, 38)}`;
  if (method.id === 'SOL') return `${hash.slice(0, 44)}`;
  if (method.id === 'UPI') return `pulse.pay@${hash.slice(0, 6)}okaxis`;
  return `PULSE-GW-${hash.slice(0, 12).toUpperCase()}`;
}

class PaymentGatewayService extends EventEmitter {
  constructor({ db, env = process.env }) {
    super();
    this.db = db;
    this.provider = (env.PAYMENT_PROVIDER || 'sandbox').toLowerCase();
    this.apiBaseUrl = (env.PAYMENT_API_BASE_URL || 'https://www.usdtautopay.com').replace(/\/$/, '');
    this.publicKey = env.PAYMENT_PUBLIC_KEY || '';
    this.apiKey = env.PAYMENT_API_KEY || '';
    this.webhookSecret = env.PAYMENT_WEBHOOK_SECRET || '';
    this.appPublicUrl = (env.APP_PUBLIC_URL || 'http://localhost:4000').replace(/\/$/, '');
    this.timers = new Set();
  }

  _authHeaders(extra = {}) {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      'X-API-Key': this.apiKey,
      ...extra,
    };
  }

  _extractError(data, fallback) {
    if (!data) return fallback;
    if (typeof data.error === 'string') return data.error;
    if (data.error && typeof data.error.message === 'string') return data.error.message;
    if (typeof data.message === 'string') return data.message;
    return fallback;
  }

  isUsdtAutopayLive() {
    return this.provider === 'usdtautopay' && Boolean(this.apiKey);
  }

  getConfig() {
    const live = this.isUsdtAutopayLive();
    return {
      provider: live ? 'usdtautopay' : 'sandbox',
      isSandbox: !live,
      liveAssets: live ? ['USDT-BEP20'] : [],
      methods: PAYMENT_METHODS,
    };
  }

  stop() {
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
  }

  /**
   * Create a Deposit Session:
   * - For USDT-BEP20 when USDTautopay live keys are configured -> calls POST /api/v1/deposits/sessions
   * - For all other rails (or when in sandbox mode) -> runs clean sandbox deposit intent
   */
  async createDeposit({ userId, asset, amountCents }) {
    const method = METHOD_BY_ID[asset];
    if (!method) throw new Error(`Unsupported payment method: ${asset}`);

    const parsedAmount = Math.round(Number(amountCents));
    if (!Number.isFinite(parsedAmount) || parsedAmount < method.minDepositCents) {
      throw new Error(
        `Minimum deposit for ${method.label} is $${(method.minDepositCents / 100).toFixed(2)}`
      );
    }
    if (parsedAmount > method.maxDepositCents) {
      throw new Error(
        `Maximum deposit for ${method.label} is $${(method.maxDepositCents / 100).toLocaleString()}`
      );
    }

    const user = this.db.getUserById(userId);
    if (!user) throw new Error('Please sign in first');

    const id = `dep_${crypto.randomBytes(6).toString('hex')}`;
    const feeCents = method.depositFeeFlatCents;
    const netCents = Math.max(0, parsedAmount - feeCents);

    // LIVE USDTautopay (BEP-20) Deposit Session
    if (asset === 'USDT-BEP20' && this.isUsdtAutopayLive()) {
      const amountUsdt = (parsedAmount / 100).toFixed(2);
      const res = await fetch(`${this.apiBaseUrl}/api/v1/deposits/sessions`, {
        method: 'POST',
        headers: this._authHeaders({
          'Content-Type': 'application/json',
          'Idempotency-Key': crypto.randomUUID(),
        }),
        body: JSON.stringify({
          externalOrderId: id,
          amountUsdt,
          customerEmail: `${user.username.toLowerCase()}@pulse.exchange`,
          redirectUrl: `${this.appPublicUrl}/?deposit=${id}`,
          expiresInMinutes: 15,
        }),
      });

      const sessionData = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          this._extractError(sessionData, `USDTautopay deposit session failed (HTTP ${res.status})`)
        );
      }

      const transaction = this.db.createDepositRecord({
        id,
        userId,
        rail: method.rail,
        provider: 'usdtautopay',
        asset: method.id,
        amountCents: parsedAmount,
        feeCents,
        netCents,
        destination: sessionData.depositAddress || sessionData.qrData,
        providerRef: sessionData.sessionId || id,
        metadata: {
          sessionId: sessionData.sessionId,
          checkoutUrl: sessionData.checkoutUrl,
          network: sessionData.network || 'BEP20',
          token: sessionData.token || 'USDT',
          tokenContract: sessionData.tokenContract || null,
          confirmations: sessionData.confirmations ?? 0,
          requiredConfirmations: sessionData.requiredConfirmations ?? 15,
          expiresAt: sessionData.expiresAt || null,
          eta: method.eta,
          isLive: true,
        },
      });

      this.emit('paymentUpdated', { userId, transaction });
      return { transaction, isSandbox: false };
    }

    // Sandbox Deposit Intent
    const providerRef = `GW-DEP-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const destination = generateSandboxDestination(method, userId);

    const transaction = this.db.createDepositRecord({
      id,
      userId,
      rail: method.rail,
      provider: 'sandbox',
      asset: method.id,
      amountCents: parsedAmount,
      feeCents,
      netCents,
      destination,
      providerRef,
      metadata: {
        network: method.network,
        eta: method.eta,
        checkoutUrl: null,
        isLive: false,
      },
    });

    this.emit('paymentUpdated', { userId, transaction });
    return { transaction, isSandbox: true };
  }

  /**
   * Sync live USDTautopay deposit status (GET /api/v1/deposits/sessions/:sessionId)
   * Automatically credits user wallet once status === CONFIRMED!
   */
  async syncDepositStatus(transactionId) {
    const tx = this.db.getPaymentById(transactionId);
    if (!tx) throw new Error('Deposit not found');
    if (tx.status === 'COMPLETED' || tx.provider !== 'usdtautopay' || !this.isUsdtAutopayLive()) {
      return { transaction: tx, user: this.db.getUserById(tx.userId) };
    }

    const sessionId = tx.metadata?.sessionId || tx.providerRef;
    const res = await fetch(`${this.apiBaseUrl}/api/v1/deposits/sessions/${encodeURIComponent(sessionId)}`, {
      headers: this._authHeaders(),
    });
    if (!res.ok) {
      return { transaction: tx, user: this.db.getUserById(tx.userId) };
    }
    const live = await res.json();
    const liveStatus = String(live.status || '').toUpperCase();

    if (liveStatus === 'CONFIRMED' || liveStatus === 'COMPLETED') {
      const done = this.db.completeDepositRecord(tx.id, live.txHash || sessionId);
      if (!done.alreadyCompleted) {
        this.emit('paymentUpdated', { userId: done.user.id, transaction: done.transaction });
        this.emit('userUpdated', done.user);
      }
      return done;
    }

    return {
      transaction: {
        ...tx,
        status: liveStatus === 'EXPIRED' ? 'FAILED' : tx.status,
        metadata: {
          ...tx.metadata,
          confirmations: live.confirmations ?? tx.metadata?.confirmations ?? 0,
          requiredConfirmations: live.requiredConfirmations ?? 15,
          liveStatus,
        },
      },
      user: this.db.getUserById(tx.userId),
    };
  }

  /**
   * Verify USDTautopay HMAC-SHA256 webhook signature:
   * Header X-Gateway-Signature format: "t=<unix_sec>,v1=<hex>"
   * Signed payload: `${timestamp}.${rawBody}`
   */
  verifyWebhookSignature(rawBody, sigHeader) {
    if (!this.webhookSecret) return true;
    if (!sigHeader || typeof sigHeader !== 'string') return false;

    const parts = Object.fromEntries(
      sigHeader.split(',').map((segment) => {
        const idx = segment.indexOf('=');
        return idx === -1 ? [segment.trim(), ''] : [segment.slice(0, idx).trim(), segment.slice(idx + 1).trim()];
      })
    );

    const timestamp = Number(parts.t);
    if (!timestamp || Math.abs(Math.floor(Date.now() / 1000) - timestamp) > 300) {
      return false;
    }
    if (!parts.v1) return false;

    const bodyStr = typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody);
    const expected = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(`${timestamp}.${bodyStr}`, 'utf8')
      .digest('hex');

    const a = Buffer.from(parts.v1, 'utf8');
    const b = Buffer.from(expected, 'utf8');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }

  /**
   * Confirm a Sandbox deposit directly (live USDTautopay deposits require webhook or on-chain sync!)
   */
  confirmDeposit({ transactionId, externalTxHash, signature, rawBody, fromWebhook = false }) {
    const existing = this.db.getPaymentById(transactionId);
    if (!existing) throw new Error('Deposit transaction not found');

    if (existing.provider === 'usdtautopay' && !fromWebhook) {
      throw new Error('Live USDTautopay deposits confirm automatically once detected on BSC Mainnet.');
    }

    if (fromWebhook && this.webhookSecret && !this.verifyWebhookSignature(rawBody, signature)) {
      throw new Error('Invalid X-Gateway-Signature webhook header');
    }

    const txHash = externalTxHash || `0x${crypto.randomBytes(16).toString('hex')}`;
    const result = this.db.completeDepositRecord(transactionId, txHash);
    if (!result.alreadyCompleted) {
      this.emit('paymentUpdated', { userId: result.user.id, transaction: result.transaction });
      this.emit('userUpdated', result.user);
    }
    return result;
  }

  /**
   * Request a Withdrawal:
   * - For USDT-BEP20 when USDTautopay live keys are active:
   *   1. Verifies beneficiary on BSC Mainnet via POST /api/v1/beneficiaries/verify
   *   2. Atomically debits PULSE wallet & queues 2-hop payout via POST /api/v1/payouts
   *   3. Refunds wallet immediately if gateway rejects the payout
   * - For other rails (sandbox) -> settles cleanly in ~2.2s
   */
  async requestWithdrawal({ userId, asset, amountCents, destination }) {
    const method = METHOD_BY_ID[asset];
    if (!method) throw new Error(`Unsupported payout method: ${asset}`);

    const cleanDest = String(destination || '').trim();
    if (cleanDest.length < 5) {
      throw new Error(`Enter a valid ${method.label} destination (${method.placeholder})`);
    }

    const parsedAmount = Math.round(Number(amountCents));
    if (!Number.isFinite(parsedAmount) || parsedAmount < method.minWithdrawCents) {
      throw new Error(
        `Minimum withdrawal for ${method.label} is $${(method.minWithdrawCents / 100).toFixed(2)}`
      );
    }
    if (parsedAmount > method.maxWithdrawCents) {
      throw new Error(
        `Maximum withdrawal for ${method.label} is $${(method.maxWithdrawCents / 100).toLocaleString()}`
      );
    }

    const feeCents = method.withdrawFeeFlatCents;
    const netCents = parsedAmount - feeCents;
    if (netCents <= 0) {
      throw new Error('Withdrawal amount must exceed the network fee.');
    }

    const id = `wd_${crypto.randomBytes(6).toString('hex')}`;

    // LIVE USDTautopay (BEP-20) 2-Hop Relayed Payout
    if (asset === 'USDT-BEP20' && this.isUsdtAutopayLive()) {
      // Step 1: Verify BEP-20 address live on BSC Mainnet
      const verifyRes = await fetch(`${this.apiBaseUrl}/api/v1/beneficiaries/verify`, {
        method: 'POST',
        headers: this._authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ address: cleanDest }),
      });
      const verifyData = await verifyRes.json().catch(() => ({}));
      if (!verifyRes.ok || !verifyData.valid) {
        throw new Error(
          this._extractError(
            verifyData,
            'Invalid BSC BEP-20 destination address (TRC-20, burn, and contract addresses are blocked).'
          )
        );
      }

      const checksumAddress = verifyData.checksumAddress || cleanDest;

      // Step 2: Atomically debit user wallet first
      const { transaction, user } = this.db.createWithdrawalRecord({
        id,
        userId,
        rail: method.rail,
        provider: 'usdtautopay',
        asset: method.id,
        amountCents: parsedAmount,
        feeCents,
        netCents,
        destination: checksumAddress,
        providerRef: id,
        metadata: {
          network: 'BEP20',
          eta: '10–15 minutes',
          isLive: true,
        },
      });

      // Step 3: Queue payout on USDTautopay
      try {
        const payoutRes = await fetch(`${this.apiBaseUrl}/api/v1/payouts`, {
          method: 'POST',
          headers: this._authHeaders({
            'Content-Type': 'application/json',
            'Idempotency-Key': id,
          }),
          body: JSON.stringify({
            externalPayoutId: id,
            amountUsdt: (netCents / 100).toFixed(2),
            destinationAddress: checksumAddress,
            beneficiaryLabel: user.username,
          }),
        });
        const payoutData = await payoutRes.json().catch(() => ({}));
        if (!payoutRes.ok) {
          // Gateway rejected payout (e.g. merchant ledger balance too low) -> refund user atomically!
          const refunded = this.db.updateWithdrawalStatus(id, 'FAILED');
          this.emit('userUpdated', refunded.user);
          this.emit('paymentUpdated', { userId, transaction: refunded.transaction });
          throw new Error(
            this._extractError(payoutData, `USDTautopay payout failed (HTTP ${payoutRes.status})`)
          );
        }

        const updated = this.db.updateWithdrawalStatus(
          id,
          'PROCESSING',
          payoutData.payoutId || id
        );
        this.emit('userUpdated', updated.user);
        this.emit('paymentUpdated', { userId, transaction: updated.transaction });
        return { transaction: updated.transaction, user: updated.user, isSandbox: false };
      } catch (err) {
        // Ensure user is refunded on network exception if still PROCESSING without payoutId
        const current = this.db.getPaymentById(id);
        if (current && current.status === 'PROCESSING' && current.providerRef === id) {
          const refunded = this.db.updateWithdrawalStatus(id, 'FAILED');
          this.emit('userUpdated', refunded.user);
        }
        throw err;
      }
    }

    // Sandbox Withdrawal
    const providerRef = `GW-WD-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const { transaction, user } = this.db.createWithdrawalRecord({
      id,
      userId,
      rail: method.rail,
      provider: 'sandbox',
      asset: method.id,
      amountCents: parsedAmount,
      feeCents,
      netCents,
      destination: cleanDest,
      providerRef,
      metadata: {
        network: method.network,
        eta: method.eta,
        isLive: false,
      },
    });

    this.emit('userUpdated', user);
    this.emit('paymentUpdated', { userId, transaction });

    const timer = setTimeout(() => {
      this.timers.delete(timer);
      try {
        const settledHash =
          method.rail === 'CRYPTO'
            ? `0x${crypto.randomBytes(16).toString('hex')}`
            : `UTR${Date.now().toString().slice(-10)}`;
        const done = this.db.updateWithdrawalStatus(id, 'COMPLETED', settledHash);
        this.emit('paymentUpdated', { userId, transaction: done.transaction });
      } catch {
        // ignore
      }
    }, 2200);
    this.timers.add(timer);

    return { transaction, user, isSandbox: true };
  }
}

module.exports = { PaymentGatewayService, PAYMENT_METHODS };
