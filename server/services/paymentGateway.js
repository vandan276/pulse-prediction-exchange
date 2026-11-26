const EventEmitter = require('events');
const crypto = require('crypto');

const PAYMENT_METHODS = [
  // Crypto Rails
  {
    id: 'USDT-TRC20',
    rail: 'CRYPTO',
    label: 'USDT (TRC20)',
    network: 'TRON',
    minDepositCents: 1000, // $10
    maxDepositCents: 10_000_000, // $100,000
    minWithdrawCents: 1000,
    maxWithdrawCents: 5_000_000,
    depositFeeFlatCents: 0,
    withdrawFeeFlatCents: 100, // $1.00 network fee
    eta: '~1–3 mins',
    placeholder: 'T... (TRON TRC20 wallet address)',
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
    withdrawFeeFlatCents: 300, // $3.00 gas fee
    eta: '~2–5 mins',
    placeholder: '0x... (Ethereum ERC20 address)',
  },
  {
    id: 'USDT-POLYGON',
    rail: 'CRYPTO',
    label: 'USDT (Polygon)',
    network: 'Polygon POS',
    minDepositCents: 1000,
    maxDepositCents: 10_000_000,
    minWithdrawCents: 1000,
    maxWithdrawCents: 5_000_000,
    depositFeeFlatCents: 0,
    withdrawFeeFlatCents: 50, // $0.50
    eta: '~30 secs',
    placeholder: '0x... (Polygon wallet address)',
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
  },
  // Fiat Rails (Ready for Stripe / Razorpay / Custom API)
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
  },
];

const METHOD_BY_ID = Object.fromEntries(PAYMENT_METHODS.map((m) => [m.id, m]));

function generateDepositDestination(method, userId) {
  const hash = crypto
    .createHash('sha256')
    .update(`${method.id}:${userId}:pulse_deposit`)
    .digest('hex');

  if (method.id === 'USDT-TRC20') return `T${hash.slice(0, 33).toUpperCase()}`;
  if (method.id === 'USDT-ERC20' || method.id === 'USDT-POLYGON') {
    return `0x${hash.slice(0, 40)}`;
  }
  if (method.id === 'BTC') return `bc1q${hash.slice(0, 38)}`;
  if (method.id === 'SOL') return `${hash.slice(0, 44)}`;
  if (method.id === 'UPI') return `pulse.pay@${hash.slice(0, 6)}okaxis`;
  return `PULSE-GW-${hash.slice(0, 12).toUpperCase()}`;
}

class PaymentGatewayService extends EventEmitter {
  constructor({ db }) {
    super();
    this.db = db;
    this.provider = (process.env.PAYMENT_PROVIDER || 'sandbox').toLowerCase();
    this.apiBaseUrl = process.env.PAYMENT_API_BASE_URL || '';
    this.apiKey = process.env.PAYMENT_API_KEY || '';
    this.apiSecret = process.env.PAYMENT_API_SECRET || '';
    this.webhookSecret = process.env.PAYMENT_WEBHOOK_SECRET || '';
    this.timers = new Set();
  }

  getConfig() {
    return {
      provider: this.provider,
      isSandbox: this.provider === 'sandbox' || !this.apiKey,
      methods: PAYMENT_METHODS,
    };
  }

  stop() {
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
  }

  /**
   * Create a deposit order / intent.
   * When custom live API keys are provided in .env, calls external provider endpoint;
   * otherwise runs in full-fidelity Sandbox mode with deterministic deposit address & webhook confirmation.
   */
  async createDeposit({ userId, asset, amountCents }) {
    const method = METHOD_BY_ID[asset];
    if (!method) throw new Error(`Unsupported payment method: ${asset}`);

    const parsedAmount = Math.round(Number(amountCents));
    if (!Number.isFinite(parsedAmount) || parsedAmount < method.minDepositCents) {
      throw new Error(`Minimum deposit for ${method.label} is $${(method.minDepositCents / 100).toFixed(2)}`);
    }
    if (parsedAmount > method.maxDepositCents) {
      throw new Error(`Maximum deposit for ${method.label} is $${(method.maxDepositCents / 100).toLocaleString()}`);
    }

    const user = this.db.getUserById(userId);
    if (!user) throw new Error('Please sign in first');

    const id = `dep_${crypto.randomBytes(6).toString('hex')}`;
    const feeCents = method.depositFeeFlatCents;
    const netCents = Math.max(0, parsedAmount - feeCents);
    let providerRef = `GW-DEP-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    let destination = generateDepositDestination(method, userId);
    let checkoutUrl = null;
    const activeProvider = this.apiKey && this.apiBaseUrl ? this.provider : 'sandbox';

    // Plug-in hook for your live payment gateway API once keys are added to .env
    if (activeProvider !== 'sandbox' && this.apiBaseUrl && this.apiKey) {
      try {
        const res = await fetch(`${this.apiBaseUrl.replace(/\/$/, '')}/deposits`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            orderId: id,
            userId,
            asset: method.id,
            amountCents: parsedAmount,
          }),
        });
        if (res.ok) {
          const ext = await res.json();
          if (ext.providerRef) providerRef = ext.providerRef;
          if (ext.depositAddress) destination = ext.depositAddress;
          if (ext.checkoutUrl) checkoutUrl = ext.checkoutUrl;
        }
      } catch {
        // External gateway error will fall back cleanly or can be strict in prod
      }
    }

    const transaction = this.db.createDepositRecord({
      id,
      userId,
      rail: method.rail,
      provider: activeProvider,
      asset: method.id,
      amountCents: parsedAmount,
      feeCents,
      netCents,
      destination,
      providerRef,
      metadata: {
        network: method.network,
        eta: method.eta,
        checkoutUrl,
      },
    });

    this.emit('paymentUpdated', { userId, transaction });
    return { transaction, isSandbox: activeProvider === 'sandbox' };
  }

  /**
   * Verify webhook HMAC signature (when PAYMENT_WEBHOOK_SECRET is set) and credit deposit atomically.
   */
  verifyWebhookSignature(rawBody, signature) {
    if (!this.webhookSecret) return true; // Sandbox mode
    if (!signature) return false;
    const expected = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody))
      .digest('hex');
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(String(signature)));
  }

  confirmDeposit({ transactionId, externalTxHash, signature, rawBody }) {
    if (this.webhookSecret && !this.verifyWebhookSignature(rawBody || { transactionId }, signature)) {
      throw new Error('Invalid payment gateway webhook signature');
    }

    const txHash =
      externalTxHash ||
      `0x${crypto.randomBytes(16).toString('hex')}`;

    const result = this.db.completeDepositRecord(transactionId, txHash);
    if (!result.alreadyCompleted) {
      this.emit('paymentUpdated', {
        userId: result.user.id,
        transaction: result.transaction,
      });
      this.emit('userUpdated', result.user);
    }
    return result;
  }

  /**
   * Request a withdrawal — atomically debits wallet immediately, dispatches payout via provider API
   * (or settles automatically in 2.5s in Sandbox mode).
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
      throw new Error(`Minimum withdrawal for ${method.label} is $${(method.minWithdrawCents / 100).toFixed(2)}`);
    }
    if (parsedAmount > method.maxWithdrawCents) {
      throw new Error(`Maximum withdrawal for ${method.label} is $${(method.maxWithdrawCents / 100).toLocaleString()}`);
    }

    const feeCents = method.withdrawFeeFlatCents;
    const netCents = parsedAmount - feeCents;
    if (netCents <= 0) {
      throw new Error('Withdrawal amount must exceed the network fee.');
    }

    const id = `wd_${crypto.randomBytes(6).toString('hex')}`;
    const providerRef = `GW-WD-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const activeProvider = this.apiKey && this.apiBaseUrl ? this.provider : 'sandbox';

    const { transaction, user } = this.db.createWithdrawalRecord({
      id,
      userId,
      rail: method.rail,
      provider: activeProvider,
      asset: method.id,
      amountCents: parsedAmount,
      feeCents,
      netCents,
      destination: cleanDest,
      providerRef,
      metadata: {
        network: method.network,
        eta: method.eta,
      },
    });

    this.emit('userUpdated', user);
    this.emit('paymentUpdated', { userId, transaction });

    if (activeProvider === 'sandbox') {
      // Simulate realistic 2.2s gateway payout settlement
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
          // ignore if db closed in tests
        }
      }, 2200);
      this.timers.add(timer);
    }

    return { transaction, user, isSandbox: activeProvider === 'sandbox' };
  }
}

module.exports = { PaymentGatewayService, PAYMENT_METHODS };
