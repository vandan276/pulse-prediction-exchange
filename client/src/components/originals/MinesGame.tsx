import React, { useState } from 'react';
import { Bomb, Diamond, Shuffle } from 'lucide-react';
import { ToastItem, UserProfile } from '../../types';
import { formatUsd } from '../../utils/format';
import { StakeInput } from './BetControls';

interface MinesSession {
  sessionId: string;
  stakeCents: number;
  mineCount: number;
  revealed: number[];
  mines: number[] | null;
  hitMineTile: number | null;
  currentMultiplier: number;
  nextMultiplier: number;
  currentPayoutCents: number;
  status: 'ACTIVE' | 'LOST' | 'CASHED_OUT';
}

interface MinesGameProps {
  user: UserProfile | null;
  initialSession: MinesSession | null;
  onUserUpdated: (user: UserProfile) => void;
  onToast: (title: string, subtitle: string | undefined, tone: ToastItem['tone']) => void;
  onOpenUserModal: () => void;
}

export const MinesGame: React.FC<MinesGameProps> = ({
  user,
  initialSession,
  onUserUpdated,
  onToast,
  onOpenUserModal,
}) => {
  const [stakeDollars, setStakeDollars] = useState('10');
  const [mineCount, setMineCount] = useState(3);
  const [session, setSession] = useState<MinesSession | null>(initialSession);
  const [busy, setBusy] = useState(false);

  const isActive = session?.status === 'ACTIVE';

  const startBoard = async () => {
    if (!user) return onOpenUserModal();
    setBusy(true);
    try {
      const stakeCents = Math.round((parseFloat(stakeDollars) || 0) * 100);
      const res = await fetch('/api/originals/mines/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, stakeCents, mineCount }),
      });
      const data = await res.json();
      if (!res.ok) {
        onToast('Mines', data.error || 'Could not start Mines', 'amber');
        return;
      }
      onUserUpdated(data.user);
      setSession(data.session);
    } finally {
      setBusy(false);
    }
  };

  const revealTile = async (tileIndex: number) => {
    if (!user || !isActive || busy) return;
    if (session?.revealed.includes(tileIndex)) return;
    setBusy(true);
    try {
      const res = await fetch('/api/originals/mines/reveal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, tileIndex }),
      });
      const data = await res.json();
      if (!res.ok) {
        onToast('Mines', data.error || 'Cannot reveal tile', 'rose');
        return;
      }
      if (data.user) onUserUpdated(data.user);
      setSession(data.session);
      if (data.hitMine) {
        onToast('BOOM! Hit a Mine', 'All hidden mines revealed on board', 'rose');
      } else if (data.cashedOut) {
        onToast(
          `BOARD CLEARED! ${data.session.currentMultiplier.toFixed(2)}x`,
          `Won ${formatUsd(data.record.payoutCents)}`,
          'emerald'
        );
      }
    } finally {
      setBusy(false);
    }
  };

  const pickRandom = () => {
    if (!isActive || !session) return;
    const unrevealed = Array.from({ length: 25 }, (_, i) => i).filter(
      (i) => !session.revealed.includes(i)
    );
    if (unrevealed.length === 0) return;
    const pick = unrevealed[Math.floor(Math.random() * unrevealed.length)];
    revealTile(pick);
  };

  const cashOut = async () => {
    if (!user || !isActive || !session || session.revealed.length < 1) return;
    setBusy(true);
    try {
      const res = await fetch('/api/originals/mines/cashout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        onToast('Cash Out', data.error || 'Error cashing out', 'amber');
        return;
      }
      onUserUpdated(data.user);
      setSession(data.session);
      onToast(
        `MINES CASHED OUT @ ${data.session.currentMultiplier.toFixed(2)}x!`,
        `Won ${formatUsd(data.record.payoutCents)}`,
        'emerald'
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      {/* Left Controls */}
      <div className="surface-card order-2 lg:order-1 rounded-xl p-4 lg:col-span-4 space-y-4">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 font-display text-sm font-bold text-fg">
            <Diamond className="h-4 w-4 text-accent" />
            MINES 5×5
          </span>
          <span className="font-mono text-[11px] text-subtle">99% RTP</span>
        </div>

        <StakeInput
          stakeDollars={stakeDollars}
          onChange={setStakeDollars}
          balanceCents={user?.balanceCents ?? 0}
          disabled={isActive}
        />

        <div>
          <div className="mb-1.5 flex items-center justify-between text-[11px]">
            <span className="font-semibold text-muted">Mines Count</span>
            <span className="font-mono font-bold text-fg">
              {mineCount} Mines · {25 - mineCount} Gems
            </span>
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {[1, 3, 5, 10, 20].map((m) => (
              <button
                key={m}
                disabled={isActive}
                onClick={() => setMineCount(m)}
                className={`rounded-lg border py-1.5 font-mono text-xs font-bold transition ${
                  mineCount === m
                    ? 'border-accent/60 bg-accent/15 text-accent'
                    : 'border-fg/[0.06] bg-raised text-muted hover:text-fg'
                } disabled:opacity-40`}
              >
                {m}
              </button>
            ))}
          </div>
          <input
            type="range"
            min={1}
            max={24}
            disabled={isActive}
            value={mineCount}
            onChange={(e) => setMineCount(Number(e.target.value))}
            className="mt-2.5 w-full accent-[#00C853]"
          />
        </div>

        {isActive ? (
          <div className="space-y-2">
            <button
              disabled={busy || (session?.revealed.length ?? 0) < 1}
              onClick={cashOut}
              className="w-full rounded-xl bg-gradient-to-b from-gold to-gold py-3.5 font-display text-sm font-black text-onaccent shadow-[0_0_24px_rgba(255,200,0,0.4)] transition hover:brightness-110 disabled:opacity-40"
            >
              CASH OUT {formatUsd(session!.currentPayoutCents)}
              <div className="font-mono text-[11px] font-bold">
                {session!.currentMultiplier.toFixed(2)}x ({session!.revealed.length} gems)
              </div>
            </button>
            <button
              disabled={busy}
              onClick={pickRandom}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-fg/10 bg-fg/[0.04] py-2.5 text-xs font-bold text-fg transition hover:bg-fg/[0.08]"
            >
              <Shuffle className="h-3.5 w-3.5 text-accent" />
              Pick Random Tile (Next {session!.nextMultiplier.toFixed(2)}x)
            </button>
          </div>
        ) : (
          <button
            disabled={busy}
            onClick={startBoard}
            className="w-full rounded-xl bg-gradient-to-b from-accent to-accentdeep py-3.5 font-display text-sm font-black text-onaccent shadow-[0_0_24px_rgba(0,200,83,0.35)] transition hover:brightness-110"
          >
            START MINES BOARD
          </button>
        )}
      </div>

      {/* Right 5x5 Obsidian Grid */}
      <div className="surface-card order-1 lg:order-2 flex flex-col items-center justify-center rounded-xl p-4 sm:p-6 lg:col-span-8">
        <div className="mb-4 flex w-full max-w-[440px] items-center justify-between font-mono text-xs">
          <span className="text-muted">
            Multiplier:{' '}
            <strong className="text-accent text-sm">
              {(session?.currentMultiplier ?? 1).toFixed(2)}x
            </strong>
          </span>
          {session && isActive && (
            <span className="text-muted">
              Next Gem:{' '}
              <strong className="text-gold">
                {session.nextMultiplier.toFixed(2)}x
              </strong>
            </span>
          )}
          {session?.status === 'CASHED_OUT' && (
            <span className="rounded-full bg-accent/20 px-2.5 py-0.5 font-bold text-accent">
              WON {formatUsd(session.currentPayoutCents)}
            </span>
          )}
          {session?.status === 'LOST' && (
            <span className="rounded-full bg-danger/20 px-2.5 py-0.5 font-bold text-danger">
              DETONATED
            </span>
          )}
        </div>

        <div className="grid w-full max-w-[440px] grid-cols-5 gap-2.5">
          {Array.from({ length: 25 }, (_, idx) => {
            const isRevealedGem = session?.revealed.includes(idx) ?? false;
            const isMine = session?.mines?.includes(idx) ?? false;
            const isHitMine = session?.hitMineTile === idx;
            const boardEnded = session != null && session.status !== 'ACTIVE';

            return (
              <button
                key={idx}
                disabled={!isActive || isRevealedGem || busy}
                onClick={() => revealTile(idx)}
                className={`aspect-square rounded-xl border flex items-center justify-center transition-all duration-150 ${
                  isHitMine
                    ? 'border-danger bg-danger/25 shadow-[0_0_24px_rgba(255,78,78,0.45)] scale-95'
                    : isMine
                    ? 'border-danger/40 bg-danger/10'
                    : isRevealedGem
                    ? 'border-accent/60 bg-accent/15 shadow-[0_0_20px_rgba(0,200,83,0.28)]'
                    : boardEnded
                    ? 'border-fg/[0.04] bg-base opacity-45'
                    : isActive
                    ? 'border-fg/[0.09] bg-surface shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_4px_0_rgb(var(--base))] hover:-translate-y-0.5 hover:border-accent/40 hover:bg-raised active:translate-y-0'
                    : 'border-fg/[0.06] bg-surface'
                }`}
              >
                {isMine ? (
                  <Bomb
                    className={`h-7 w-7 ${
                      isHitMine
                        ? 'text-danger animate-pulse'
                        : 'text-danger/75'
                    }`}
                  />
                ) : isRevealedGem ? (
                  <Diamond className="h-7 w-7 text-accent drop-shadow-[0_0_12px_rgba(0,200,83,0.8)]" />
                ) : boardEnded ? (
                  <Diamond className="h-4 w-4 text-subtle" />
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
