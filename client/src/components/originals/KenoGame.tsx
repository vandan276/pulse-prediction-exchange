import React, { useEffect, useState } from 'react';
import { Diamond, Grid, Shuffle, Trash2 } from 'lucide-react';
import { ToastItem, UserProfile } from '../../types';
import { formatUsd } from '../../utils/format';
import { StakeInput } from './BetControls';

interface KenoGameProps {
  user: UserProfile | null;
  onUserUpdated: (user: UserProfile) => void;
  onToast: (title: string, subtitle: string | undefined, tone: ToastItem['tone']) => void;
  onOpenUserModal: () => void;
}

export const KenoGame: React.FC<KenoGameProps> = ({
  user,
  onUserUpdated,
  onToast,
  onOpenUserModal,
}) => {
  const [stakeDollars, setStakeDollars] = useState('10');
  const [risk, setRisk] = useState<'low' | 'medium' | 'high'>('medium');
  const [picks, setPicks] = useState<number[]>([3, 12, 19, 27, 34]);
  const [drawn, setDrawn] = useState<number[]>([]);
  const [payoutTable, setPayoutTable] = useState<number[]>([]);
  const [lastHits, setLastHits] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (picks.length === 0) {
      setPayoutTable([]);
      return;
    }
    let cancelled = false;
    fetch(`/api/originals/keno/table?picks=${picks.length}&risk=${risk}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && Array.isArray(d.table)) setPayoutTable(d.table);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [picks.length, risk]);

  const toggleTile = (n: number) => {
    setDrawn([]);
    setLastHits(null);
    setPicks((prev) => {
      if (prev.includes(n)) return prev.filter((x) => x !== n);
      if (prev.length >= 10) return prev;
      return [...prev, n].sort((a, b) => a - b);
    });
  };

  const autoPick = () => {
    const count = Math.max(3, Math.min(8, picks.length || 5));
    const pool = Array.from({ length: 40 }, (_, i) => i + 1).sort(
      () => Math.random() - 0.5
    );
    setDrawn([]);
    setLastHits(null);
    setPicks(pool.slice(0, count).sort((a, b) => a - b));
  };

  const playKeno = async () => {
    if (!user) return onOpenUserModal();
    if (picks.length === 0) {
      onToast('Keno', 'Pick 1 to 10 tiles on the board first', 'amber');
      return;
    }
    setBusy(true);
    try {
      const stakeCents = Math.round((parseFloat(stakeDollars) || 0) * 100);
      const res = await fetch('/api/originals/keno/play', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, stakeCents, picks, risk }),
      });
      const data = await res.json();
      if (!res.ok) {
        onToast('Keno', data.error || 'Failed to draw Keno', 'amber');
        return;
      }
      onUserUpdated(data.user);
      setDrawn(data.outcome.drawn);
      setPayoutTable(data.outcome.payoutTable);
      setLastHits(data.outcome.hitCount);
      if (data.record.payoutCents >= stakeCents) {
        onToast(
          `KENO ${data.outcome.hitCount} HITS (${data.outcome.multiplier}x)!`,
          `Won ${formatUsd(data.record.payoutCents)}`,
          'emerald'
        );
      }
    } finally {
      setBusy(false);
    }
  };

  const drawnSet = new Set(drawn);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      <div className="surface-card order-2 lg:order-1 rounded-2xl p-4 lg:col-span-4 space-y-4">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 font-display text-sm font-bold text-white">
            <Grid className="h-4 w-4 text-[#00E599]" />
            KENO
          </span>
          <span className="font-mono text-[11px] text-zinc-500">
            {picks.length}/10 PICKED
          </span>
        </div>

        <StakeInput
          stakeDollars={stakeDollars}
          onChange={setStakeDollars}
          balanceCents={user?.balanceCents ?? 0}
        />

        <div>
          <label className="mb-1.5 block text-[11px] font-semibold text-zinc-400">
            Risk Profile
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            {(['low', 'medium', 'high'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRisk(r)}
                className={`rounded-xl border py-2 text-xs font-bold capitalize transition ${
                  risk === r
                    ? 'border-[#00E599]/60 bg-[#00E599]/15 text-[#00E599]'
                    : 'border-white/[0.06] bg-[#05070A] text-zinc-400 hover:text-white'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={autoPick}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] py-2 text-xs font-bold text-zinc-200 hover:bg-white/[0.08]"
          >
            <Shuffle className="h-3.5 w-3.5 text-[#00E599]" />
            Auto Pick
          </button>
          <button
            type="button"
            onClick={() => {
              setPicks([]);
              setDrawn([]);
              setLastHits(null);
            }}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] py-2 text-xs font-bold text-zinc-400 hover:text-white"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear
          </button>
        </div>

        <button
          disabled={busy || picks.length === 0}
          onClick={playKeno}
          className="w-full rounded-xl bg-gradient-to-b from-[#00F0A0] to-[#00C480] py-3.5 font-display text-sm font-black text-[#040507] shadow-[0_0_26px_rgba(0,229,153,0.38)] transition hover:brightness-110 disabled:opacity-40"
        >
          DRAW 10 NUMBERS
        </button>
      </div>

      {/* Right 40-Tile Obsidian Grid + Multiplier Strip */}
      <div className="surface-card order-1 lg:order-2 flex flex-col justify-between rounded-2xl p-4 sm:p-5 lg:col-span-8">
        <div className="grid grid-cols-8 gap-2">
          {Array.from({ length: 40 }, (_, i) => i + 1).map((n) => {
            const picked = picks.includes(n);
            const hit = picked && drawnSet.has(n);
            const missDraw = !picked && drawnSet.has(n);

            return (
              <button
                key={n}
                type="button"
                onClick={() => toggleTile(n)}
                className={`relative aspect-square rounded-xl border font-mono text-sm font-extrabold transition-all flex items-center justify-center ${
                  hit
                    ? 'border-[#00E599] bg-[#00E599]/25 text-[#00E599] shadow-[0_0_20px_rgba(0,229,153,0.45)] scale-105'
                    : picked
                    ? 'border-[#F5B731] bg-[#F5B731]/20 text-[#F5B731]'
                    : missDraw
                    ? 'border-[#FF3B69]/45 bg-[#FF3B69]/12 text-[#FF3B69]'
                    : 'border-white/[0.07] bg-[#0C1018] text-zinc-300 hover:border-white/25 hover:text-white'
                }`}
              >
                {hit ? (
                  <div className="flex flex-col items-center">
                    <Diamond className="h-3.5 w-3.5 text-[#00E599]" />
                    <span className="text-[11px] leading-none mt-0.5">{n}</span>
                  </div>
                ) : (
                  n
                )}
              </button>
            );
          })}
        </div>

        {/* Hit Payout Bar */}
        {payoutTable.length > 0 && (
          <div className="mt-4 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${payoutTable.length}, minmax(0, 1fr))` }}>
            {payoutTable.map((mult, hitIdx) => {
              const active = lastHits === hitIdx;
              return (
                <div
                  key={hitIdx}
                  className={`rounded-lg border py-1.5 text-center transition ${
                    active
                      ? mult > 0
                        ? 'border-[#00E599] bg-[#00E599] text-[#040507]'
                        : 'border-[#FF3B69] bg-[#FF3B69]/25 text-white'
                      : 'border-white/[0.06] bg-[#05070A] text-zinc-300'
                  }`}
                >
                  <div className="font-mono text-[11px] font-extrabold tabular-nums">
                    {mult}x
                  </div>
                  <div className={`text-[9px] font-mono ${active ? 'opacity-80' : 'text-zinc-500'}`}>
                    {hitIdx}×
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
