import React, { useEffect, useRef, useState } from 'react';
import { Bot, Flame, Rocket, Users } from 'lucide-react';
import { CrashState, ToastItem, UserProfile } from '../../types';
import { formatUsd } from '../../utils/format';
import { StakeInput } from './BetControls';

interface CrashGameProps {
  crashState: CrashState | null;
  user: UserProfile | null;
  nowMs: number;
  onUserUpdated: (user: UserProfile) => void;
  onToast: (title: string, subtitle: string | undefined, tone: ToastItem['tone']) => void;
  onOpenUserModal: () => void;
}

export const CrashGame: React.FC<CrashGameProps> = ({
  crashState,
  user,
  nowMs,
  onUserUpdated,
  onToast,
  onOpenUserModal,
}) => {
  const [stakeDollars, setStakeDollars] = useState('10');
  const [autoCashout, setAutoCashout] = useState('2.00');
  const [busy, setBusy] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [size, setSize] = useState({ width: 760, height: 380 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        const { width, height } = e.contentRect;
        if (width > 0 && height > 0) {
          setSize({ width: Math.floor(width), height: Math.floor(height) });
        }
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const myBet =
    user && crashState
      ? crashState.players.find((p) => p.userId === user.id)
      : null;

  // High-DPI 60fps glowing rocket curve canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !crashState) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const { width, height } = size;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.clearRect(0, 0, width, height);

    const padL = 54;
    const padR = 26;
    const padT = 36;
    const padB = 34;
    const w = Math.max(60, width - padL - padR);
    const h = Math.max(60, height - padT - padB);

    const mult = crashState.multiplier || 1.0;
    const isCrashed = crashState.phase === 'CRASHED';
    const isFlying = crashState.phase === 'FLYING';

    const maxY = Math.max(2.0, mult * 1.18);
    const elapsedSec =
      isFlying || isCrashed
        ? Math.max(0.2, Math.log(Math.max(1.01, mult)) / 0.068)
        : 0;
    const maxSec = Math.max(10, elapsedSec * 1.12);

    const isLight = document.documentElement.classList.contains('light');
    // Subtle grid lines
    ctx.font = '500 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    const ySteps = 4;
    for (let i = 0; i <= ySteps; i++) {
      const val = 1 + ((maxY - 1) * i) / ySteps;
      const y = padT + h - (i / ySteps) * h;
      ctx.strokeStyle = isLight ? 'rgba(15,23,42,0.07)' : 'rgba(255,255,255,0.045)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(padL + w, y);
      ctx.stroke();

      ctx.fillStyle = isLight ? '#64748B' : 'rgba(161,161,170,0.6)';
      ctx.fillText(`${val.toFixed(2)}x`, padL - 10, y);
    }

    // X-axis seconds
    ctx.textAlign = 'center';
    for (let i = 0; i <= 4; i++) {
      const sec = (maxSec * i) / 4;
      const x = padL + (i / 4) * w;
      ctx.fillStyle = isLight ? '#64748B' : 'rgba(161,161,170,0.5)';
      ctx.fillText(`${sec.toFixed(0)}s`, x, height - 12);
    }

    if (isFlying || isCrashed) {
      const strokeColor = isCrashed
        ? '#FF4E4E'
        : mult >= 5
        ? '#FFC800'
        : '#00C853';

      const samples = 70;
      const pts: Array<{ x: number; y: number }> = [];
      for (let i = 0; i <= samples; i++) {
        const t = (elapsedSec * i) / samples;
        const m = Math.min(mult, Math.exp(0.068 * t));
        const x = padL + (t / maxSec) * w;
        const y = padT + h - ((m - 1) / (maxY - 1)) * h;
        pts.push({ x, y });
      }

      // Area fill
      ctx.beginPath();
      pts.forEach((pt, idx) => {
        if (idx === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      });
      const tip = pts[pts.length - 1];
      ctx.lineTo(tip.x, padT + h);
      ctx.lineTo(padL, padT + h);
      ctx.closePath();

      const grad = ctx.createLinearGradient(0, padT, 0, padT + h);
      grad.addColorStop(
        0,
        isCrashed
          ? 'rgba(255,78,78,0.28)'
          : mult >= 5
          ? 'rgba(255,200,0,0.28)'
          : 'rgba(0,200,83,0.28)'
      );
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.fill();

      // Glowing Curve Stroke
      ctx.save();
      ctx.shadowColor = strokeColor;
      ctx.shadowBlur = 16;
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      pts.forEach((pt, idx) => {
        if (idx === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      });
      ctx.stroke();
      ctx.restore();

      // Glowing Tip Beacon
      ctx.beginPath();
      ctx.arc(tip.x, tip.y, 11, 0, Math.PI * 2);
      ctx.fillStyle = isCrashed
        ? 'rgba(255,78,78,0.25)'
        : 'rgba(0,200,83,0.25)';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(tip.x, tip.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      // Floating cashed-out markers on the curve
      const cashed = crashState.players
        .filter((p) => p.status === 'CASHED_OUT' && p.cashoutMultiplier != null)
        .slice(0, 5);
      ctx.font = '700 10px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      for (const p of cashed) {
        const cm = p.cashoutMultiplier!;
        const ct = Math.log(Math.max(1.01, cm)) / 0.068;
        const cx = padL + Math.min(1, ct / maxSec) * w;
        const cy = padT + h - ((cm - 1) / (maxY - 1)) * h;
        ctx.fillStyle = '#00C853';
        ctx.beginPath();
        ctx.arc(cx, cy, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(0,200,83,0.85)';
        ctx.fillText(`${p.username} @${cm.toFixed(2)}x`, cx + 7, cy - 4);
      }
    }
  }, [crashState, size]);

  const handleBet = async () => {
    if (!user) return onOpenUserModal();
    setBusy(true);
    try {
      const stakeCents = Math.round((parseFloat(stakeDollars) || 0) * 100);
      const parsedAuto = parseFloat(autoCashout);
      const res = await fetch('/api/originals/crash/bet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          stakeCents,
          autoCashout: parsedAuto >= 1.01 ? parsedAuto : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        onToast('Crash Entry', data.error || 'Could not place bet', 'amber');
        return;
      }
      onUserUpdated(data.user);
      onToast(
        `Crash Bet Placed (${formatUsd(stakeCents)})`,
        parsedAuto >= 1.01 ? `Auto cashout @ ${parsedAuto.toFixed(2)}x` : 'Manual cashout',
        'sky'
      );
    } finally {
      setBusy(false);
    }
  };

  const handleCashout = async () => {
    if (!user) return;
    setBusy(true);
    try {
      const res = await fetch('/api/originals/crash/cashout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        onToast('Cash Out', data.error || 'Too late — crashed!', 'rose');
        return;
      }
      onUserUpdated(data.user);
      onToast(
        `CRASHED OUT @ ${data.entry.cashoutMultiplier.toFixed(2)}x!`,
        `Won ${formatUsd(data.entry.payoutCents)}`,
        'emerald'
      );
    } finally {
      setBusy(false);
    }
  };

  const bettingSecsLeft = crashState
    ? Math.max(0, (crashState.phaseEndsAt - nowMs) / 1000)
    : 0;
  const canBet = crashState?.phase === 'BETTING' && !myBet;
  const canCashout =
    crashState?.phase === 'FLYING' && myBet?.status === 'ACTIVE';

  const liveCashoutCents =
    myBet && crashState
      ? Math.floor(myBet.stakeCents * crashState.multiplier)
      : 0;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      {/* Left Bet Controls */}
      <div className="surface-card order-2 lg:order-1 rounded-xl p-4 lg:col-span-3 space-y-4">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 font-display text-sm font-bold text-fg">
            <Rocket className="h-4 w-4 text-accent" />
            CRASH LIVE
          </span>
          <span className="font-mono text-[11px] text-subtle">
            #{crashState?.roundNumber ?? '—'}
          </span>
        </div>

        <StakeInput
          stakeDollars={stakeDollars}
          onChange={setStakeDollars}
          balanceCents={user?.balanceCents ?? 0}
          disabled={Boolean(myBet && crashState?.phase !== 'CRASHED')}
        />

        <div>
          <label className="mb-1.5 block text-[11px] font-semibold text-muted">
            Auto Cashout (optional)
          </label>
          <div className="flex items-center rounded-xl border border-fg/[0.09] bg-raised px-3">
            <input
              type="number"
              min="1.01"
              step="0.1"
              value={autoCashout}
              onChange={(e) => setAutoCashout(e.target.value)}
              placeholder="2.00"
              className="w-full bg-transparent py-2.5 font-mono text-sm font-bold text-fg outline-none tabular-nums"
            />
            <span className="font-mono text-xs font-bold text-muted">×</span>
          </div>
        </div>

        {canCashout ? (
          <button
            disabled={busy}
            onClick={handleCashout}
            className="w-full rounded-xl bg-gradient-to-b from-gold to-gold py-3.5 font-display text-sm font-black text-onaccent shadow-[0_0_28px_rgba(255,200,0,0.45)] transition hover:brightness-110 active:scale-[0.98]"
          >
            CASH OUT {formatUsd(liveCashoutCents)}
            <div className="font-mono text-[11px] font-bold">
              @ {crashState!.multiplier.toFixed(2)}x
            </div>
          </button>
        ) : (
          <button
            disabled={busy || !canBet}
            onClick={handleBet}
            className="w-full rounded-xl bg-gradient-to-b from-accent to-accentdeep py-3.5 font-display text-sm font-black text-onaccent shadow-[0_0_24px_rgba(0,200,83,0.35)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {myBet?.status === 'CASHED_OUT'
              ? `CASHED OUT @ ${myBet.cashoutMultiplier?.toFixed(2)}x`
              : myBet?.status === 'ACTIVE'
              ? 'LOCKED IN — READY FOR LAUNCH'
              : crashState?.phase === 'BETTING'
              ? `BET NEXT LAUNCH (${bettingSecsLeft.toFixed(1)}s)`
              : 'WAIT FOR NEXT ROUND'}
          </button>
        )}

        {/* Live Multiplayer Crash Players */}
        <div className="border-t border-fg/[0.06] pt-3">
          <div className="mb-2 flex items-center justify-between text-[11px]">
            <span className="flex items-center gap-1 font-semibold text-muted">
              <Users className="h-3.5 w-3.5 text-accent" />
              Live Players ({crashState?.players.length ?? 0})
            </span>
            <span className="font-mono text-subtle">
              {formatUsd(
                (crashState?.players || []).reduce((s, p) => s + p.stakeCents, 0)
              )}
            </span>
          </div>
          <div className="max-h-[210px] space-y-1.5 overflow-y-auto pr-0.5">
            {(crashState?.players || []).map((p) => (
              <div
                key={p.betId}
                className={`flex items-center justify-between rounded-lg border px-2.5 py-1.5 text-[11px] ${
                  p.status === 'CASHED_OUT'
                    ? 'border-accent/30 bg-accent/[0.07]'
                    : p.status === 'BUSTED'
                    ? 'border-danger/25 bg-danger/[0.05]'
                    : 'border-fg/[0.05] bg-raised'
                }`}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className="h-2 w-2 rounded-full shrink-0"
                    style={{ backgroundColor: p.avatarColor }}
                  />
                  <span className="truncate font-semibold text-fg">
                    {p.username}
                  </span>
                  {p.isBot && <Bot className="h-2.5 w-2.5 text-subtle" />}
                </div>
                <div className="font-mono tabular-nums">
                  {p.status === 'CASHED_OUT' ? (
                    <span className="font-bold text-accent">
                      {p.cashoutMultiplier?.toFixed(2)}x · +{formatUsd(p.payoutCents)}
                    </span>
                  ) : p.status === 'BUSTED' ? (
                    <span className="text-danger">BUST</span>
                  ) : (
                    <span className="text-muted">{formatUsd(p.stakeCents)}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right High-DPI Live Rocket Stage */}
      <div className="surface-card order-1 lg:order-2 rounded-xl p-4 lg:col-span-9 flex flex-col">
        {/* Recent Crash History Pills */}
        <div className="mb-3 flex items-center gap-1.5 overflow-x-auto pb-1">
          <Flame className="h-4 w-4 shrink-0 text-gold" />
          {(crashState?.history || []).map((val, i) => (
            <span
              key={`${val}_${i}`}
              className={`shrink-0 rounded-full px-2.5 py-0.5 font-mono text-[11px] font-bold tabular-nums ${
                val >= 10
                  ? 'bg-gold/20 text-gold ring-1 ring-gold/40'
                  : val >= 2
                  ? 'bg-accent/15 text-accent'
                  : 'bg-danger/15 text-danger'
              }`}
            >
              {val.toFixed(2)}x
            </span>
          ))}
        </div>

        {/* Canvas + Giant Center Multiplier HUD */}
        <div
          ref={containerRef}
          className="relative flex-1 min-h-[380px] overflow-hidden rounded-xl border border-fg/[0.06] bg-raised"
        >
          <canvas ref={canvasRef} className="h-full w-full" />

          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            {crashState?.phase === 'BETTING' ? (
              <div className="text-center">
                <div className="text-xs font-bold uppercase tracking-[0.2em] text-muted">
                  Launching In
                </div>
                <div className="mt-1 font-mono text-6xl font-black text-fg tabular-nums">
                  {bettingSecsLeft.toFixed(1)}s
                </div>
                <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
                  Place bets before takeoff
                </div>
              </div>
            ) : (
              <div className="text-center">
                <div
                  className={`font-mono text-6xl sm:text-7xl font-black tracking-tight tabular-nums ${
                    crashState?.phase === 'CRASHED'
                      ? 'text-danger drop-shadow-[0_0_28px_rgba(255,78,78,0.5)]'
                      : (crashState?.multiplier ?? 1) >= 5
                      ? 'text-gold drop-shadow-[0_0_28px_rgba(255,200,0,0.45)]'
                      : 'text-accent drop-shadow-[0_0_28px_rgba(0,200,83,0.45)]'
                  }`}
                >
                  {(crashState?.multiplier ?? 1).toFixed(2)}x
                </div>
                {crashState?.phase === 'CRASHED' && (
                  <div className="mt-2 inline-flex items-center rounded-full border border-danger/40 bg-danger/15 px-3.5 py-1 font-display text-xs font-black uppercase tracking-widest text-danger">
                    CRASHED @ {crashState.crashPoint?.toFixed(2)}x
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
