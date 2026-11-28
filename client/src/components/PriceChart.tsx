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

    // Theme-aware Apex Pro Fintech chart canvas backdrop
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    if (isLight) {
      bgGrad.addColorStop(0, '#FFFFFF');
      bgGrad.addColorStop(1, '#FFFFFF');
    } else {
      bgGrad.addColorStop(0, '#12151C');
      bgGrad.addColorStop(1, '#0E1117');
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
    ctx.font = '500 10px "JetBrains Mono", monospace';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';

    for (let i = 0; i <= gridSteps; i++) {
      const y = padTop + (i / gridSteps) * priceChartH;
      const val = maxP - (i / gridSteps) * range;
      ctx.strokeStyle = isLight
        ? 'rgba(15, 23, 42, 0.06)'
        : 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(padLeft + chartW, y);
      ctx.stroke();

      ctx.fillStyle = isLight ? '#64748B' : 'rgba(148, 163, 184, 0.72)';
      ctx.fillText(formatPrice(val, decimals), padLeft + chartW + 10, y);
    }

    // Strike / Lock Price zone wash + Golden Laser Beam
    const isUpWinning = lockPrice != null ? currentPrice >= lockPrice : true;
    const bullColor = isLight ? '#00C853' : '#00D660';
    const bearColor = isLight ? '#FF3B5C' : '#FF4766';
    const activeColor = isUpWinning ? bullColor : bearColor;

    if (lockPrice != null) {
      const lockY = Math.max(padTop, Math.min(padTop + priceChartH, yOf(lockPrice)));

      const upWash = ctx.createLinearGradient(0, padTop, 0, lockY);
      upWash.addColorStop(0, isLight ? 'rgba(0,200,83, 0.06)' : 'rgba(0, 214, 96, 0.06)');
      upWash.addColorStop(1, 'rgba(0,200,83, 0.005)');
      ctx.fillStyle = upWash;
      ctx.fillRect(padLeft, padTop, chartW, Math.max(0, lockY - padTop));

      const dnWash = ctx.createLinearGradient(0, lockY, 0, padTop + priceChartH);
      dnWash.addColorStop(0, 'rgba(255, 59, 92, 0.005)');
      dnWash.addColorStop(1, isLight ? 'rgba(255, 59, 92, 0.06)' : 'rgba(255, 71, 102, 0.06)');
      ctx.fillStyle = dnWash;
      ctx.fillRect(
        padLeft,
        lockY,
        chartW,
        Math.max(0, padTop + priceChartH - lockY)
      );

      // Strike Line
      ctx.save();
      ctx.setLineDash([5, 4]);
      ctx.strokeStyle = isLight ? 'rgba(217, 119, 6, 0.78)' : 'rgba(245, 158, 11, 0.85)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(padLeft, lockY);
      ctx.lineTo(padLeft + chartW, lockY);
      ctx.stroke();
      ctx.restore();

      // Strike pill on left
      const strikeTxt = `STRIKE ${formatPrice(lockPrice, decimals)}`;
      ctx.font = '700 10px "JetBrains Mono", monospace';
      const sw = ctx.measureText(strikeTxt).width + 14;
      ctx.fillStyle = isLight ? '#FFFBEB' : '#261C0A';
      ctx.strokeStyle = isLight ? '#D97706' : 'rgba(245, 158, 11, 0.8)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(padLeft + 4, lockY - 10, sw, 20, 6);
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
          ? 'rgba(0,200,83, 0.14)'
          : 'rgba(255, 59, 92, 0.14)';
        ctx.fillRect(
          cx - bodyW / 2,
          padTop + chartH - barH,
          bodyW,
          barH
        );
      });

      // Draw crisp Polymarket/Fintech Japanese Candlesticks
      displayCandles.forEach((c, idx) => {
        const cx = xOfIndex(idx);
        const isLast = idx === displayCandles.length - 1;
        const bullish = c.close >= c.open;
        const color = bullish ? bullColor : bearColor;
        const fillCol = isLight
          ? bullish
            ? '#86EFAC'
            : '#FDA4AF'
          : color;

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

        ctx.fillStyle = fillCol;
        ctx.strokeStyle = color;
        ctx.lineWidth = isLight ? 1 : 0;
        ctx.beginPath();
        ctx.roundRect(cx - bodyW / 2, bodyTop, bodyW, bodyHeight, 2);
        ctx.fill();
        if (isLight) ctx.stroke();
        if (isLast) {
          ctx.save();
          ctx.shadowColor = bullish ? 'rgba(0,200,83, 0.35)' : 'rgba(255, 59, 92, 0.35)';
          ctx.shadowBlur = 8;
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.roundRect(cx - bodyW / 2, bodyTop, bodyW, bodyHeight, 2);
          ctx.fill();
          ctx.restore();
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
        isUpWinning ? 'rgba(0,200,83, 0.28)' : 'rgba(255, 78, 78, 0.28)'
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
        ? 'rgba(0,200,83, 0.5)'
        : 'rgba(255, 78, 78, 0.5)';
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
      ? 'rgba(0,200,83, 0.55)'
      : 'rgba(255, 78, 78, 0.55)';
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
      ? 'rgba(0,200,83, 0.24)'
      : 'rgba(255, 78, 78, 0.24)';
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
    ctx.fillStyle = isLight ? '#FFFFFF' : '#0A0B0E';
    ctx.font = '700 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText(formatPrice(currentPrice, decimals), padLeft + chartW + 10, liveY);

    // X-axis timestamps (clamped cleanly so edges never clip!)
    ctx.fillStyle = isLight ? '#64748B' : 'rgba(177, 186, 211, 0.55)';
    ctx.font = '500 10px "JetBrains Mono", monospace';
    const timeTicks = chartW < 360 ? 2 : chartW < 560 ? 3 : 5;
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
    <div className="relative overflow-hidden rounded-xl border border-fg/[0.06] bg-raised">
      {/* Floating Glassmorphic Live Candle HUD */}
      {liveRound && (
        <div className="pointer-events-none absolute left-3 right-3 top-2.5 z-10 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-fg/[0.09] bg-surface/85 px-3 py-1.5 backdrop-blur-xl shadow-lg">
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
                  stroke={inAntiSnipeZone ? '#FFC800' : '#00C853'}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeDasharray={ringC}
                  strokeDashoffset={ringOffset}
                />
              </svg>
              <Lock className="absolute h-3 w-3 text-fg" />
            </div>

            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-[11px] font-bold text-fg">
                  LIVE #{liveRound.roundNumber}
                </span>
                <span className="rounded bg-fg/[0.08] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-fg2">
                  LOCKED IN PLAY
                </span>
                {myLiveBet && (
                  <span
                    className={`rounded px-1.5 py-0.5 text-[9px] font-extrabold uppercase ${
                      (myLiveBet.direction === 'UP' && diff > 0) ||
                      (myLiveBet.direction === 'DOWN' && diff < 0)
                        ? 'bg-accent/20 text-accent'
                        : 'bg-gold/20 text-gold'
                    }`}
                  >
                    YOU: {myLiveBet.direction}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-[10px] font-mono text-muted tabular-nums">
                <span>
                  Settles <strong className="text-fg">{formatCountdown(remainingMs)}</strong>
                </span>
                <span>·</span>
                <span className="flex items-center gap-0.5 text-fg2">
                  <Users className="h-2.5 w-2.5 text-accent" />
                  {liveRound.playerCount} playing
                </span>
              </div>
            </div>

            <div className="hidden sm:block h-6 w-px bg-fg/10 mx-0.5" />

            <div className="hidden sm:flex items-center gap-1 font-mono text-xs font-bold tabular-nums">
              {diff > 0 ? (
                <span className="flex items-center gap-0.5 text-accent">
                  <ArrowUpRight className="h-3.5 w-3.5" />+{diffPct.toFixed(3)}% UP
                </span>
              ) : diff < 0 ? (
                <span className="flex items-center gap-0.5 text-danger">
                  <ArrowDownRight className="h-3.5 w-3.5" />
                  {diffPct.toFixed(3)}% DN
                </span>
              ) : (
                <span className="text-muted">0.000% EVEN</span>
              )}
            </div>
          </div>

          {/* OHLC / Hover readout OR Anti-Snipe live badge */}
          {hoveredCandle ? (
            <div className="hidden md:flex items-center gap-3 rounded-xl border border-fg/10 bg-surface/90 px-3 py-1.5 font-mono text-[10px] backdrop-blur-xl tabular-nums">
              <span className="text-muted">{formatTimeShort(hoveredCandle.time)}</span>
              <span className="text-muted">
                O <strong className="text-fg">{formatPrice(hoveredCandle.open, decimals)}</strong>
              </span>
              <span className="text-muted">
                H <strong className="text-accent">{formatPrice(hoveredCandle.high, decimals)}</strong>
              </span>
              <span className="text-muted">
                L <strong className="text-danger">{formatPrice(hoveredCandle.low, decimals)}</strong>
              </span>
              <span className="text-muted">
                C <strong className="text-fg">{formatPrice(hoveredCandle.close, decimals)}</strong>
              </span>
            </div>
          ) : hoveredPoint ? (
            <div className="hidden md:flex items-center gap-2 rounded-xl border border-fg/10 bg-surface/90 px-3 py-1.5 font-mono text-[11px] backdrop-blur-xl tabular-nums">
              <span className="text-muted">{symbol}</span>
              <strong className="text-fg">${formatPrice(hoveredPoint.price, decimals)}</strong>
              <span className="text-subtle">{formatTimeShort(hoveredPoint.time)}</span>
            </div>
          ) : inAntiSnipeZone ? (
            <div className="flex items-center gap-1.5 rounded-xl border border-gold/40 bg-gold/15 px-3 py-1.5 text-[11px] font-bold text-gold backdrop-blur-xl">
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
      <div className="border-t border-fg/[0.06] bg-raised px-3 py-2">
        <div className="mb-1 flex items-center justify-between text-[10px] font-mono">
          <span className="text-muted">
            LIVE CANDLE TIMELINE
          </span>
          <span className={inAntiSnipeZone ? 'text-gold font-bold' : 'text-muted'}>
            {inAntiSnipeZone
              ? `ANTI-SNIPE BUFFER ACTIVE (${Math.round((openRound?.entryCutoffMs ?? 15000) / 1000)}s pre-lock)`
              : `Next round cutoff ${Math.round((openRound?.entryCutoffMs ?? 15000) / 1000)}s before candle close`}
          </span>
        </div>
        <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-fg/[0.07]">
          {/* Highlighted anti-snipe zone on right tail of candle */}
          <div
            className="absolute right-0 top-0 bottom-0 bg-gold/30 border-l border-gold/80"
            style={{ width: `${cutoffPct}%` }}
          />
          {/* Live candle progress bar */}
          <div
            className={`relative h-full rounded-full transition-all duration-300 ${
              inAntiSnipeZone
                ? 'bg-gradient-to-r from-accent via-gold to-gold'
                : 'bg-gradient-to-r from-accent/80 to-accent'
            }`}
            style={{ width: `${elapsedPct}%` }}
          />
        </div>
      </div>
    </div>
  );
};
