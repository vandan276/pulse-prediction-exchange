import React, { useEffect, useRef, useState } from 'react';
import { Disc3 } from 'lucide-react';
import { ToastItem, UserProfile } from '../../types';
import { formatUsd } from '../../utils/format';
import { StakeInput } from './BetControls';

interface WheelGameProps {
  user: UserProfile | null;
  onUserUpdated: (user: UserProfile) => void;
  onToast: (title: string, subtitle: string | undefined, tone: ToastItem['tone']) => void;
  onOpenUserModal: () => void;
}

function colorForMultiplier(m: number): string {
  if (m === 0) return '#181C24';
  if (m >= 10) return '#F5B731';
  if (m >= 3) return '#A855F7';
  if (m >= 2) return '#00E599';
  if (m >= 1.5) return '#38BDF8';
  return '#10B981';
}

export const WheelGame: React.FC<WheelGameProps> = ({
  user,
  onUserUpdated,
  onToast,
  onOpenUserModal,
}) => {
  const [stakeDollars, setStakeDollars] = useState('10');
  const [segments, setSegments] = useState<10 | 20 | 30 | 40 | 50>(20);
  const [risk, setRisk] = useState<'low' | 'medium' | 'high'>('medium');
  const [wheel, setWheel] = useState<number[]>([]);
  const [rotation, setRotation] = useState(0);
  const [lastResult, setLastResult] = useState<{ mult: number; payout: number } | null>(null);
  const [spinning, setSpinning] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/originals/wheel/segments?segments=${segments}&risk=${risk}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && Array.isArray(d.wheel)) setWheel(d.wheel);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [segments, risk]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || wheel.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const size = 380;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);

    const cx = size / 2;
    const cy = size / 2;
    const outerR = 168;
    const innerR = 112;
    const step = (Math.PI * 2) / wheel.length;

    const isLight = document.documentElement.classList.contains('light');
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotation - Math.PI / 2);

    wheel.forEach((m, idx) => {
      const a0 = idx * step;
      const a1 = a0 + step;
      ctx.beginPath();
      ctx.arc(0, 0, outerR, a0, a1);
      ctx.arc(0, 0, innerR, a1, a0, true);
      ctx.closePath();
      ctx.fillStyle = m === 0 && isLight ? '#E2E8F0' : colorForMultiplier(m);
      ctx.fill();
      ctx.strokeStyle = isLight ? '#FFFFFF' : '#040507';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Label along rim for <= 30 segments
      if (wheel.length <= 30 && m > 0) {
        const mid = (a0 + a1) / 2;
        ctx.save();
        ctx.rotate(mid);
        ctx.fillStyle = '#040507';
        ctx.font = '800 10px "IBM Plex Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${m}x`, (outerR + innerR) / 2, 0);
        ctx.restore();
      }
    });
    ctx.restore();

    // Inner hub
    ctx.beginPath();
    ctx.arc(cx, cy, innerR - 6, 0, Math.PI * 2);
    ctx.fillStyle = isLight ? '#FFFFFF' : '#07090D';
    ctx.fill();
    ctx.strokeStyle = isLight ? '#E2E8F0' : 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Top golden pointer triangle
    ctx.beginPath();
    ctx.moveTo(cx, cy - outerR + 12);
    ctx.lineTo(cx - 11, cy - outerR - 14);
    ctx.lineTo(cx + 11, cy - outerR - 14);
    ctx.closePath();
    ctx.fillStyle = '#F5B731';
    ctx.fill();
    ctx.strokeStyle = '#040507';
    ctx.lineWidth = 2;
    ctx.stroke();
  }, [wheel, rotation]);

  const spinWheel = async () => {
    if (!user) return onOpenUserModal();
    if (spinning) return;
    setSpinning(true);
    try {
      const stakeCents = Math.round((parseFloat(stakeDollars) || 0) * 100);
      const res = await fetch('/api/originals/wheel/spin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, stakeCents, segments, risk }),
      });
      const data = await res.json();
      if (!res.ok) {
        onToast('Wheel', data.error || 'Failed to spin', 'amber');
        setSpinning(false);
        return;
      }

      const n = data.outcome.wheel.length;
      const step = (Math.PI * 2) / n;
      const targetIndex = data.outcome.index;
      // Rotate so targetIndex lands directly under the top pointer
      const targetAngleMod = -(targetIndex + 0.5) * step;
      const startRot = rotation;
      const fullSpins = Math.PI * 2 * 5;
      const normCurrent = ((startRot % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      const normTarget = ((targetAngleMod % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      const delta = fullSpins + ((normTarget - normCurrent + Math.PI * 2) % (Math.PI * 2));
      const endRot = startRot + delta;

      const t0 = performance.now();
      const duration = 2200;
      const animate = (now: number) => {
        const p = Math.min(1, (now - t0) / duration);
        const eased = 1 - Math.pow(1 - p, 4);
        setRotation(startRot + delta * eased);
        if (p < 1) {
          requestAnimationFrame(animate);
        } else {
          setRotation(endRot);
          setSpinning(false);
          setLastResult({
            mult: data.outcome.multiplier,
            payout: data.record.payoutCents,
          });
          onUserUpdated(data.user);
          if (data.outcome.multiplier > 0) {
            onToast(
              `WHEEL LANDED ON ${data.outcome.multiplier}x!`,
              `Won ${formatUsd(data.record.payoutCents)}`,
              'emerald'
            );
          }
        }
      };
      requestAnimationFrame(animate);
    } catch {
      setSpinning(false);
    }
  };

  const uniqueMults = [...new Set(wheel)].sort((a, b) => a - b);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      <div className="surface-card order-2 lg:order-1 rounded-2xl p-4 lg:col-span-4 space-y-4">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 font-display text-sm font-bold text-white">
            <Disc3 className="h-4 w-4 text-[#A855F7]" />
            WHEEL
          </span>
          <span className="font-mono text-[11px] text-[#F5B731]">
            MAX {wheel.length ? Math.max(...wheel) : 0}x
          </span>
        </div>

        <StakeInput
          stakeDollars={stakeDollars}
          onChange={setStakeDollars}
          balanceCents={user?.balanceCents ?? 0}
          disabled={spinning}
        />

        <div>
          <label className="mb-1.5 block text-[11px] font-semibold text-zinc-400">
            Risk
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            {(['low', 'medium', 'high'] as const).map((r) => (
              <button
                key={r}
                disabled={spinning}
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

        <div>
          <label className="mb-1.5 block text-[11px] font-semibold text-zinc-400">
            Segments
          </label>
          <div className="grid grid-cols-5 gap-1">
            {([10, 20, 30, 40, 50] as const).map((s) => (
              <button
                key={s}
                disabled={spinning}
                onClick={() => setSegments(s)}
                className={`rounded-lg border py-1.5 font-mono text-xs font-bold transition ${
                  segments === s
                    ? 'border-white bg-white text-[#040507]'
                    : 'border-white/[0.06] bg-[#05070A] text-zinc-400 hover:text-white'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <button
          disabled={spinning}
          onClick={spinWheel}
          className="w-full rounded-xl bg-gradient-to-b from-[#00F0A0] to-[#00C480] py-3.5 font-display text-sm font-black text-[#040507] shadow-[0_0_26px_rgba(0,229,153,0.38)] transition hover:brightness-110 disabled:opacity-50"
        >
          {spinning ? 'SPINNING...' : 'SPIN WHEEL'}
        </button>
      </div>

      {/* Right Spinning Canvas */}
      <div className="surface-card order-1 lg:order-2 flex flex-col items-center justify-center rounded-2xl p-4 sm:p-6 lg:col-span-8">
        <div className="relative flex items-center justify-center">
          <canvas
            ref={canvasRef}
            className="h-[340px] w-[340px] sm:h-[380px] sm:w-[380px]"
          />
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span
              className={`font-mono text-3xl font-black tabular-nums ${
                lastResult == null
                  ? 'text-white'
                  : lastResult.mult > 0
                  ? 'text-[#00E599]'
                  : 'text-[#FF3B69]'
              }`}
            >
              {lastResult != null ? `${lastResult.mult}x` : 'SPIN'}
            </span>
            {lastResult != null && lastResult.payout > 0 && (
              <span className="mt-0.5 font-mono text-xs font-bold text-[#F5B731]">
                +{formatUsd(lastResult.payout)}
              </span>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {uniqueMults.map((m) => (
            <div
              key={m}
              className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-[#05070A] px-2.5 py-1 font-mono text-xs font-bold text-zinc-200"
            >
              <span
                className="h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: colorForMultiplier(m) }}
              />
              {m}x
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
