import React, { useState } from 'react';
import { ArrowLeftRight, Dices } from 'lucide-react';
import { ToastItem, UserProfile } from '../../types';
import { formatUsd } from '../../utils/format';
import { StakeInput } from './BetControls';

interface DiceGameProps {
  user: UserProfile | null;
  onUserUpdated: (user: UserProfile) => void;
  onToast: (title: string, subtitle: string | undefined, tone: ToastItem['tone']) => void;
  onOpenUserModal: () => void;
}

export const DiceGame: React.FC<DiceGameProps> = ({
  user,
  onUserUpdated,
  onToast,
  onOpenUserModal,
}) => {
  const [stakeDollars, setStakeDollars] = useState('10');
  const [target, setTarget] = useState(50.5);
  const [condition, setCondition] = useState<'over' | 'under'>('over');
  const [lastRoll, setLastRoll] = useState<{
    roll: number;
    won: boolean;
    payoutCents: number;
  } | null>(null);
  const [history, setHistory] = useState<Array<{ roll: number; won: boolean }>>([]);
  const [rolling, setRolling] = useState(false);

  const winChance = condition === 'over' ? 100 - target : target;
  const multiplier = Number(((0.99 * 100) / Math.max(2, winChance)).toFixed(4));
  const profitCents = Math.max(
    0,
    Math.floor((parseFloat(stakeDollars) || 0) * 100 * (multiplier - 1))
  );

  const rollDice = async () => {
    if (!user) return onOpenUserModal();
    setRolling(true);
    try {
      const stakeCents = Math.round((parseFloat(stakeDollars) || 0) * 100);
      const res = await fetch('/api/originals/dice/roll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, stakeCents, target, condition }),
      });
      const data = await res.json();
      if (!res.ok) {
        onToast('Dice', data.error || 'Could not roll', 'amber');
        return;
      }
      onUserUpdated(data.user);
      setLastRoll({
        roll: data.outcome.roll,
        won: data.outcome.won,
        payoutCents: data.record.payoutCents,
      });
      setHistory((prev) =>
        [{ roll: data.outcome.roll, won: data.outcome.won }, ...prev].slice(0, 12)
      );
    } finally {
      setRolling(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      <div className="surface-card order-2 lg:order-1 rounded-xl p-4 lg:col-span-4 space-y-4">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 font-display text-sm font-bold text-fg">
            <Dices className="h-4 w-4 text-accent" />
            DICE
          </span>
          <span className="font-mono text-[11px] text-subtle">99% RTP</span>
        </div>

        <StakeInput
          stakeDollars={stakeDollars}
          onChange={setStakeDollars}
          balanceCents={user?.balanceCents ?? 0}
        />

        <div className="rounded-xl border border-fg/[0.06] bg-raised p-3 text-xs space-y-1.5">
          <div className="flex justify-between">
            <span className="text-muted">Profit on Win</span>
            <span className="font-mono font-bold text-accent tabular-nums">
              +{formatUsd(profitCents)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Payout Multiplier</span>
            <span className="font-mono font-bold text-fg tabular-nums">
              {multiplier.toFixed(4)}x
            </span>
          </div>
        </div>

        <button
          disabled={rolling}
          onClick={rollDice}
          className="w-full rounded-xl bg-gradient-to-b from-accent to-accentdeep py-3.5 font-display text-sm font-black text-onaccent shadow-[0_0_26px_rgba(0,200,83,0.38)] transition hover:brightness-110 active:scale-[0.98]"
        >
          ROLL DICE
        </button>
      </div>

      {/* Right Interactive Neon Slider Stage */}
      <div className="surface-card order-1 lg:order-2 flex flex-col justify-between rounded-xl p-4 sm:p-6 lg:col-span-8 min-h-[300px] sm:min-h-[380px]">
        {/* Recent Rolls */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {history.length === 0 ? (
            <span className="text-xs text-subtle">
              Roll to see provably-fair results (0.00 – 100.00)
            </span>
          ) : (
            history.map((h, i) => (
              <span
                key={i}
                className={`shrink-0 rounded-full px-2.5 py-0.5 font-mono text-xs font-bold tabular-nums ${
                  h.won
                    ? 'bg-accent/20 text-accent'
                    : 'bg-danger/20 text-danger'
                }`}
              >
                {h.roll.toFixed(2)}
              </span>
            ))
          )}
        </div>

        {/* Center Slider + Glowing Result Cube */}
        <div className="my-10 px-2 sm:px-6">
          <div className="relative h-14 mb-2">
            {lastRoll && (
              <div
                className="absolute bottom-0 -translate-x-1/2 transition-all duration-300"
                style={{ left: `${Math.max(4, Math.min(96, lastRoll.roll))}%` }}
              >
                <div
                  className={`rounded-xl border px-3 py-1.5 font-mono text-base font-black shadow-2xl tabular-nums ${
                    lastRoll.won
                      ? 'border-accent bg-accent text-onaccent shadow-[0_0_24px_rgba(0,200,83,0.5)]'
                      : 'border-danger bg-danger text-white shadow-[0_0_24px_rgba(255,78,78,0.5)]'
                  }`}
                >
                  {lastRoll.roll.toFixed(2)}
                </div>
              </div>
            )}
          </div>

          <div className="relative flex h-12 items-center rounded-xl border border-fg/[0.08] bg-raised px-4">
            <div className="relative h-3 w-full overflow-hidden rounded-full bg-fg/10">
              <div
                className="absolute inset-y-0 left-0 transition-all"
                style={{
                  width: `${target}%`,
                  backgroundColor: condition === 'under' ? '#00C853' : '#FF4E4E',
                }}
              />
              <div
                className="absolute inset-y-0 right-0 transition-all"
                style={{
                  width: `${100 - target}%`,
                  backgroundColor: condition === 'over' ? '#00C853' : '#FF4E4E',
                }}
              />
            </div>
            <input
              type="range"
              min={2}
              max={98}
              step={0.5}
              value={target}
              onChange={(e) => setTarget(Number(e.target.value))}
              className="absolute inset-x-4 h-12 cursor-pointer opacity-0"
            />
            {/* Visual thumb */}
            <div
              className="pointer-events-none absolute top-1/2 -translate-x-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-lg border-2 border-fg bg-surface shadow-lg"
              style={{ left: `calc(16px + (100% - 32px) * ${target / 100})` }}
            >
              <span className="h-3 w-0.5 bg-fg/70 rounded-full" />
            </div>
          </div>

          <div className="mt-2 flex justify-between font-mono text-[10px] text-subtle px-1">
            <span>0</span>
            <span>25</span>
            <span>50</span>
            <span>75</span>
            <span>100</span>
          </div>
        </div>

        {/* Bottom 3 Metrics Bar */}
        <div className="grid grid-cols-3 gap-2.5">
          <div className="rounded-xl border border-fg/[0.07] bg-raised p-3">
            <div className="text-[10px] font-semibold uppercase text-subtle">
              Multiplier
            </div>
            <div className="mt-1 font-mono text-base font-extrabold text-fg tabular-nums">
              {multiplier.toFixed(4)}x
            </div>
          </div>

          <button
            type="button"
            onClick={() => setCondition((c) => (c === 'over' ? 'under' : 'over'))}
            className="rounded-xl border border-fg/[0.07] bg-raised p-3 text-left transition hover:border-accent/40"
          >
            <div className="flex items-center justify-between text-[10px] font-semibold uppercase text-subtle">
              <span>Roll {condition}</span>
              <ArrowLeftRight className="h-3.5 w-3.5 text-accent" />
            </div>
            <div className="mt-1 font-mono text-base font-extrabold text-accent tabular-nums">
              {target.toFixed(2)}
            </div>
          </button>

          <div className="rounded-xl border border-fg/[0.07] bg-raised p-3">
            <div className="text-[10px] font-semibold uppercase text-subtle">
              Win Chance
            </div>
            <div className="mt-1 font-mono text-base font-extrabold text-fg tabular-nums">
              {winChance.toFixed(2)}%
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
