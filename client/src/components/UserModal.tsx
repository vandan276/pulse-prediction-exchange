import React, { useState } from 'react';
import { User, Wallet, X } from 'lucide-react';
import { UserProfile } from '../types';
import { formatUsd } from '../utils/format';

interface UserModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile | null;
  onLogin: (username: string) => Promise<void>;
}

export const UserModal: React.FC<UserModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onLogin,
}) => {
  const [username, setUsername] = useState(currentUser?.username ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await onLogin(username);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
      <div className="surface-card w-full max-w-md rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#00E599]/15 text-[#00E599]">
              <User className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-base font-bold text-white">
                {currentUser ? 'Trader Wallet' : 'Connect to PULSE'}
              </h2>
              <p className="text-xs text-zinc-400">
                Virtual balance starts with $1,000.00
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

        {currentUser && (
          <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl border border-white/[0.06] bg-[#05070A] p-3 text-center">
            <div>
              <div className="text-[10px] uppercase text-zinc-500">Balance</div>
              <div className="mt-0.5 font-mono text-sm font-bold text-[#00E599]">
                {formatUsd(currentUser.balanceCents)}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase text-zinc-500">Wins / Bets</div>
              <div className="mt-0.5 font-mono text-sm font-bold text-white">
                {currentUser.totalWins}/{currentUser.totalBets}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase text-zinc-500">Net P/L</div>
              <div
                className={`mt-0.5 font-mono text-sm font-bold ${
                  currentUser.netProfitCents >= 0 ? 'text-[#00E599]' : 'text-[#FF3B69]'
                }`}
              >
                {formatUsd(currentUser.netProfitCents, { showSign: true })}
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-zinc-300">
              {currentUser ? 'Switch or Create Handle' : 'Choose Your Trader Handle'}
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. VandanPro"
              maxLength={20}
              required
              className="w-full rounded-xl border border-white/15 bg-[#05070A] px-3.5 py-2.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-[#00E599]"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-[#FF3B69]/35 bg-[#FF3B69]/10 px-3 py-2 text-xs text-[#FF3B69]">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#00E599] py-2.5 font-display text-sm font-bold text-[#040507] shadow-[0_0_24px_rgba(0,229,153,0.3)] transition hover:brightness-110 disabled:opacity-50"
          >
            <Wallet className="h-4 w-4" />
            {busy
              ? 'Loading...'
              : currentUser
              ? 'Switch Account'
              : 'Enter Exchange ($1,000.00)'}
          </button>
        </form>
      </div>
    </div>
  );
};
