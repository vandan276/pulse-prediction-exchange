import React, { useEffect, useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { ToastItem, UserProfile } from '../../types';
import { formatUsd } from '../../utils/format';
import { StakeInput } from './BetControls';

const PLINKO_TABLES: Record<number, Record<'low' | 'medium' | 'high', number[]>> = {
  8: {
    low: [5.6, 2.1, 1.1, 1.0, 0.5, 1.0, 1.1, 2.1, 5.6],
    medium: [13, 3, 1.3, 0.7, 0.4, 0.7, 1.3, 3, 13],
    high: [29, 4, 1.5, 0.3, 0.2, 0.3, 1.5, 4, 29],
  },
  12: {
    low: [10, 3, 1.6, 1.4, 1.1, 1.0, 0.5, 1.0, 1.1, 1.4, 1.6, 3, 10],
    medium: [33, 11, 4, 2, 1.1, 0.6, 0.3, 0.6, 1.1, 2, 4, 11, 33],
    high: [170, 24, 8.1, 2, 0.7, 0.2, 0.2, 0.2, 0.7, 2, 8.1, 24, 170],
  },
  16: {
    low: [16, 9, 2, 1.4, 1.4, 1.2, 1.1, 1.0, 0.5, 1.0, 1.1, 1.2, 1.4, 1.4, 2, 9, 16],
    medium: [110, 41, 10, 5, 3, 1.5, 1, 0.5, 0.3, 0.5, 1, 1.5, 3, 5, 10, 41, 110],
    high: [1000, 130, 26, 9, 4, 2, 0.2, 0.2, 0.2, 0.2, 0.2, 2, 4, 9, 26, 130, 1000],
  },
};

interface ActiveBall {
  id: string;
  path: number[];
  rows: number;
  bucketIndex: number;
  multiplier: number;
  payoutCents: number;
  startedAt: number;
  stepDurationMs: number;
}

interface PlinkoGameProps {
  user: UserProfile | null;
  onUserUpdated: (user: UserProfile) => void;
  onToast: (title: string, subtitle: string | undefined, tone: ToastItem['tone']) => void;
  onOpenUserModal: () => void;
}

export const PlinkoGame: React.FC<PlinkoGameProps> = ({
  user,
  onUserUpdated,
  onToast,
  onOpenUserModal,
}) => {
  const [stakeDollars, setStakeDollars] = useState('10');
  const [rows, setRows] = useState<8 | 12 | 16>(12);
  const [risk, setRisk] = useState<'low' | 'medium' | 'high'>('medium');
  const [recentHits, setRecentHits] = useState<Array<{ mult: number; payout: number }>>([]);
  const [dropping, setDropping] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ballsRef = useRef<ActiveBall[]>([]);
  const pegGlowRef = useRef<Map<string, number>>(new Map());
  const bucketFlashRef = useRef<Map<number, number>>(new Map());

  const buckets = PLINKO_TABLES[rows][risk];

  // 60fps Canvas peg pyramid + bouncing balls animation loop
  useEffect(() => {
    let rafId = 0;

    const render = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const dpr = Math.min(window.devicePixelRatio || 1, 2);
          const width = 660;
          const height = 430;
          if (canvas.width !== width * dpr) {
            canvas.width = width * dpr;
            canvas.height = height * dpr;
          }
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          ctx.clearRect(0, 0, width, height);

          const now = performance.now();
          const padTop = 34;
          const padBottom = 52;
          const usableH = height - padTop - padBottom;
          const spacingY = usableH / rows;
          const spacingX = Math.min(36, (width - 80) / (rows + 2));
          const centerX = width / 2;

          const pegPos = (r: number, c: number) => {
            const countInRow = r + 3;
            const rowW = (countInRow - 1) * spacingX;
            return {
              x: centerX - rowW / 2 + c * spacingX,
              y: padTop + r * spacingY,
            };
          };

          const isLight = document.documentElement.classList.contains('light');
          // Draw Pegs
          const pegRadius = rows === 16 ? 3.2 : rows === 12 ? 4 : 5;
          for (let r = 0; r < rows; r++) {
            const count = r + 3;
            for (let c = 0; c < count; c++) {
              const { x, y } = pegPos(r, c);
              const hitAt = pegGlowRef.current.get(`${r}_${c}`);
              const age = hitAt ? (now - hitAt) / 350 : 99;

              if (age < 1) {
                ctx.beginPath();
                ctx.arc(x, y, pegRadius + 6 * (1 - age), 0, Math.PI * 2);
                ctx.fillStyle = `rgba(5, 150, 105, ${0.45 * (1 - age)})`;
                ctx.fill();
              }

              ctx.beginPath();
              ctx.arc(x, y, pegRadius, 0, Math.PI * 2);
              ctx.fillStyle =
                age < 1
                  ? '#059669'
                  : isLight
                  ? '#334155'
                  : 'rgba(228, 228, 231, 0.72)';
              ctx.fill();
            }
          }

          // Draw Multiplier Buckets
          const bucketCount = rows + 1;
          const bucketW = spacingX - 4;
          const bucketY = padTop + rows * spacingY + 8;
          const firstBucketX = centerX - ((bucketCount - 1) * spacingX) / 2;

          for (let i = 0; i < bucketCount; i++) {
            const bx = firstBucketX + i * spacingX;
            const mult = buckets[i] ?? 0;
            const flashAt = bucketFlashRef.current.get(i);
            const flashAge = flashAt ? (now - flashAt) / 400 : 99;
            const bounceY = flashAge < 1 ? Math.sin(flashAge * Math.PI) * 5 : 0;

            const fillColor =
              mult >= 10
                ? '#FFC800'
                : mult >= 2
                ? '#00C853'
                : mult >= 1
                ? '#38BDF8'
                : '#FF4E4E';

            ctx.save();
            if (flashAge < 1) {
              ctx.shadowColor = fillColor;
              ctx.shadowBlur = 16;
            }
            ctx.fillStyle = fillColor;
            ctx.globalAlpha = flashAge < 1 ? 1 : 0.85;
            ctx.beginPath();
            ctx.roundRect(bx - bucketW / 2, bucketY + bounceY, bucketW, 28, 6);
            ctx.fill();
            ctx.restore();

            ctx.fillStyle = '#0A0B0E';
            ctx.font = `800 ${rows === 16 ? 8.5 : 10}px "JetBrains Mono", monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(
              mult >= 100 ? `${mult}` : `${mult}x`,
              bx,
              bucketY + 14 + bounceY
            );
          }

          // Animate Falling Balls along exact provably-fair path
          const surviving: ActiveBall[] = [];
          for (const ball of ballsRef.current) {
            const elapsed = now - ball.startedAt;
            const totalSteps = ball.rows;
            const rawStep = elapsed / ball.stepDurationMs;

            if (rawStep >= totalSteps) {
              bucketFlashRef.current.set(ball.bucketIndex, now);
              setRecentHits((prev) =>
                [{ mult: ball.multiplier, payout: ball.payoutCents }, ...prev].slice(0, 10)
              );
              continue;
            }

            surviving.push(ball);
            const stepIdx = Math.floor(rawStep);
            const t = rawStep - stepIdx;

            // Compute horizontal slot before and after bounce
            let rightsBefore = 0;
            for (let k = 0; k < stepIdx; k++) rightsBefore += ball.path[k];
            const dir = ball.path[stepIdx]; // 0 = left, 1 = right
            const rightsAfter = rightsBefore + dir;

            // Trigger peg glow when crossing row
            if (t < 0.25) {
              pegGlowRef.current.set(`${stepIdx}_${rightsBefore + 1}`, now);
            }

            const startX = centerX + (rightsBefore - stepIdx / 2) * spacingX;
            const endX = centerX + (rightsAfter - (stepIdx + 1) / 2) * spacingX;
            const startY = padTop + stepIdx * spacingY - 8;
            const endY = padTop + (stepIdx + 1) * spacingY - 8;

            const bx = startX + (endX - startX) * t;
            // Subtle parabolic bounce arc between pegs
            const arc = Math.sin(t * Math.PI) * -9;
            const by = startY + (endY - startY) * (t * t) + arc;

            ctx.save();
            ctx.shadowColor = '#00C853';
            ctx.shadowBlur = 14;
            ctx.beginPath();
            ctx.arc(bx, by, rows === 16 ? 5 : 6.5, 0, Math.PI * 2);
            ctx.fillStyle = '#00C853';
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.restore();
          }
          ballsRef.current = surviving;
        }
      }

      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafId);
  }, [rows, risk, buckets]);

  const dropBall = async () => {
    if (!user) return onOpenUserModal();
    setDropping(true);
    try {
      const stakeCents = Math.round((parseFloat(stakeDollars) || 0) * 100);
      const res = await fetch('/api/originals/plinko/drop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, stakeCents, rows, risk }),
      });
      const data = await res.json();
      if (!res.ok) {
        onToast('Plinko', data.error || 'Could not drop ball', 'amber');
        return;
      }
      onUserUpdated(data.user);
      ballsRef.current.push({
        id: data.record.id,
        path: data.outcome.path,
        rows: data.outcome.rows,
        bucketIndex: data.outcome.bucketIndex,
        multiplier: data.outcome.multiplier,
        payoutCents: data.record.payoutCents,
        startedAt: performance.now(),
        stepDurationMs: rows === 16 ? 115 : 135,
      });
      if (data.outcome.multiplier >= 5) {
        onToast(
          `PLINKO ${data.outcome.multiplier}x HIT!`,
          `Won ${formatUsd(data.record.payoutCents)}`,
          'emerald'
        );
      }
    } finally {
      setDropping(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      <div className="surface-card order-2 lg:order-1 rounded-xl p-4 lg:col-span-4 space-y-4">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 font-display text-sm font-bold text-fg">
            <Sparkles className="h-4 w-4 text-gold" />
            PLINKO
          </span>
          <span className="font-mono text-[11px] text-gold">
            MAX {Math.max(...buckets)}x
          </span>
        </div>

        <StakeInput
          stakeDollars={stakeDollars}
          onChange={setStakeDollars}
          balanceCents={user?.balanceCents ?? 0}
        />

        <div>
          <label className="mb-1.5 block text-[11px] font-semibold text-muted">
            Risk Level
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            {(['low', 'medium', 'high'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRisk(r)}
                className={`rounded-xl border py-2 text-xs font-bold capitalize transition ${
                  risk === r
                    ? 'border-accent/60 bg-accent/15 text-accent'
                    : 'border-fg/[0.06] bg-raised text-muted hover:text-fg'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-[11px] font-semibold text-muted">
            Peg Rows
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            {([8, 12, 16] as const).map((n) => (
              <button
                key={n}
                onClick={() => {
                  ballsRef.current = [];
                  setRows(n);
                }}
                className={`rounded-xl border py-2 font-mono text-xs font-bold transition ${
                  rows === n
                    ? 'border-fg bg-fg text-inverse'
                    : 'border-fg/[0.06] bg-raised text-muted hover:text-fg'
                }`}
              >
                {n} Rows
              </button>
            ))}
          </div>
        </div>

        <button
          disabled={dropping}
          onClick={dropBall}
          className="w-full rounded-xl bg-gradient-to-b from-accent to-accentdeep py-3.5 font-display text-sm font-black text-onaccent shadow-[0_0_26px_rgba(0,200,83,0.38)] transition hover:brightness-110 active:scale-[0.98]"
        >
          DROP BALL
        </button>

        {recentHits.length > 0 && (
          <div className="space-y-1.5 border-t border-fg/[0.06] pt-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-subtle">
              Recent Drops
            </div>
            <div className="flex flex-wrap gap-1.5">
              {recentHits.map((h, i) => (
                <span
                  key={i}
                  className={`rounded-lg px-2 py-1 font-mono text-[11px] font-bold ${
                    h.mult >= 5
                      ? 'bg-gold/20 text-gold'
                      : h.mult >= 1
                      ? 'bg-accent/15 text-accent'
                      : 'bg-danger/15 text-danger'
                  }`}
                >
                  {h.mult}x
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Right 60fps Peg Pyramid Canvas */}
      <div className="surface-card order-1 lg:order-2 flex items-center justify-center rounded-xl p-4 lg:col-span-8">
        <canvas
          ref={canvasRef}
          className="h-auto w-full max-w-[660px]"
          style={{ aspectRatio: '660 / 430' }}
        />
      </div>
    </div>
  );
};
