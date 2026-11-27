import React, { useEffect, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Eye,
  EyeOff,
  Lock,
  LogIn,
  LogOut,
  Mail,
  ShieldCheck,
  User,
  UserPlus,
  X,
} from 'lucide-react';
import { UserProfile } from '../types';
import { formatUsd } from '../utils/format';

export type AuthModalMode = 'login' | 'signup';

interface AuthModalProps {
  isOpen: boolean;
  initialMode: AuthModalMode;
  onClose: () => void;
  currentUser: UserProfile | null;
  onSignIn: (payload: { identifier: string; password: string }) => Promise<void>;
  onSignUp: (payload: {
    username: string;
    email: string;
    password: string;
  }) => Promise<void>;
  onLogout: () => Promise<void>;
  onOpenCashier: (tab: 'deposit' | 'withdraw') => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  initialMode,
  onClose,
  currentUser,
  onSignIn,
  onSignUp,
  onLogout,
  onOpenCashier,
}) => {
  const [mode, setMode] = useState<AuthModalMode>(initialMode);
  const [identifier, setIdentifier] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setError(null);
      setPassword('');
      setConfirmPassword('');
    }
  }, [isOpen, initialMode]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode === 'signup') {
      if (password.length < 6) {
        setError('Password must be at least 6 characters long.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
    }

    setBusy(true);
    try {
      if (mode === 'signup') {
        await onSignUp({ username, email, password });
      } else {
        await onSignIn({ identifier, password });
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setBusy(false);
    }
  };

  const handleLogoutClick = async () => {
    setBusy(true);
    try {
      await onLogout();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
      <div className="surface-card w-full max-w-md rounded-2xl p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#00E599]/15 text-[#00E599]">
              {currentUser ? (
                <ShieldCheck className="h-5 w-5" />
              ) : mode === 'signup' ? (
                <UserPlus className="h-5 w-5" />
              ) : (
                <LogIn className="h-5 w-5" />
              )}
            </div>
            <div>
              <h2 className="font-display text-base font-bold text-white">
                {currentUser
                  ? 'Account & Wallet'
                  : mode === 'signup'
                  ? 'Create PULSE Account'
                  : 'Sign In to PULSE'}
              </h2>
              <p className="text-xs text-zinc-400">
                {currentUser
                  ? currentUser.email || 'Verified Exchange Trader'
                  : mode === 'signup'
                  ? 'Real wallet · Deposit & withdraw USDT (BEP-20)'
                  : 'Access your balance, positions & cashier'}
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

        {/* Logged-in Account View */}
        {currentUser ? (
          <div className="mt-5 space-y-4">
            <div className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-[#05070A] p-3.5">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-full font-display text-sm font-black text-[#040507]"
                style={{ backgroundColor: currentUser.avatarColor }}
              >
                {currentUser.username.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-display text-sm font-bold text-white">
                  {currentUser.username}
                </div>
                <div className="truncate font-mono text-[11px] text-zinc-400">
                  {currentUser.email || currentUser.id}
                </div>
              </div>
              <span className="rounded-full bg-[#00E599]/15 px-2.5 py-0.5 font-mono text-[10px] font-bold text-[#00E599]">
                ACTIVE
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 rounded-xl border border-white/[0.06] bg-[#05070A] p-3 text-center">
              <div>
                <div className="text-[10px] uppercase text-zinc-500">Balance</div>
                <div className="mt-0.5 font-mono text-sm font-bold text-[#00E599] tabular-nums">
                  {formatUsd(currentUser.balanceCents)}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase text-zinc-500">Wins / Bets</div>
                <div className="mt-0.5 font-mono text-sm font-bold text-white tabular-nums">
                  {currentUser.totalWins}/{currentUser.totalBets}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase text-zinc-500">Net P/L</div>
                <div
                  className={`mt-0.5 font-mono text-sm font-bold tabular-nums ${
                    currentUser.netProfitCents >= 0 ? 'text-[#00E599]' : 'text-[#FF3B69]'
                  }`}
                >
                  {formatUsd(currentUser.netProfitCents, { showSign: true })}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenCashier('deposit');
                }}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-[#00E599] py-2.5 font-display text-xs font-extrabold text-[#040507] shadow-[0_0_20px_rgba(0,229,153,0.28)] transition hover:brightness-110"
              >
                <ArrowDownLeft className="h-4 w-4 stroke-[2.5]" />
                Deposit USDT
              </button>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenCashier('withdraw');
                }}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.05] py-2.5 font-display text-xs font-bold text-white transition hover:bg-white/[0.1]"
              >
                <ArrowUpRight className="h-4 w-4" />
                Withdraw
              </button>
            </div>

            <button
              type="button"
              onClick={handleLogoutClick}
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#FF3B69]/30 bg-[#FF3B69]/10 py-2.5 font-display text-xs font-bold text-[#FF3B69] transition hover:bg-[#FF3B69]/20 disabled:opacity-50"
            >
              <LogOut className="h-4 w-4" />
              {busy ? 'Signing out...' : 'Sign Out'}
            </button>
          </div>
        ) : (
          <>
            {/* Mode Switch Tabs */}
            <div className="mt-4 grid grid-cols-2 gap-1 rounded-xl border border-white/[0.08] bg-[#05070A] p-1">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError(null);
                }}
                className={`rounded-lg py-2 font-display text-xs font-bold transition ${
                  mode === 'login'
                    ? 'bg-[#00E599] text-[#040507] shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('signup');
                  setError(null);
                }}
                className={`rounded-lg py-2 font-display text-xs font-bold transition ${
                  mode === 'signup'
                    ? 'bg-[#00E599] text-[#040507] shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Create Account
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-3">
              {mode === 'signup' ? (
                <>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-zinc-300">
                      Username
                    </label>
                    <div className="relative">
                      <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="e.g. VandanPro"
                        minLength={3}
                        maxLength={20}
                        required
                        autoComplete="username"
                        className="w-full rounded-xl border border-white/15 bg-[#05070A] py-2.5 pl-9 pr-3.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-[#00E599]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-zinc-300">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        required
                        autoComplete="email"
                        className="w-full rounded-xl border border-white/15 bg-[#05070A] py-2.5 pl-9 pr-3.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-[#00E599]"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-zinc-300">
                    Email or Username
                  </label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                    <input
                      type="text"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="you@example.com or handle"
                      required
                      autoComplete="username"
                      className="w-full rounded-xl border border-white/15 bg-[#05070A] py-2.5 pl-9 pr-3.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-[#00E599]"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-zinc-300">
                  Password
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={mode === 'signup' ? 'At least 6 characters' : 'Enter password'}
                    minLength={6}
                    required
                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                    className="w-full rounded-xl border border-white/15 bg-[#05070A] py-2.5 pl-9 pr-10 text-sm text-white placeholder-zinc-600 outline-none focus:border-[#00E599]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {mode === 'signup' && (
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-zinc-300">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter password"
                      minLength={6}
                      required
                      autoComplete="new-password"
                      className="w-full rounded-xl border border-white/15 bg-[#05070A] py-2.5 pl-9 pr-3.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-[#00E599]"
                    />
                  </div>
                </div>
              )}

              {error && (
                <div className="rounded-lg border border-[#FF3B69]/35 bg-[#FF3B69]/10 px-3 py-2 text-xs font-medium text-[#FF3B69]">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#00E599] py-2.5 font-display text-sm font-bold text-[#040507] shadow-[0_0_24px_rgba(0,229,153,0.3)] transition hover:brightness-110 disabled:opacity-50"
              >
                {mode === 'signup' ? (
                  <>
                    <UserPlus className="h-4 w-4" />
                    {busy ? 'Creating Account...' : 'Create Account ($0.00)'}
                  </>
                ) : (
                  <>
                    <LogIn className="h-4 w-4" />
                    {busy ? 'Signing In...' : 'Sign In'}
                  </>
                )}
              </button>

              <p className="text-center text-[11px] text-zinc-500">
                {mode === 'signup'
                  ? 'New accounts start at $0.00. Fund instantly via live USDT (BEP-20) Cashier.'
                  : 'Protected with salted scrypt hashing & signed HttpOnly sessions.'}
              </p>
            </form>
          </>
        )}
      </div>
    </div>
  );
};
