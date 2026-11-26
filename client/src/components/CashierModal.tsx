import React, { useEffect, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Building2,
  Check,
  CheckCircle2,
  Clock,
  Coins,
  Copy,
  CreditCard,
  History,
  Landmark,
  ShieldCheck,
  Smartphone,
  X,
} from 'lucide-react';
import { ToastItem, UserProfile } from '../types';
import { formatTimeShort, formatUsd } from '../utils/format';

export interface PaymentMethod {
  id: string;
  rail: 'CRYPTO' | 'UPI' | 'CARD' | 'BANK';
  label: string;
  network: string;
  minDepositCents: number;
  maxDepositCents: number;
  minWithdrawCents: number;
  maxWithdrawCents: number;
  depositFeeFlatCents: number;
  withdrawFeeFlatCents: number;
  eta: string;
  placeholder: string;
}

export interface PaymentTransaction {
  id: string;
  userId: string;
  type: 'DEPOSIT' | 'WITHDRAWAL';
  rail: string;
  provider: string;
  asset: string;
  amountCents: number;
  feeCents: number;
  netCents: number;
  destination: string | null;
  providerRef: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  metadata?: { network?: string; eta?: string; checkoutUrl?: string | null };
  createdAt: number;
  updatedAt: number;
}

interface CashierModalProps {
  isOpen: boolean;
  initialTab?: 'deposit' | 'withdraw' | 'history';
  onClose: () => void;
  user: UserProfile | null;
  onUserUpdated: (user: UserProfile) => void;
  onToast: (title: string, subtitle: string | undefined, tone: ToastItem['tone']) => void;
}

/** Deterministic decorative QR matrix for deposit address display */
const DepositQrGraphic: React.FC<{ seed: string }> = ({ seed }) => {
  const cells = 11;
  const bits: boolean[] = [];
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  for (let r = 0; r < cells; r++) {
    for (let c = 0; c < cells; c++) {
      const inCorner =
        (r < 3 && c < 3) ||
        (r < 3 && c >= cells - 3) ||
        (r >= cells - 3 && c < 3);
      if (inCorner) {
        bits.push(true);
      } else {
        h = Math.imul(h ^ (r * 31 + c * 17), 16777619);
        bits.push((h & 1) === 1);
      }
    }
  }
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm inline-block">
      <svg width="96" height="96" viewBox={`0 0 ${cells} ${cells}`}>
        {bits.map((on, i) =>
          on ? (
            <rect
              key={i}
              x={i % cells}
              y={Math.floor(i / cells)}
              width="0.92"
              height="0.92"
              rx="0.18"
              fill="#0F172A"
            />
          ) : null
        )}
      </svg>
    </div>
  );
};

export const CashierModal: React.FC<CashierModalProps> = ({
  isOpen,
  initialTab = 'deposit',
  onClose,
  user,
  onUserUpdated,
  onToast,
}) => {
  const [tab, setTab] = useState<'deposit' | 'withdraw' | 'history'>(initialTab);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [isSandbox, setIsSandbox] = useState(true);
  const [providerName, setProviderName] = useState('sandbox');
  const [selectedAsset, setSelectedAsset] = useState('USDT-TRC20');

  // Deposit state
  const [depositDollars, setDepositDollars] = useState('100');
  const [activeDeposit, setActiveDeposit] = useState<PaymentTransaction | null>(null);
  const [copiedAddr, setCopiedAddr] = useState(false);

  // Withdraw state
  const [withdrawDollars, setWithdrawDollars] = useState('50');
  const [destination, setDestination] = useState('');

  // History
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isOpen) setTab(initialTab);
  }, [isOpen, initialTab]);

  const loadHistory = async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/payments/history/${encodeURIComponent(user.id)}`);
      if (res.ok) {
        const d = await res.json();
        setTransactions(d.transactions || []);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    fetch('/api/payments/config')
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.methods)) setMethods(d.methods);
        setIsSandbox(Boolean(d.isSandbox));
        setProviderName(d.provider || 'sandbox');
      })
      .catch(() => {});
    loadHistory();
  }, [isOpen, user?.id]);

  // Poll briefly while any withdrawal is PROCESSING so UI shows COMPLETED automatically
  useEffect(() => {
    if (!isOpen || !user) return;
    const hasProcessing = transactions.some((t) => t.status === 'PROCESSING');
    if (!hasProcessing) return;
    const id = setInterval(loadHistory, 1500);
    return () => clearInterval(id);
  }, [isOpen, user?.id, transactions]);

  if (!isOpen) return null;

  const activeMethod =
    methods.find((m) => m.id === selectedAsset) || methods[0] || null;

  const createDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeMethod) return;
    setBusy(true);
    try {
      const amountCents = Math.round((parseFloat(depositDollars) || 0) * 100);
      const res = await fetch('/api/payments/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          asset: activeMethod.id,
          amountCents,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        onToast('Deposit Error', data.error || 'Unable to create deposit', 'amber');
        return;
      }
      setActiveDeposit(data.transaction);
      loadHistory();
    } finally {
      setBusy(false);
    }
  };

  const confirmSandboxDeposit = async () => {
    if (!activeDeposit) return;
    setBusy(true);
    try {
      const res = await fetch('/api/payments/deposit/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId: activeDeposit.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        onToast('Confirmation Error', data.error || 'Could not confirm deposit', 'rose');
        return;
      }
      onUserUpdated(data.user);
      setActiveDeposit(data.transaction);
      loadHistory();
      onToast(
        `DEPOSIT CREDITED +${formatUsd(data.transaction.netCents)}`,
        `${data.transaction.asset} confirmed · New balance ${formatUsd(data.user.balanceCents)}`,
        'emerald'
      );
    } finally {
      setBusy(false);
    }
  };

  const submitWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeMethod) return;
    setBusy(true);
    try {
      const amountCents = Math.round((parseFloat(withdrawDollars) || 0) * 100);
      const res = await fetch('/api/payments/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          asset: activeMethod.id,
          amountCents,
          destination,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        onToast('Withdrawal Error', data.error || 'Could not process withdrawal', 'rose');
        return;
      }
      onUserUpdated(data.user);
      setDestination('');
      setTab('history');
      loadHistory();
      onToast(
        `WITHDRAWAL SUBMITTED (${formatUsd(data.transaction.amountCents)})`,
        `Net ${formatUsd(data.transaction.netCents)} dispatching via ${activeMethod.label}`,
        'sky'
      );
    } finally {
      setBusy(false);
    }
  };

  const railIcon = (rail: PaymentMethod['rail']) => {
    if (rail === 'CRYPTO') return <Coins className="h-3.5 w-3.5 text-[#00E599]" />;
    if (rail === 'UPI') return <Smartphone className="h-3.5 w-3.5 text-sky-400" />;
    if (rail === 'CARD') return <CreditCard className="h-3.5 w-3.5 text-[#F5B731]" />;
    return <Building2 className="h-3.5 w-3.5 text-purple-400" />;
  };

  const withdrawAmountCents = Math.round((parseFloat(withdrawDollars) || 0) * 100);
  const withdrawFee = activeMethod?.withdrawFeeFlatCents ?? 0;
  const withdrawNet = Math.max(0, withdrawAmountCents - withdrawFee);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-md">
      <div className="surface-card relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#00E599]/15 text-[#00E599]">
              <Landmark className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-base font-bold text-white">
                  Cashier Gateway
                </h2>
                <span className="rounded-full bg-[#F5B731]/15 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-[#F5B731]">
                  {isSandbox ? 'Sandbox Ready' : providerName}
                </span>
              </div>
              <p className="text-[11px] text-zinc-400">
                Available Balance:{' '}
                <strong className="font-mono text-white">
                  {formatUsd(user?.balanceCents ?? 0)}
                </strong>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-white/[0.06] px-5 py-2.5">
          <div className="grid grid-cols-3 gap-1 rounded-xl border border-white/[0.07] bg-[#05070A] p-1">
            <button
              onClick={() => {
                setTab('deposit');
                setActiveDeposit(null);
              }}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-bold transition ${
                tab === 'deposit'
                  ? 'bg-white text-[#040507]'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <ArrowDownLeft className="h-3.5 w-3.5" />
              Deposit
            </button>
            <button
              onClick={() => setTab('withdraw')}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-bold transition ${
                tab === 'withdraw'
                  ? 'bg-white text-[#040507]'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <ArrowUpRight className="h-3.5 w-3.5" />
              Withdraw
            </button>
            <button
              onClick={() => {
                setTab('history');
                loadHistory();
              }}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-bold transition ${
                tab === 'history'
                  ? 'bg-white text-[#040507]'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <History className="h-3.5 w-3.5" />
              Transactions ({transactions.length})
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* ==================== DEPOSIT TAB ==================== */}
          {tab === 'deposit' && (
            activeDeposit ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-display text-sm font-bold text-white">
                    {activeDeposit.status === 'COMPLETED'
                      ? 'Deposit Confirmed'
                      : `Send ${formatUsd(activeDeposit.amountCents)} via ${activeDeposit.asset}`}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase ${
                      activeDeposit.status === 'COMPLETED'
                        ? 'bg-[#00E599]/20 text-[#00E599]'
                        : 'bg-[#F5B731]/20 text-[#F5B731]'
                    }`}
                  >
                    {activeDeposit.status}
                  </span>
                </div>

                {activeDeposit.status === 'COMPLETED' ? (
                  <div className="rounded-2xl border border-[#00E599]/40 bg-[#00E599]/10 p-6 text-center">
                    <CheckCircle2 className="mx-auto h-10 w-10 text-[#00E599]" />
                    <div className="mt-2 font-display text-lg font-bold text-white">
                      +{formatUsd(activeDeposit.netCents)} Credited
                    </div>
                    <p className="mt-1 font-mono text-[11px] text-zinc-400 break-all">
                      TX Ref: {activeDeposit.providerRef}
                    </p>
                    <button
                      onClick={() => setActiveDeposit(null)}
                      className="mt-4 rounded-xl bg-[#00E599] px-5 py-2 font-display text-xs font-black text-[#040507]"
                    >
                      Make Another Deposit
                    </button>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-white/[0.08] bg-[#05070A] p-4 space-y-4">
                    <div className="flex flex-col sm:flex-row items-center gap-4">
                      <DepositQrGraphic seed={activeDeposit.destination || activeDeposit.id} />
                      <div className="flex-1 space-y-2 w-full">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                          {activeDeposit.rail === 'CRYPTO'
                            ? `${activeDeposit.asset} Deposit Address (${activeDeposit.metadata?.network})`
                            : `${activeDeposit.asset} Gateway Payment Reference`}
                        </div>
                        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                          <code className="flex-1 truncate font-mono text-xs font-semibold text-white">
                            {activeDeposit.destination}
                          </code>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard?.writeText(activeDeposit.destination || '').catch(() => {});
                              setCopiedAddr(true);
                              setTimeout(() => setCopiedAddr(false), 1600);
                            }}
                            className="flex items-center gap-1 rounded-lg bg-white/10 px-2 py-1 text-[10px] font-bold text-white"
                          >
                            {copiedAddr ? <Check className="h-3 w-3 text-[#00E599]" /> : <Copy className="h-3 w-3" />}
                            {copiedAddr ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-zinc-400">Order Reference</span>
                          <span className="font-mono font-bold text-white">{activeDeposit.providerRef}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-zinc-400">Net Credit</span>
                          <span className="font-mono font-bold text-[#00E599]">
                            {formatUsd(activeDeposit.netCents)} (0% fee)
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-white/[0.06]">
                      <button
                        disabled={busy}
                        onClick={confirmSandboxDeposit}
                        className="flex-1 rounded-xl bg-gradient-to-b from-[#00F0A0] to-[#00C480] py-3 font-display text-xs font-black text-[#040507] shadow-[0_0_24px_rgba(0,229,153,0.35)] transition hover:brightness-110 disabled:opacity-50"
                      >
                        {busy
                          ? 'Confirming...'
                          : `Confirm Payment ${formatUsd(activeDeposit.amountCents)} (Sandbox Webhook)`}
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveDeposit(null)}
                        className="rounded-xl border border-white/10 px-4 py-3 text-xs font-bold text-zinc-400 hover:text-white"
                      >
                        Back
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <form onSubmit={createDeposit} className="space-y-4">
                <div>
                  <label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                    Select Payment Rail
                  </label>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {methods.map((m) => {
                      const active = m.id === selectedAsset;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setSelectedAsset(m.id)}
                          className={`rounded-xl border p-2.5 text-left transition ${
                            active
                              ? 'border-[#00E599] bg-[#00E599]/10'
                              : 'border-white/[0.07] bg-[#05070A] hover:border-white/20'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            {railIcon(m.rail)}
                            <span className="font-mono text-[9px] text-zinc-500">
                              {m.eta}
                            </span>
                          </div>
                          <div className="mt-1.5 text-xs font-bold text-white truncate">
                            {m.label}
                          </div>
                          <div className="text-[10px] text-zinc-500 truncate">
                            {m.network}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between text-xs">
                    <label className="font-semibold text-zinc-400">
                      Deposit Amount (USD)
                    </label>
                    {activeMethod && (
                      <span className="font-mono text-[10px] text-zinc-500">
                        Min {formatUsd(activeMethod.minDepositCents)} · 0% Fee
                      </span>
                    )}
                  </div>
                  <div className="flex items-center rounded-xl border border-white/15 bg-[#05070A] px-3">
                    <span className="font-mono text-base font-bold text-[#00E599]">$</span>
                    <input
                      type="number"
                      min="10"
                      step="1"
                      required
                      value={depositDollars}
                      onChange={(e) => setDepositDollars(e.target.value)}
                      className="w-full bg-transparent px-2 py-2.5 font-mono text-base font-bold text-white outline-none tabular-nums"
                    />
                  </div>
                  <div className="mt-2 grid grid-cols-5 gap-1.5">
                    {[25, 50, 100, 250, 1000].map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setDepositDollars(String(v))}
                        className="rounded-lg border border-white/[0.07] bg-white/[0.02] py-1.5 font-mono text-xs font-bold text-zinc-300 hover:border-white/20 hover:text-white"
                      >
                        ${v}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full rounded-xl bg-gradient-to-b from-[#00F0A0] to-[#00C480] py-3.5 font-display text-sm font-black text-[#040507] shadow-[0_0_26px_rgba(0,229,153,0.35)] transition hover:brightness-110 disabled:opacity-50"
                >
                  {busy
                    ? 'Generating Gateway Checkout...'
                    : `Continue to Deposit $${depositDollars || '0'}`}
                </button>

                <div className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-[#05070A] px-3 py-2 text-[11px] text-zinc-400">
                  <ShieldCheck className="h-4 w-4 shrink-0 text-[#00E599]" />
                  <span>
                    Adapter-ready gateway: drop your live API keys in <code className="font-mono">.env</code> to switch from Sandbox to live processing.
                  </span>
                </div>
              </form>
            )
          )}

          {/* ==================== WITHDRAW TAB ==================== */}
          {tab === 'withdraw' && (
            <form onSubmit={submitWithdrawal} className="space-y-4">
              <div>
                <label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                  Select Payout Rail
                </label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {methods.map((m) => {
                    const active = m.id === selectedAsset;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setSelectedAsset(m.id)}
                        className={`rounded-xl border p-2.5 text-left transition ${
                          active
                            ? 'border-[#00E599] bg-[#00E599]/10'
                            : 'border-white/[0.07] bg-[#05070A] hover:border-white/20'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          {railIcon(m.rail)}
                          <span className="font-mono text-[9px] text-zinc-500">
                            Fee {formatUsd(m.withdrawFeeFlatCents)}
                          </span>
                        </div>
                        <div className="mt-1.5 text-xs font-bold text-white truncate">
                          {m.label}
                        </div>
                        <div className="text-[10px] text-zinc-500 truncate">
                          {m.network}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-zinc-400">
                  Destination ({activeMethod?.label})
                </label>
                <input
                  type="text"
                  required
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder={activeMethod?.placeholder || 'Wallet address / UPI ID / Account'}
                  className="w-full rounded-xl border border-white/15 bg-[#05070A] px-3.5 py-2.5 font-mono text-xs text-white placeholder-zinc-500 outline-none focus:border-[#00E599]"
                />
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <label className="font-semibold text-zinc-400">
                    Withdraw Amount (USD)
                  </label>
                  <div className="flex gap-1.5">
                    {[0.25, 0.5, 1].map((frac) => (
                      <button
                        key={frac}
                        type="button"
                        onClick={() => {
                          const v = Math.floor(((user?.balanceCents ?? 0) * frac)) / 100;
                          setWithdrawDollars(Math.max(10, v).toFixed(2).replace(/\.00$/, ''));
                        }}
                        className="rounded bg-white/[0.06] px-2 py-0.5 font-mono text-[10px] font-bold text-zinc-300 hover:text-white"
                      >
                        {frac === 1 ? 'MAX' : `${frac * 100}%`}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center rounded-xl border border-white/15 bg-[#05070A] px-3">
                  <span className="font-mono text-base font-bold text-[#00E599]">$</span>
                  <input
                    type="number"
                    min="10"
                    step="1"
                    required
                    value={withdrawDollars}
                    onChange={(e) => setWithdrawDollars(e.target.value)}
                    className="w-full bg-transparent px-2 py-2.5 font-mono text-base font-bold text-white outline-none tabular-nums"
                  />
                </div>
              </div>

              <div className="rounded-xl border border-white/[0.06] bg-[#05070A] p-3 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Requested Amount</span>
                  <span className="font-mono font-bold text-white tabular-nums">
                    {formatUsd(withdrawAmountCents)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Network / Gateway Fee</span>
                  <span className="font-mono font-semibold text-[#F5B731] tabular-nums">
                    -{formatUsd(withdrawFee)}
                  </span>
                </div>
                <div className="flex justify-between border-t border-white/[0.06] pt-1.5">
                  <span className="font-bold text-white">Net You Receive</span>
                  <span className="font-mono font-extrabold text-[#00E599] tabular-nums">
                    {formatUsd(withdrawNet)}
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={busy || !user || withdrawAmountCents > (user?.balanceCents ?? 0)}
                className="w-full rounded-xl bg-gradient-to-b from-[#00F0A0] to-[#00C480] py-3.5 font-display text-sm font-black text-[#040507] shadow-[0_0_26px_rgba(0,229,153,0.35)] transition hover:brightness-110 disabled:opacity-40"
              >
                {busy ? 'Dispatching Payout...' : `Withdraw ${formatUsd(withdrawAmountCents)}`}
              </button>
            </form>
          )}

          {/* ==================== TRANSACTIONS TAB ==================== */}
          {tab === 'history' && (
            transactions.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 py-12 text-center text-xs text-zinc-500">
                No deposits or withdrawals yet. Start a deposit or withdrawal to see your live ledger.
              </div>
            ) : (
              <div className="space-y-2">
                {transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/[0.07] bg-[#05070A] px-3.5 py-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                          tx.type === 'DEPOSIT'
                            ? 'bg-[#00E599]/15 text-[#00E599]'
                            : 'bg-sky-500/15 text-sky-400'
                        }`}
                      >
                        {tx.type === 'DEPOSIT' ? (
                          <ArrowDownLeft className="h-4 w-4" />
                        ) : (
                          <ArrowUpRight className="h-4 w-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-white">
                            {tx.type === 'DEPOSIT' ? 'Deposit' : 'Withdrawal'} · {tx.asset}
                          </span>
                          <span
                            className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.2 font-mono text-[9px] font-bold uppercase ${
                              tx.status === 'COMPLETED'
                                ? 'bg-[#00E599]/15 text-[#00E599]'
                                : tx.status === 'PROCESSING' || tx.status === 'PENDING'
                                ? 'bg-[#F5B731]/15 text-[#F5B731]'
                                : 'bg-[#FF3B69]/15 text-[#FF3B69]'
                            }`}
                          >
                            {tx.status === 'PROCESSING' && <Clock className="h-2.5 w-2.5" />}
                            {tx.status}
                          </span>
                        </div>
                        <div className="mt-0.5 font-mono text-[10px] text-zinc-500 truncate max-w-[300px]">
                          {formatTimeShort(tx.createdAt)} · Ref: {tx.providerRef}
                        </div>
                      </div>
                    </div>

                    <div className="text-right font-mono tabular-nums">
                      <div
                        className={`text-xs font-extrabold ${
                          tx.type === 'DEPOSIT' ? 'text-[#00E599]' : 'text-white'
                        }`}
                      >
                        {tx.type === 'DEPOSIT' ? '+' : '-'}
                        {formatUsd(tx.amountCents)}
                      </div>
                      {tx.feeCents > 0 && (
                        <div className="text-[10px] text-zinc-500">
                          Net {formatUsd(tx.netCents)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
};
