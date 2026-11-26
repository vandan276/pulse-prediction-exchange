import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Lock,
  ShieldAlert,
  Users,
} from 'lucide-react';
import {
  ActiveRoundState,
  CandlePoint,
  ChartMode,
  PricePoint,
} from '../types';
import { formatCountdown, formatPrice, formatTimeShort } from '../utils/format';

interface PriceChartProps {
  mode: ChartMode;
  points: PricePoint[];
  candles: CandlePoint[];
  liveRound: ActiveRoundState | null;
  openRound: ActiveRoundState | null;
  currentPrice: number;
  decimals: number;
  symbol: string;
  nowMs: number;
  durationMs: number;
  userId?: string;
  theme?: 'light' | 'dark';
}

export const PriceChart: React.FC<PriceChartProps> = ({
  mode,
  points,
  candles,
  liveRound,
  openRound,
  currentPrice,
  decimals,
  symbol,
  nowMs,
  durationMs,
  userId,
  theme = 'light',
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [size, setSize] = useState({ width: 820, height: 390 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setSize({ width: Math.floor(width), height: Math.floor(height) });
        }
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const displayCandles = candles.slice(-52);
  const displayPoints = points.slice(-120);
  const lockPrice = liveRound?.lockPrice ?? null;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const itemCount =
      mode === 'candles' ? displayCandles.length : displayPoints.length;
    if (itemCount < 2) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const { width, height } = size;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const padLeft = 16;
    const padRight = 88;
    const padTop = 64; // Reserve space for sleek floating live HUD
    const padBottom = 30;
    const chartW = Math.max(60, width - padLeft - padRight);
    const chartH = Math.max(60, height - padTop - padBottom);
    const volH = mode === 'candles' ? Math.min(46, chartH * 0.18) : 0;
    const priceChartH = chartH - volH;

    ctx.clearRect(0, 0, width, height);

    const isLight = theme === 'light';

    // Theme-aware chart canvas backdrop
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    if (isLight) {
      bgGrad.addColorStop(0, '#FFFFFF');
      bgGrad.addColorStop(1, '#F8FAFC');
    } else {
      bgGrad.addColorStop(0, '#07090D');
      bgGrad.addColorStop(1, '#040507');
    }
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Compute min/max price range
    const allPrices: number[] = [currentPrice];
    if (lockPrice != null) allPrices.push(lockPrice);
    if (mode === 'candles') {
      for (const c of displayCandles) {
        allPrices.push(c.high, c.low);
      }
    } else {
      for (const p of displayPoints) {
        allPrices.push(p.price);
      }
    }

    let minP = Math.min(...allPrices);
    let maxP = Math.max(...allPrices);
    const span = maxP - minP;
    const margin = span > 0 ? span * 0.2 : Math.max(currentPrice * 0.0008, 0.01);
    minP -= margin;
    maxP += margin;
    const range = maxP - minP || 1;

    const yOf = (price: number) =>
      padTop + ((maxP - price) / range) * priceChartH;

    const xOfIndex = (idx: number) => {
      if (mode === 'candles') {
        const slot = chartW / Math.max(1, displayCandles.length);
        return padLeft + slot * (idx + 0.5);
      }
      return padLeft + (idx / Math.max(1, displayPoints.length - 1)) * chartW;
    };

    // Subtle horizontal price grid + axis
    const gridSteps = 5;
    ctx.font = '500 10px "IBM Plex Mono", monospace';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';

    for (let i = 0; i <= gridSteps; i++) {
      const y = padTop + (i / gridSteps) * priceChartH;
      const val = maxP - (i / gridSteps) * range;
      ctx.strokeStyle = isLight
        ? 'rgba(15, 23, 42, 0.065)'
        : 'rgba(255, 255, 255, 0.045)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(padLeft + chartW, y);
      ctx.stroke();

      ctx.fillStyle = isLight ? '#64748B' : 'rgba(161, 161, 170, 0.65)';
      ctx.fillText(formatPrice(val, decimals), padLeft + chartW + 10, y);
    }

    // Strike / Lock Price zone wash + Golden Laser Beam
    const isUpWinning = lockPrice != null ? currentPrice >= lockPrice : true;
    const bullColor = isLight ? '#059669' : '#00E599';
    const bearColor = isLight ? '#E11D48' : '#FF3B69';
    const activeColor = isUpWinning ? bullColor : bearColor;

    if (lockPrice != null) {
      const lockY = Math.max(padTop, Math.min(padTop + priceChartH, yOf(lockPrice)));

      const upWash = ctx.createLinearGradient(0, padTop, 0, lockY);
      upWash.addColorStop(0, isLight ? 'rgba(5, 150, 105, 0.08)' : 'rgba(0, 229, 153, 0.055)');
      upWash.addColorStop(1, 'rgba(5, 150, 105, 0.008)');
      ctx.fillStyle = upWash;
      ctx.fillRect(padLeft, padTop, chartW, Math.max(0, lockY - padTop));

      const dnWash = ctx.createLinearGradient(0, lockY, 0, padTop + priceChartH);
      dnWash.addColorStop(0, 'rgba(225, 29, 72, 0.008)');
      dnWash.addColorStop(1, isLight ? 'rgba(225, 29, 72, 0.075)' : 'rgba(255, 59, 105, 0.055)');
      ctx.fillStyle = dnWash;
      ctx.fillRect(
        padLeft,
        lockY,
        chartW,
        Math.max(0, padTop + priceChartH - lockY)
      );

      // Golden Laser Strike Line
      ctx.save();
      ctx.setLineDash([5, 4]);
      ctx.strokeStyle = isLight ? 'rgba(217, 119, 6, 0.85)' : 'rgba(245, 183, 49, 0.9)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(padLeft, lockY);
      ctx.lineTo(padLeft + chartW, lockY);
      ctx.stroke();
      ctx.restore();

      // Strike pill on left (opaque fill so dashed laser never bleeds through text)
      const strikeTxt = `STRIKE ${formatPrice(lockPrice, decimals)}`;
      ctx.font = '700 10px "IBM Plex Mono", monospace';
      const sw = ctx.measureText(strikeTxt).width + 14;
      ctx.fillStyle = isLight ? '#FFFBEB' : '#181205';
      ctx.strokeStyle = isLight ? '#D97706' : 'rgba(245, 183, 49, 0.8)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(padLeft + 4, lockY - 10, sw, 20, 5);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = isLight ? '#B45309' : '#FCD34D';
      ctx.fillText(strikeTxt, padLeft + 11, lockY);
    }

    if (mode === 'candles') {
      // Draw subtle bottom volume histogram
      const maxVol = Math.max(1, ...displayCandles.map((c) => c.volume));
      const slot = chartW / Math.max(1, displayCandles.length);
      const bodyW = Math.max(3, Math.min(11, slot * 0.66));

      displayCandles.forEach((c, idx) => {
        const cx = xOfIndex(idx);
        const bullish = c.close >= c.open;
        const barH = (c.volume / maxVol) * (volH - 6);
        ctx.fillStyle = bullish
          ? 'rgba(0, 229, 153, 0.16)'
          : 'rgba(255, 59, 105, 0.16)';
        ctx.fillRect(
          cx - bodyW / 2,
          padTop + chartH - barH,
          bodyW,
          barH
        );
      });

      // Draw crisp Japanese Candlesticks
      displayCandles.forEach((c, idx) => {
        const cx = xOfIndex(idx);
        const isLast = idx === displayCandles.length - 1;
        const bullish = c.close >= c.open;
        const color = bullish ? '#00E599' : '#FF3B69';

        const yHigh = yOf(c.high);
        const yLow = yOf(c.low);
        const yOpen = yOf(c.open);
        const yClose = yOf(c.close);

        // Wick
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.25;
        ctx.beginPath();
        ctx.moveTo(cx, yHigh);
        ctx.lineTo(cx, yLow);
        ctx.stroke();

        // Body
        const bodyTop = Math.min(yOpen, yClose);
        const bodyHeight = Math.max(2, Math.abs(yClose - yOpen));

        if (isLast) {
          ctx.save();
          ctx.shadowColor = bullish
            ? 'rgba(0, 229, 153, 0.55)'
            : 'rgba(255, 59, 105, 0.55)';
          ctx.shadowBlur = 12;
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.roundRect(cx - bodyW / 2, bodyTop, bodyW, bodyHeight, 1.5);
          ctx.fill();
          ctx.restore();
        } else {
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.roundRect(cx - bodyW / 2, bodyTop, bodyW, bodyHeight, 1.5);
          ctx.fill();
        }
      });
    } else {
      // Glowing Area / Line Mode
      ctx.beginPath();
      displayPoints.forEach((pt, i) => {
        const x = xOfIndex(i);
        const y = yOf(pt.price);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      const lastX = xOfIndex(displayPoints.length - 1);
      ctx.lineTo(lastX, padTop + priceChartH);
      ctx.lineTo(padLeft, padTop + priceChartH);
      ctx.closePath();

      const areaGrad = ctx.createLinearGradient(0, padTop, 0, padTop + priceChartH);
      areaGrad.addColorStop(
        0,
        isUpWinning ? 'rgba(0, 229, 153, 0.28)' : 'rgba(255, 59, 105, 0.28)'
      );
      areaGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = areaGrad;
      ctx.fill();

      ctx.beginPath();
      displayPoints.forEach((pt, i) => {
        const x = xOfIndex(i);
        const y = yOf(pt.price);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.save();
      ctx.shadowColor = isUpWinning
        ? 'rgba(0, 229, 153, 0.5)'
        : 'rgba(255, 59, 105, 0.5)';
      ctx.shadowBlur = 10;
      ctx.strokeStyle = activeColor;
      ctx.lineWidth = 2.2;
      ctx.lineJoin = 'round';
      ctx.stroke();
      ctx.restore();
    }

    // Current live price laser hairline + glowing right tag
    const liveY = Math.max(padTop, Math.min(padTop + priceChartH, yOf(currentPrice)));
    const lastIdx = itemCount - 1;
    const lastX = xOfIndex(lastIdx);

    ctx.save();
    ctx.setLineDash([2, 3]);
    ctx.strokeStyle = isUpWinning
      ? 'rgba(0, 229, 153, 0.55)'
      : 'rgba(255, 59, 105, 0.55)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padLeft, liveY);
    ctx.lineTo(padLeft + chartW, liveY);
    ctx.stroke();
    ctx.restore();

    // Pulsing live beacon on latest point
    ctx.beginPath();
    ctx.arc(lastX, liveY, 7, 0, Math.PI * 2);
    ctx.fillStyle = isUpWinning
      ? 'rgba(0, 229, 153, 0.24)'
      : 'rgba(255, 59, 105, 0.24)';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(lastX, liveY, 3.2, 0, Math.PI * 2);
    ctx.fillStyle = activeColor;
    ctx.fill();

    // Right price badge
    ctx.fillStyle = activeColor;
    ctx.beginPath();
    ctx.roundRect(padLeft + chartW + 5, liveY - 10, padRight - 10, 20, 4);
    ctx.fill();
    ctx.fillStyle = isLight ? '#FFFFFF' : '#040507';
    ctx.font = '700 10px "IBM Plex Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText(formatPrice(currentPrice, decimals), padLeft + chartW + 10, liveY);

    // X-axis timestamps (clamped cleanly so edges never clip!)
    ctx.fillStyle = isLight ? '#64748B' : 'rgba(161, 161, 170, 0.55)';
    ctx.font = '500 10px "IBM Plex Mono", monospace';
    const timeTicks = 5;
    for (let i = 0; i <= timeTicks; i++) {
      const idx = Math.floor((i / timeTicks) * (itemCount - 1));
      const ts =
        mode === 'candles'
          ? displayCandles[idx]?.time
          : displayPoints[idx]?.time;
      if (!ts) continue;
      ctx.textAlign = i === 0 ? 'left' : i === timeTicks ? 'right' : 'center';
      ctx.fillText(formatTimeShort(ts), xOfIndex(idx), height - 10);
    }

    // Hover crosshair
    if (hoverIdx != null && hoverIdx >= 0 && hoverIdx < itemCount) {
      const hx = xOfIndex(hoverIdx);
      const hp =
        mode === 'candles'
          ? displayCandles[hoverIdx].close
          : displayPoints[hoverIdx].price;
      const hy = yOf(hp);

      ctx.save();
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(hx, padTop);
      ctx.lineTo(hx, padTop + chartH);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(padLeft, hy);
      ctx.lineTo(padLeft + chartW, hy);
      ctx.stroke();
      ctx.restore();

      ctx.beginPath();
      ctx.arc(hx, hy, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = activeColor;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }, [
    mode,
    displayCandles,
    displayPoints,
    lockPrice,
    currentPrice,
    decimals,
    size,
    hoverIdx,
    theme,
  ]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const padLeft = 16;
    const padRight = 88;
    const chartW = Math.max(60, size.width - padLeft - padRight);
    const ratio = Math.max(0, Math.min(1, (x - padLeft) / chartW));
    const count =
      mode === 'candles' ? displayCandles.length : displayPoints.length;
    setHoverIdx(Math.round(ratio * Math.max(0, count - 1)));
  };

  // Live Round HUD calculations
  const remainingMs = liveRound ? Math.max(0, liveRound.closeTime - nowMs) : 0;
  const elapsedPct = Math.max(
    0,
    Math.min(100, ((durationMs - remainingMs) / Math.max(1, durationMs)) * 100)
  );
  const cutoffPct = openRound
    ? Math.min(45, (openRound.entryCutoffMs / Math.max(1, durationMs)) * 100)
    : 25;
  const inAntiSnipeZone = openRound ? nowMs >= openRound.entryCloseTime : false;

  const strike = liveRound?.lockPrice ?? currentPrice;
  const diff = currentPrice - strike;
  const diffPct = strike > 0 ? (diff / strike) * 100 : 0;
  const myLiveBet =
    userId && liveRound
      ? liveRound.players.find((p) => p.userId === userId)
      : null;

  const hoveredCandle =
    mode === 'candles' && hoverIdx != null ? displayCandles[hoverIdx] : null;
  const hoveredPoint =
    mode === 'line' && hoverIdx != null ? displayPoints[hoverIdx] : null;

  // Radial ring math
  const ringR = 13;
  const ringC = 2 * Math.PI * ringR;
  const ringOffset = ringC * (1 - elapsedPct / 100);

  return (
    <div className="relative overflow-hidden rounded-xl border border-white/[0.06] bg-[#05070A]">
      {/* Floating Glassmorphic Live Candle HUD */}
      {liveRound && (
        <div className="pointer-events-none absolute left-3 right-3 top-2.5 z-10 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/[0.09] bg-[#090B0F]/85 px-3 py-1.5 backdrop-blur-xl shadow-lg">
            {/* Radial Countdown Ring */}
            <div className="relative flex h-8 w-8 items-center justify-center">
              <svg className="h-8 w-8 -rotate-90" viewBox="0 0 32 32">
                <circle
                  cx="16"
                  cy="16"
                  r={ringR}
                  fill="none"
                  stroke="rgba(255,255,255,0.1)"
                  strokeWidth="2.5"
                />
                <circle
                  cx="16"
                  cy="16"
                  r={ringR}
                  fill="none"
                  stroke={inAntiSnipeZone ? '#F5B731' : '#00E599'}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeDasharray={ringC}
                  strokeDashoffset={ringOffset}
                />
              </svg>
              <Lock className="absolute h-3 w-3 text-zinc-200" />
            </div>

            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-[11px] font-bold text-white">
                  LIVE #{liveRound.roundNumber}
                </span>
                <span className="rounded bg-white/[0.08] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-zinc-300">
                  LOCKED IN PLAY
                </span>
                {myLiveBet && (
                  <span
                    className={`rounded px-1.5 py-0.5 text-[9px] font-extrabold uppercase ${
                      (myLiveBet.direction === 'UP' && diff > 0) ||
                      (myLiveBet.direction === 'DOWN' && diff < 0)
                        ? 'bg-[#00E599]/20 text-[#00E599]'
                        : 'bg-[#F5B731]/20 text-[#F5B731]'
                    }`}
                  >
                    YOU: {myLiveBet.direction}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-400 tabular-nums">
                <span>
                  Settles <strong className="text-white">{formatCountdown(remainingMs)}</strong>
                </span>
                <span>·</span>
                <span className="flex items-center gap-0.5 text-zinc-300">
                  <Users className="h-2.5 w-2.5 text-[#00E599]" />
                  {liveRound.playerCount} playing
                </span>
              </div>
            </div>

            <div className="hidden sm:block h-6 w-px bg-white/10 mx-0.5" />

            <div className="hidden sm:flex items-center gap-1 font-mono text-xs font-bold tabular-nums">
              {diff > 0 ? (
                <span className="flex items-center gap-0.5 text-[#00E599]">
                  <ArrowUpRight className="h-3.5 w-3.5" />+{diffPct.toFixed(3)}% UP
                </span>
              ) : diff < 0 ? (
                <span className="flex items-center gap-0.5 text-[#FF3B69]">
                  <ArrowDownRight className="h-3.5 w-3.5" />
                  {diffPct.toFixed(3)}% DN
                </span>
              ) : (
                <span className="text-zinc-400">0.000% EVEN</span>
              )}
            </div>
          </div>

          {/* OHLC / Hover readout OR Anti-Snipe live badge */}
          {hoveredCandle ? (
            <div className="hidden md:flex items-center gap-3 rounded-xl border border-white/10 bg-[#090B0F]/90 px-3 py-1.5 font-mono text-[10px] backdrop-blur-xl tabular-nums">
              <span className="text-zinc-400">{formatTimeShort(hoveredCandle.time)}</span>
              <span className="text-zinc-400">
                O <strong className="text-white">{formatPrice(hoveredCandle.open, decimals)}</strong>
              </span>
              <span className="text-zinc-400">
                H <strong className="text-[#00E599]">{formatPrice(hoveredCandle.high, decimals)}</strong>
              </span>
              <span className="text-zinc-400">
                L <strong className="text-[#FF3B69]">{formatPrice(hoveredCandle.low, decimals)}</strong>
              </span>
              <span className="text-zinc-400">
                C <strong className="text-white">{formatPrice(hoveredCandle.close, decimals)}</strong>
              </span>
            </div>
          ) : hoveredPoint ? (
            <div className="hidden md:flex items-center gap-2 rounded-xl border border-white/10 bg-[#090B0F]/90 px-3 py-1.5 font-mono text-[11px] backdrop-blur-xl tabular-nums">
              <span className="text-zinc-400">{symbol}</span>
              <strong className="text-white">${formatPrice(hoveredPoint.price, decimals)}</strong>
              <span className="text-zinc-500">{formatTimeShort(hoveredPoint.time)}</span>
            </div>
          ) : inAntiSnipeZone ? (
            <div className="flex items-center gap-1.5 rounded-xl border border-[#F5B731]/40 bg-[#F5B731]/15 px-3 py-1.5 text-[11px] font-bold text-[#F5B731] backdrop-blur-xl">
              <ShieldAlert className="h-3.5 w-3.5" />
              ANTI-SNIPE SEALED • LOCKING NEXT CANDLE
            </div>
          ) : null}
        </div>
      )}

      {/* High-DPI Interactive Canvas */}
      <div
        ref={containerRef}
        className="relative h-[340px] w-full select-none sm:h-[395px]"
      >
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverIdx(null)}
          className="h-full w-full cursor-crosshair"
        />
      </div>

      {/* Bottom Dual-Zone Progress Strip: Shows Open Entry Window vs Anti-Snipe Lock Zone */}
      <div className="border-t border-white/[0.06] bg-[#07090E] px-3 py-2">
        <div className="mb-1 flex items-center justify-between text-[10px] font-mono">
          <span className="text-zinc-400">
            LIVE CANDLE TIMELINE
          </span>
          <span className={inAntiSnipeZone ? 'text-[#F5B731] font-bold' : 'text-zinc-400'}>
            {inAntiSnipeZone
              ? `ANTI-SNIPE BUFFER ACTIVE (${Math.round((openRound?.entryCutoffMs ?? 15000) / 1000)}s pre-lock)`
              : `Next round cutoff ${Math.round((openRound?.entryCutoffMs ?? 15000) / 1000)}s before candle close`}
          </span>
        </div>
        <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-white/[0.07]">
          {/* Highlighted anti-snipe zone on right tail of candle */}
          <div
            className="absolute right-0 top-0 bottom-0 bg-[#F5B731]/30 border-l border-[#F5B731]/80"
            style={{ width: `${cutoffPct}%` }}
          />
          {/* Live candle progress bar */}
          <div
            className={`relative h-full rounded-full transition-all duration-300 ${
              inAntiSnipeZone
                ? 'bg-gradient-to-r from-[#00E599] via-[#F5B731] to-[#F5B731]'
                : 'bg-gradient-to-r from-[#00E599]/80 to-[#00E599]'
            }`}
            style={{ width: `${elapsedPct}%` }}
          />
        </div>
      </div>
    </div>
  );
};
