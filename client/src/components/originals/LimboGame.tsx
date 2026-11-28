import React, { useState } from 'react';
import { Zap } from 'lucide-react';
import { ToastItem, UserProfile } from '../../types';
import { formatUsd } from '../../utils/format';
import { StakeInput } from './BetControls';

interface LimboGameProps {
  user: UserProfile | null;
  onUserUpdated: (user: UserProfile) => void;
  onToast: (title: string, subtitle: string | undefined, tone: ToastItem['tone']) => void;
  onOpenUserModal: () => void;
}

export const LimboGame: React.FC<LimboGameProps> = ({
  user,
  onUserUpdated,
  onToast,
  onOpenUserModal,
}) => {
  const [stakeDollars, setStakeDollars] = useState('10');
  const [targetStr, setTargetStr] = useState('2.00');
  const [displayMult, setDisplayMult] = useState<number | null>(null);
  const [lastWon, setLastWon] = useState<boolean | null>(null);
  const [history, setHistory] = useState<Array<{ mult: number; won: boolean }>>([]);
  const [busy, setBusy] = useState(false);

  const target = Math.max(1.01, Math.min(1_000_000, parseFloat(targetStr) || 2));
  const winChance = Number(((99 / target)).toFixed(4));

  const playLimbo = async () => {
    if (!user) return onOpenUserModal();
    setBusy(true);
    try {
      const stakeCents = Math.round((parseFloat(stakeDollars) || 0) * 100);
      const res = await fetch('/api/originals/limbo/play', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          stakeCents,
          targetMultiplier: target,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        onToast('Limbo', data.error || 'Could not play Limbo', 'amber');
        return;
      }

      const finalMult: number = data.outcome.resultMultiplier;
      const won: boolean = data.outcome.won;

      // Crisp 240ms number roll-up burst
      const startTs = performance.now();
      const anim = (now: number) => {
        const p = Math.min(1, (now - startTs) / 240);
        const eased = 1 - Math.pow(1 - p, 3);
        const cur = 1 + (finalMult - 1) * eased;
        setDisplayMult(Number(cur.toFixed(2)));
        if (p < 1) {
          requestAnimationFrame(anim);
        } else {
          setDisplayMult(finalMult);
          setLastWon(won);
          onUserUpdated(data.user);
          setHistory((prev) => [{ mult: finalMult, won }, ...prev].slice(0, 12));
          if (won && target >= 5) {
            onToast(
              `LIMBO ${target.toFixed(2)}x HIT!`,
              `Rolled ${finalMult.toFixed(2)}x · Won ${formatUsd(data.record.payoutCents)}`,
              'emerald'
            );
          }
        }
      };
      setLastWon(null);
      requestAnimationFrame(anim);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      <div className="surface-card order-2 lg:order-1 rounded-xl p-4 lg:col-span-4 space-y-4">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 font-display text-sm font-bold text-fg">
            <Zap className="h-4 w-4 text-gold" />
            LIMBO
          </span>
          <span className="font-mono text-[11px] text-gold">UP TO 1,000,000x</span>
        </div>

        <StakeInput
          stakeDollars={stakeDollars}
          onChange={setStakeDollars}
          balanceCents={user?.balanceCents ?? 0}
        />

        <div>
          <label className="mb-1.5 block text-[11px] font-semibold text-muted">
            Target Multiplier
          </label>
          <div className="flex items-center rounded-xl border border-fg/[0.09] bg-raised px-3">
            <input
              type="number"
              min="1.01"
              max="1000000"
              step="0.5"
              value={targetStr}
              onChange={(e) => setTargetStr(e.target.value)}
              className="w-full bg-transparent py-2.5 font-mono text-sm font-bold text-fg outline-none tabular-nums"
            />
            <span className="font-mono text-xs font-bold text-accent">×</span>
          </div>
          <div className="mt-2 grid grid-cols-4 gap-1.5">
            {[1.5, 2, 5, 25].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setTargetStr(String(m))}
                className="rounded-lg border border-fg/[0.06] bg-fg/[0.02] py-1 font-mono text-[11px] font-bold text-fg2 hover:border-fg/20 hover:text-fg"
              >
                {m}x
              </button>
            ))}
          </div>
        </div>

        <button
          disabled={busy}
          onClick={playLimbo}
          className="w-full rounded-xl bg-gradient-to-b from-accent to-accentdeep py-3.5 font-display text-sm font-black text-onaccent shadow-[0_0_26px_rgba(0,200,83,0.38)] transition hover:brightness-110 active:scale-[0.98]"
        >
          BET LIMBO
        </button>
      </div>

      <div className="surface-card order-1 lg:order-2 flex flex-col justify-between rounded-xl p-4 sm:p-6 lg:col-span-8 min-h-[280px] sm:min-h-[380px]">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {history.map((h, i) => (
            <span
              key={i}
              className={`shrink-0 rounded-full px-2.5 py-0.5 font-mono text-xs font-bold tabular-nums ${
                h.won
                  ? 'bg-accent/20 text-accent'
                  : 'bg-danger/20 text-danger'
              }`}
            >
              {h.mult.toFixed(2)}x
            </span>
          ))}
        </div>

        <div className="flex flex-1 flex-col items-center justify-center py-8">
          <div
            className={`font-mono text-7xl sm:text-8xl font-black tracking-tight tabular-nums transition-colors ${
              lastWon === true
                ? 'text-accent drop-shadow-[0_0_38px_rgba(0,200,83,0.5)]'
                : lastWon === false
                ? 'text-danger drop-shadow-[0_0_38px_rgba(255,78,78,0.45)]'
                : 'text-fg'
            }`}
          >
            {(displayMult ?? 1.0).toFixed(2)}x
          </div>
          <div className="mt-3 font-mono text-xs text-muted">
            Target: <strong className="text-fg">{target.toFixed(2)}x</strong> · Win Chance:{' '}
            <strong className="text-accent">{winChance}%</strong>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-fg/[0.07] bg-raised p-3">
            <div className="text-[10px] uppercase text-subtle">Target Payout</div>
            <div className="mt-1 font-mono text-base font-extrabold text-accent tabular-nums">
              {formatUsd(Math.floor((parseFloat(stakeDollars) || 0) * 100 * target))}
            </div>
          </div>
          <div className="rounded-xl border border-fg/[0.07] bg-raised p-3">
            <div className="text-[10px] uppercase text-subtle">Win Probability</div>
            <div className="mt-1 font-mono text-base font-extrabold text-fg tabular-nums">
              {winChance}%
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
