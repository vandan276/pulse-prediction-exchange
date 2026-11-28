import React, { useState } from 'react';
import { Flame, Sparkles, Wind } from 'lucide-react';
import { ToastItem, UserProfile } from '../../types';
import { formatUsd } from '../../utils/format';
import { StakeInput } from './BetControls';

interface PumpSession {
  sessionId: string;
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';
  stakeCents: number;
  pumps: number;
  maxSafePumps: number;
  totalPumps: number;
  popsCount: number;
  currentMultiplier: number;
  nextMultiplier: number;
  currentPayoutCents: number;
  nextPopChancePct: number;
  status: 'ACTIVE' | 'POPPED' | 'CASHED_OUT';
  popAtPump: number | null;
}

interface PumpGameProps {
  user: UserProfile | null;
  initialSession: PumpSession | null;
  onUserUpdated: (user: UserProfile) => void;
  onToast: (title: string, subtitle: string | undefined, tone: ToastItem['tone']) => void;
  onOpenUserModal: () => void;
}

const DIFFS = [
  { id: 'easy', label: 'Easy', desc: '1/24 pop' },
  { id: 'medium', label: 'Medium', desc: '3/22 pop' },
  { id: 'hard', label: 'Hard', desc: '5/20 pop' },
  { id: 'expert', label: 'Expert', desc: '5/15 pop' },
] as const;

export const PumpGame: React.FC<PumpGameProps> = ({
  user,
  initialSession,
  onUserUpdated,
  onToast,
  onOpenUserModal,
}) => {
  const [stakeDollars, setStakeDollars] = useState('10');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard' | 'expert'>('medium');
  const [session, setSession] = useState<PumpSession | null>(initialSession);
  const [busy, setBusy] = useState(false);
  const [pumpPulse, setPumpPulse] = useState(false);

  const isActive = session?.status === 'ACTIVE';
  const isPopped = session?.status === 'POPPED';
  const isCashed = session?.status === 'CASHED_OUT';

  const startBalloon = async () => {
    if (!user) return onOpenUserModal();
    setBusy(true);
    try {
      const stakeCents = Math.round((parseFloat(stakeDollars) || 0) * 100);
      const res = await fetch('/api/originals/pump/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, stakeCents, difficulty }),
      });
      const data = await res.json();
      if (!res.ok) {
        onToast('Pump', data.error || 'Could not start balloon', 'amber');
        return;
      }
      onUserUpdated(data.user);
      setSession(data.session);
    } finally {
      setBusy(false);
    }
  };

  const doPump = async () => {
    if (!user || !isActive) return;
    setBusy(true);
    setPumpPulse(true);
    setTimeout(() => setPumpPulse(false), 240);
    try {
      const res = await fetch('/api/originals/pump/pump', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        onToast('Pump Error', data.error || 'Failed to pump', 'rose');
        return;
      }
      if (data.user) onUserUpdated(data.user);
      setSession(data.session);
      if (data.popped) {
        onToast(
          'BOOM! Balloon Popped!',
          `Burst on pump #${data.session.pumps} (${difficulty.toUpperCase()})`,
          'rose'
        );
      } else if (data.cashedOut) {
        onToast(
          `MAX PUMP JACKPOT ${data.session.currentMultiplier.toFixed(2)}x!`,
          `Won ${formatUsd(data.record.payoutCents)}`,
          'emerald'
        );
      }
    } finally {
      setBusy(false);
    }
  };

  const doCashout = async () => {
    if (!user || !isActive || (session?.pumps ?? 0) < 1) return;
    setBusy(true);
    try {
      const res = await fetch('/api/originals/pump/cashout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        onToast('Cash Out', data.error || 'Cannot cash out yet', 'amber');
        return;
      }
      onUserUpdated(data.user);
      setSession(data.session);
      onToast(
        `PUMP CASHED OUT @ ${data.session.currentMultiplier.toFixed(2)}x!`,
        `Won ${formatUsd(data.record.payoutCents)} (pop would have been pump #${data.session.popAtPump})`,
        'emerald'
      );
    } finally {
      setBusy(false);
    }
  };

  // Visual balloon expansion & color pressure curve
  const pumps = session?.pumps ?? 0;
  const maxSafe = session?.maxSafePumps ?? 19;
  const pressureRatio = Math.min(1, pumps / Math.max(4, maxSafe * 0.65));
  const balloonScale = isPopped ? 1.55 : 0.72 + Math.min(0.68, pumps * 0.085);

  const balloonGradient = isPopped
    ? 'radial-gradient(circle at 35% 30%, #FF8DA6, #FF4E4E 52%, #7F1D1D 100%)'
    : pressureRatio > 0.65
    ? 'radial-gradient(circle at 32% 28%, #FFE082, #F59E0B 45%, #DC2626 100%)'
    : pressureRatio > 0.3
    ? 'radial-gradient(circle at 32% 28%, #A7F3D0, #FFC800 52%, #B45309 100%)'
    : 'radial-gradient(circle at 32% 28%, #A7F3D0, #00C853 48%, #047857 100%)';

  const glowColor = isPopped
    ? 'rgba(255,78,78,0.55)'
    : pressureRatio > 0.65
    ? 'rgba(245,158,11,0.55)'
    : 'rgba(0,200,83,0.45)';

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      {/* Left Controls */}
      <div className="surface-card order-2 lg:order-1 rounded-xl p-4 lg:col-span-4 space-y-4">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 font-display text-sm font-bold text-fg">
            <Wind className="h-4 w-4 text-accent" />
            PUMP
          </span>
          <span className="rounded-full bg-gold/15 px-2 py-0.5 font-mono text-[10px] font-bold text-gold">
            STAKE VIRAL HIT
          </span>
        </div>

        <StakeInput
          stakeDollars={stakeDollars}
          onChange={setStakeDollars}
          balanceCents={user?.balanceCents ?? 0}
          disabled={isActive}
        />

        <div>
          <label className="mb-1.5 block text-[11px] font-semibold text-muted">
            Difficulty
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            {DIFFS.map((d) => (
              <button
                key={d.id}
                disabled={isActive}
                onClick={() => setDifficulty(d.id)}
                className={`rounded-xl border px-3 py-2 text-left transition ${
                  difficulty === d.id
                    ? 'border-accent/60 bg-accent/12 text-fg'
                    : 'border-fg/[0.06] bg-raised text-muted hover:border-fg/20'
                } disabled:opacity-50`}
              >
                <div className="text-xs font-bold">{d.label}</div>
                <div className="font-mono text-[10px] text-subtle">{d.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {isActive ? (
          <div className="space-y-2.5 pt-1">
            <button
              disabled={busy}
              onClick={doPump}
              className="w-full rounded-xl bg-gradient-to-b from-accent to-accentdeep py-3.5 font-display text-sm font-black text-onaccent shadow-[0_0_28px_rgba(0,200,83,0.4)] transition hover:brightness-110 active:scale-[0.97]"
            >
              PUMP BALLOON → {session!.nextMultiplier.toFixed(2)}x
              <div className="font-mono text-[10px] font-bold opacity-80">
                Pop Risk: {session!.nextPopChancePct}%
              </div>
            </button>

            <button
              disabled={busy || session!.pumps < 1}
              onClick={doCashout}
              className="w-full rounded-xl bg-gradient-to-b from-gold to-gold py-3 font-display text-sm font-black text-onaccent shadow-[0_0_24px_rgba(255,200,0,0.35)] transition hover:brightness-110 disabled:opacity-40"
            >
              CASH OUT {formatUsd(session!.currentPayoutCents)} ({session!.currentMultiplier.toFixed(2)}x)
            </button>
          </div>
        ) : (
          <button
            disabled={busy}
            onClick={startBalloon}
            className="w-full rounded-xl bg-gradient-to-b from-accent to-accentdeep py-3.5 font-display text-sm font-black text-onaccent shadow-[0_0_26px_rgba(0,200,83,0.35)] transition hover:brightness-110 active:scale-[0.98]"
          >
            {isPopped || isCashed ? 'NEW BALLOON' : 'START PUMPING'}
          </button>
        )}

        {session && (
          <div className="rounded-xl border border-fg/[0.06] bg-raised p-3 text-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="text-muted">Pumps Survived</span>
              <span className="font-mono font-bold text-fg">
                {session.pumps} / {session.maxSafePumps}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Current Multiplier</span>
              <span className="font-mono font-bold text-accent">
                {session.currentMultiplier.toFixed(2)}x
              </span>
            </div>
            {session.popAtPump != null && (
              <div className="flex justify-between border-t border-fg/[0.06] pt-1.5">
                <span className="text-muted">Provably-Fair Pop Limit</span>
                <span className="font-mono font-bold text-gold">
                  Pump #{session.popAtPump}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right Interactive Inflating Balloon Stage */}
      <div className="surface-card order-1 lg:order-2 relative flex min-h-[340px] sm:min-h-[440px] flex-col items-center justify-between overflow-hidden rounded-xl p-4 sm:p-6 lg:col-span-8">
        {/* Top Multiplier Ladder Strip */}
        <div className="flex w-full items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Flame className="h-4 w-4 text-gold" />
            <span className="font-mono text-xs text-muted">
              Pressure:{' '}
              <strong className="text-fg">
                {Math.round(pressureRatio * 100)}%
              </strong>
            </span>
          </div>
          {isCashed && (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent/20 px-3 py-1 font-mono text-xs font-bold text-accent">
              <Sparkles className="h-3.5 w-3.5" />
              CASHED OUT +{formatUsd(session!.currentPayoutCents)}
            </span>
          )}
          {isPopped && (
            <span className="rounded-full bg-danger/20 px-3 py-1 font-mono text-xs font-bold text-danger">
              BURST ON PUMP #{session!.pumps}
            </span>
          )}
        </div>

        {/* Center 3D Glowing Balloon */}
        <div className="relative flex flex-1 flex-col items-center justify-center py-6">
          <button
            type="button"
            disabled={!isActive || busy}
            onClick={doPump}
            className="relative flex items-center justify-center focus:outline-none disabled:cursor-default group"
          >
            {/* Outer aura */}
            <div
              className="absolute rounded-full blur-3xl transition-all duration-300"
              style={{
                width: `${210 * balloonScale}px`,
                height: `${210 * balloonScale}px`,
                background: glowColor,
                opacity: isPopped ? 0.65 : 0.35 + pressureRatio * 0.35,
              }}
            />

            {isPopped ? (
              <div className="relative flex h-44 w-44 flex-col items-center justify-center rounded-full border-2 border-dashed border-danger bg-danger/10">
                <span className="font-display text-3xl font-black text-danger">
                  POPPED!
                </span>
                <span className="mt-1 font-mono text-xs text-fg2">
                  0.00x
                </span>
              </div>
            ) : (
              <div
                className="relative flex flex-col items-center justify-center rounded-full transition-all duration-200 select-none"
                style={{
                  width: `${175 * balloonScale}px`,
                  height: `${192 * balloonScale}px`,
                  background: balloonGradient,
                  boxShadow: `inset -14px -18px 34px rgba(0,0,0,0.42), inset 10px 10px 26px rgba(255,255,255,0.35), 0 0 55px ${glowColor}`,
                  transform: pumpPulse ? 'scale(1.07)' : 'scale(1)',
                }}
              >
                {/* Specular highlight */}
                <div className="pointer-events-none absolute left-[20%] top-[15%] h-10 w-6 -rotate-25 rounded-full bg-fg/35 blur-[2px]" />

                <span className="font-mono text-3xl sm:text-4xl font-black text-onaccent drop-shadow-sm tabular-nums">
                  {(session?.currentMultiplier ?? 1).toFixed(2)}x
                </span>
                <span className="mt-0.5 font-mono text-[11px] font-extrabold uppercase tracking-wider text-onaccent/75">
                  {isActive ? 'TAP TO PUMP' : isCashed ? 'SAFE!' : 'READY'}
                </span>
              </div>
            )}
          </button>

          {/* Balloon Nozzle + Air Pump Base */}
          {!isPopped && (
            <div className="mt-1 flex flex-col items-center">
              <div className="h-3 w-5 rounded-b-lg bg-overlay" />
              <div className="h-6 w-1.5 bg-overlay" />
              <div className="h-3 w-20 rounded-full border border-fg/15 bg-overlay shadow-lg" />
            </div>
          )}
        </div>

        {/* Bottom Pressure Gauge */}
        <div className="w-full">
          <div className="mb-1.5 flex justify-between font-mono text-[10px] text-subtle">
            <span>SAFE ZONE</span>
            <span>HIGH VOLATILITY</span>
            <span>BURST DANGER</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-fg/[0.06]">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${Math.max(4, pressureRatio * 100)}%`,
                background:
                  'linear-gradient(90deg, #00C853 0%, #FFC800 60%, #FF4E4E 100%)',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
