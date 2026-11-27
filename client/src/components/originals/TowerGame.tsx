import React, { useState } from 'react';
import { Flame, Shield, Skull } from 'lucide-react';
import { ToastItem, UserProfile } from '../../types';
import { formatUsd } from '../../utils/format';
import { StakeInput } from './BetControls';

interface TowerSession {
  sessionId: string;
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';
  cols: number;
  bombsPerRow: number;
  rows: number;
  stakeCents: number;
  currentFloor: number;
  picks: number[];
  hitBomb: { floor: number; col: number } | null;
  gridBombs: number[][] | null;
  currentMultiplier: number;
  nextMultiplier: number;
  currentPayoutCents: number;
  status: 'ACTIVE' | 'LOST' | 'CASHED_OUT';
}

interface TowerGameProps {
  user: UserProfile | null;
  initialSession: TowerSession | null;
  onUserUpdated: (user: UserProfile) => void;
  onToast: (title: string, subtitle: string | undefined, tone: ToastItem['tone']) => void;
  onOpenUserModal: () => void;
}

const TOWER_DIFFS = [
  { id: 'easy', label: 'Easy', cols: 4, bombs: 1 },
  { id: 'medium', label: 'Medium', cols: 3, bombs: 1 },
  { id: 'hard', label: 'Hard', cols: 2, bombs: 1 },
  { id: 'expert', label: 'Expert', cols: 3, bombs: 2 },
] as const;

export const TowerGame: React.FC<TowerGameProps> = ({
  user,
  initialSession,
  onUserUpdated,
  onToast,
  onOpenUserModal,
}) => {
  const [stakeDollars, setStakeDollars] = useState('10');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard' | 'expert'>('medium');
  const [session, setSession] = useState<TowerSession | null>(initialSession);
  const [busy, setBusy] = useState(false);

  const isActive = session?.status === 'ACTIVE';
  const activeDiffObj =
    TOWER_DIFFS.find((d) => d.id === (session?.difficulty ?? difficulty)) ||
    TOWER_DIFFS[1];

  const startClimb = async () => {
    if (!user) return onOpenUserModal();
    setBusy(true);
    try {
      const stakeCents = Math.round((parseFloat(stakeDollars) || 0) * 100);
      const res = await fetch('/api/originals/tower/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, stakeCents, difficulty }),
      });
      const data = await res.json();
      if (!res.ok) {
        onToast('Dragon Tower', data.error || 'Could not start', 'amber');
        return;
      }
      onUserUpdated(data.user);
      setSession(data.session);
    } finally {
      setBusy(false);
    }
  };

  const pickCell = async (colIndex: number) => {
    if (!user || !isActive || busy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/originals/tower/pick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, colIndex }),
      });
      const data = await res.json();
      if (!res.ok) {
        onToast('Tower', data.error || 'Error', 'rose');
        return;
      }
      if (data.user) onUserUpdated(data.user);
      setSession(data.session);
      if (data.hitBomb) {
        onToast('Trap Triggered!', 'Dragon Tower climb ended', 'rose');
      } else if (data.cashedOut) {
        onToast(
          `SUMMIT CONQUERED ${data.session.currentMultiplier.toFixed(2)}x!`,
          `Won ${formatUsd(data.record.payoutCents)}`,
          'emerald'
        );
      }
    } finally {
      setBusy(false);
    }
  };

  const cashOut = async () => {
    if (!user || !isActive || !session || session.currentFloor < 1) return;
    setBusy(true);
    try {
      const res = await fetch('/api/originals/tower/cashout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        onToast('Cash Out', data.error || 'Cannot cash out', 'amber');
        return;
      }
      onUserUpdated(data.user);
      setSession(data.session);
      onToast(
        `TOWER CASHED OUT @ ${data.session.currentMultiplier.toFixed(2)}x!`,
        `Won ${formatUsd(data.record.payoutCents)}`,
        'emerald'
      );
    } finally {
      setBusy(false);
    }
  };

  const floors = [8, 7, 6, 5, 4, 3, 2, 1, 0];
  const safeProb = (activeDiffObj.cols - activeDiffObj.bombs) / activeDiffObj.cols;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      <div className="surface-card order-2 lg:order-1 rounded-2xl p-4 lg:col-span-4 space-y-4">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 font-display text-sm font-bold text-white">
            <Flame className="h-4 w-4 text-[#F5B731]" />
            DRAGON TOWER
          </span>
          <span className="font-mono text-[11px] text-zinc-500">9 FLOORS</span>
        </div>

        <StakeInput
          stakeDollars={stakeDollars}
          onChange={setStakeDollars}
          balanceCents={user?.balanceCents ?? 0}
          disabled={isActive}
        />

        <div>
          <label className="mb-1.5 block text-[11px] font-semibold text-zinc-400">
            Difficulty
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            {TOWER_DIFFS.map((d) => (
              <button
                key={d.id}
                disabled={isActive}
                onClick={() => setDifficulty(d.id)}
                className={`rounded-xl border px-3 py-2 text-left transition ${
                  difficulty === d.id
                    ? 'border-[#F5B731]/60 bg-[#F5B731]/12 text-white'
                    : 'border-white/[0.06] bg-[#05070A] text-zinc-400 hover:border-white/20'
                } disabled:opacity-45`}
              >
                <div className="text-xs font-bold">{d.label}</div>
                <div className="font-mono text-[10px] text-zinc-500">
                  {d.cols - d.bombs}/{d.cols} safe
                </div>
              </button>
            ))}
          </div>
        </div>

        {isActive ? (
          <button
            disabled={busy || (session?.currentFloor ?? 0) < 1}
            onClick={cashOut}
            className="w-full rounded-xl bg-gradient-to-b from-[#FCD34D] to-[#F59E0B] py-3.5 font-display text-sm font-black text-[#040507] shadow-[0_0_24px_rgba(245,183,49,0.4)] transition hover:brightness-110 disabled:opacity-40"
          >
            CASH OUT {formatUsd(session!.currentPayoutCents)} (
            {session!.currentMultiplier.toFixed(2)}x)
          </button>
        ) : (
          <button
            disabled={busy}
            onClick={startClimb}
            className="w-full rounded-xl bg-gradient-to-b from-[#00F0A0] to-[#00C480] py-3.5 font-display text-sm font-black text-[#040507] shadow-[0_0_26px_rgba(0,229,153,0.38)] transition hover:brightness-110"
          >
            BEGIN CLIMB
          </button>
        )}
      </div>

      {/* Right 9-Floor Vertical Tower Ladder */}
      <div className="surface-card order-1 lg:order-2 flex flex-col items-center justify-center rounded-2xl p-4 sm:p-5 lg:col-span-8">
        <div className="w-full max-w-[480px] space-y-1.5">
          {floors.map((floorIdx) => {
            const mult = Number((0.99 / Math.pow(safeProb, floorIdx + 1)).toFixed(2));
            const isCurrentRow = isActive && session?.currentFloor === floorIdx;
            const pickedCol = session?.picks[floorIdx];
            const rowBombs = session?.gridBombs?.[floorIdx] ?? null;

            return (
              <div key={floorIdx} className="flex items-center gap-2.5">
                <div
                  className={`w-16 text-right font-mono text-[11px] font-bold tabular-nums ${
                    isCurrentRow
                      ? 'text-[#00E599]'
                      : pickedCol != null
                      ? 'text-[#F5B731]'
                      : 'text-zinc-600'
                  }`}
                >
                  {mult >= 100 ? `${Math.round(mult)}x` : `${mult}x`}
                </div>

                <div
                  className="grid flex-1 gap-2"
                  style={{
                    gridTemplateColumns: `repeat(${activeDiffObj.cols}, minmax(0, 1fr))`,
                  }}
                >
                  {Array.from({ length: activeDiffObj.cols }, (_, colIdx) => {
                    const isPickedSafe = pickedCol === colIdx;
                    const isHitBomb =
                      session?.hitBomb?.floor === floorIdx &&
                      session?.hitBomb?.col === colIdx;
                    const isRevealedBomb = rowBombs?.includes(colIdx) ?? false;

                    return (
                      <button
                        key={colIdx}
                        disabled={!isCurrentRow || busy}
                        onClick={() => pickCell(colIdx)}
                        className={`h-10 rounded-xl border flex items-center justify-center transition-all ${
                          isHitBomb
                            ? 'border-[#FF3B69] bg-[#FF3B69]/25 shadow-[0_0_18px_rgba(255,59,105,0.45)]'
                            : isPickedSafe
                            ? 'border-[#00E599] bg-[#00E599]/20 shadow-[0_0_14px_rgba(0,229,153,0.3)]'
                            : isRevealedBomb
                            ? 'border-[#FF3B69]/30 bg-[#FF3B69]/10'
                            : isCurrentRow
                            ? 'border-[#00E599]/50 bg-[#121824] hover:bg-[#192334] hover:border-[#00E599]'
                            : 'border-white/[0.06] bg-[#080B10]'
                        }`}
                      >
                        {isHitBomb || isRevealedBomb ? (
                          <Skull className="h-4 w-4 text-[#FF3B69]" />
                        ) : isPickedSafe ? (
                          <Shield className="h-4 w-4 text-[#00E599]" />
                        ) : isCurrentRow ? (
                          <span className="h-1.5 w-1.5 rounded-full bg-[#00E599]/70 animate-pulse" />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
