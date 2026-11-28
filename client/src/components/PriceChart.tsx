import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AreaData,
  AreaSeries,
  CandlestickData,
  CandlestickSeries,
  ColorType,
  createChart,
  CrosshairMode,
  HistogramData,
  HistogramSeries,
  IChartApi,
  IPriceLine,
  ISeriesApi,
  LineStyle,
  LogicalRange,
  TickMarkType,
  Time,
  UTCTimestamp,
} from 'lightweight-charts';
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Loader2,
  Lock,
  Maximize2,
  RotateCcw,
  ShieldAlert,
  Users,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  ActiveRoundState,
  CandlePoint,
  ChartMode,
  TimeframeId,
} from '../types';
import { formatCountdown, formatPrice } from '../utils/format';

interface PriceChartProps {
  mode: ChartMode;
  candles: CandlePoint[];
  timeframe: TimeframeId;
  datasetVersion: number;
  loading?: boolean;
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

function formatAxisTick(time: Time, tickMarkType: TickMarkType): string {
  const sec = typeof time === 'number' ? time : Number(time);
  if (!Number.isFinite(sec)) return '';
  const d = new Date(sec * 1000);
  if (tickMarkType === TickMarkType.Year) {
    return String(d.getFullYear());
  }
  if (tickMarkType === TickMarkType.Month) {
    return d.toLocaleDateString('en-US', { month: 'short' });
  }
  if (tickMarkType === TickMarkType.DayOfMonth) {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  return d.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatBarTimestamp(ms: number, timeframe: TimeframeId): string {
  const d = new Date(ms);
  if (timeframe === '1d') {
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }
  if (timeframe === '1h' || timeframe === '30m' || timeframe === '15m') {
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }
  return d.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatCompactVolume(vol: number): string {
  if (!Number.isFinite(vol) || vol <= 0) return '0';
  if (vol >= 1_000_000) return `${(vol / 1_000_000).toFixed(2)}M`;
  if (vol >= 1_000) return `${(vol / 1_000).toFixed(2)}K`;
  if (vol >= 100) return vol.toFixed(0);
  return vol.toFixed(2);
}

function getThemeColors(theme: 'light' | 'dark') {
  const isLight = theme === 'light';
  return {
    isLight,
    bg: isLight ? '#FFFFFF' : '#12151C',
    text: isLight ? '#475569' : '#94A3B8',
    grid: isLight ? 'rgba(15, 23, 42, 0.055)' : 'rgba(255, 255, 255, 0.045)',
    border: isLight ? 'rgba(15, 23, 42, 0.09)' : 'rgba(255, 255, 255, 0.08)',
    crosshairLine: isLight ? 'rgba(15, 23, 42, 0.28)' : 'rgba(255, 255, 255, 0.28)',
    crosshairLabelBg: isLight ? '#0F172A' : '#1E293B',
    bull: isLight ? '#00C853' : '#00D660',
    bullBorder: isLight ? '#00B34A' : '#00D660',
    bullVol: isLight ? 'rgba(0, 200, 83, 0.20)' : 'rgba(0, 214, 96, 0.22)',
    bear: isLight ? '#FF3B5C' : '#FF4766',
    bearBorder: isLight ? '#E11D48' : '#FF4766',
    bearVol: isLight ? 'rgba(255, 59, 92, 0.20)' : 'rgba(255, 71, 102, 0.22)',
    strike: isLight ? '#D97706' : '#F59E0B',
  };
}

export const PriceChart: React.FC<PriceChartProps> = ({
  mode,
  candles,
  timeframe,
  datasetVersion,
  loading = false,
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
  const chartHostRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const mainSeriesRef = useRef<ISeriesApi<'Candlestick'> | ISeriesApi<'Area'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const strikeLineRef = useRef<IPriceLine | null>(null);

  const candlesRef = useRef<CandlePoint[]>(candles);
  const candleBySecRef = useRef<Map<number, CandlePoint>>(new Map());
  const appliedDatasetKeyRef = useRef<string>('');
  const lastFramedVersionRef = useRef<number>(-1);
  const lastSeriesSecRef = useRef<number | null>(null);
  const timeframeRef = useRef<TimeframeId>(timeframe);
  const decimalsRef = useRef<number>(decimals);

  const [hoveredCandle, setHoveredCandle] = useState<CandlePoint | null>(null);
  const [isScrolledBack, setIsScrolledBack] = useState(false);

  timeframeRef.current = timeframe;
  decimalsRef.current = decimals;

  // Keep lookup map fresh for instantaneous OHLCV crosshair hover
  useEffect(() => {
    candlesRef.current = candles;
    const map = new Map<number, CandlePoint>();
    for (const c of candles) {
      map.set(Math.floor(c.time / 1000), c);
    }
    candleBySecRef.current = map;
  }, [candles]);

  const lockPrice = liveRound?.lockPrice ?? null;
  const isUpWinning = lockPrice != null ? currentPrice >= lockPrice : true;

  // 1. Create TradingView Lightweight Charts instance once on mount
  useEffect(() => {
    const el = chartHostRef.current;
    if (!el) return;

    const c = getThemeColors(theme);
    const chart = createChart(el, {
      width: Math.max(280, Math.floor(el.clientWidth || 760)),
      height: Math.max(260, Math.floor(el.clientHeight || 390)),
      layout: {
        background: { type: ColorType.Solid, color: c.bg },
        textColor: c.text,
        fontFamily: '"JetBrains Mono", ui-monospace, SFMono-Regular, monospace',
        fontSize: 11,
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: c.grid },
        horzLines: { color: c.grid },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: c.crosshairLine,
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: c.crosshairLabelBg,
        },
        horzLine: {
          color: c.crosshairLine,
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: c.crosshairLabelBg,
        },
      },
      rightPriceScale: {
        borderColor: c.border,
        scaleMargins: { top: 0.1, bottom: 0.22 },
        autoScale: true,
      },
      timeScale: {
        borderColor: c.border,
        timeVisible: timeframeRef.current !== '1d',
        secondsVisible: false,
        rightOffset: 5,
        barSpacing: 9,
        minBarSpacing: 3,
        fixLeftEdge: false,
        fixRightEdge: true,
        tickMarkFormatter: formatAxisTick,
      },
      localization: {
        priceFormatter: (price: number) => formatPrice(price, decimalsRef.current),
        timeFormatter: (time: Time) => {
          const sec = typeof time === 'number' ? time : Number(time);
          return Number.isFinite(sec)
            ? formatBarTimestamp(sec * 1000, timeframeRef.current)
            : '';
        },
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
      handleScale: {
        axisPressedMouseMove: { time: true, price: true },
        axisDoubleClickReset: { time: true, price: true },
        mouseWheel: true,
        pinch: true,
      },
      kineticScroll: {
        touch: true,
        mouse: false,
      },
    });

    chartRef.current = chart;

    const onCrosshairMove = (param: { time?: Time; point?: { x: number; y: number } }) => {
      if (!param.time || !param.point || param.point.x < 0 || param.point.y < 0) {
        setHoveredCandle(null);
        return;
      }
      const sec = typeof param.time === 'number' ? param.time : Number(param.time);
      const hit = candleBySecRef.current.get(sec) ?? null;
      setHoveredCandle(hit);
    };

    const onLogicalRangeChange = (range: LogicalRange | null) => {
      if (!range) {
        setIsScrolledBack(false);
        return;
      }
      const total = candlesRef.current.length;
      setIsScrolledBack(total > 10 && range.to < total - 3.5);
    };

    chart.subscribeCrosshairMove(onCrosshairMove);
    chart.timeScale().subscribeVisibleLogicalRangeChange(onLogicalRangeChange);

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 20 && height > 20) {
          chart.applyOptions({
            width: Math.floor(width),
            height: Math.floor(height),
          });
        }
      }
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      chart.unsubscribeCrosshairMove(onCrosshairMove);
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(onLogicalRangeChange);
      chart.remove();
      chartRef.current = null;
      mainSeriesRef.current = null;
      volumeSeriesRef.current = null;
      strikeLineRef.current = null;
      appliedDatasetKeyRef.current = '';
      lastSeriesSecRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2. Sync Theme, Timeframe Axis Format & Decimal Formatter dynamically (preserves pan/zoom!)
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const c = getThemeColors(theme);
    chart.applyOptions({
      layout: {
        background: { type: ColorType.Solid, color: c.bg },
        textColor: c.text,
      },
      grid: {
        vertLines: { color: c.grid },
        horzLines: { color: c.grid },
      },
      crosshair: {
        vertLine: {
          color: c.crosshairLine,
          labelBackgroundColor: c.crosshairLabelBg,
        },
        horzLine: {
          color: c.crosshairLine,
          labelBackgroundColor: c.crosshairLabelBg,
        },
      },
      rightPriceScale: {
        borderColor: c.border,
      },
      timeScale: {
        borderColor: c.border,
        timeVisible: timeframe !== '1d',
        secondsVisible: false,
      },
      localization: {
        priceFormatter: (price: number) => formatPrice(price, decimals),
        timeFormatter: (time: Time) => {
          const sec = typeof time === 'number' ? time : Number(time);
          return Number.isFinite(sec) ? formatBarTimestamp(sec * 1000, timeframe) : '';
        },
      },
    });
  }, [theme, timeframe, decimals]);

  // 3. Create / Switch Main Series when Chart Mode changes (Candles ↔ Area Line)
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    const prevRange = chart.timeScale().getVisibleLogicalRange();
    const c = getThemeColors(theme);
    const minMove = Number((1 / 10 ** Math.max(0, Math.min(8, decimals))).toFixed(decimals));

    // Cleanly tear down previous series
    if (strikeLineRef.current && mainSeriesRef.current) {
      try {
        mainSeriesRef.current.removePriceLine(strikeLineRef.current);
      } catch {
        // ignore
      }
      strikeLineRef.current = null;
    }
    if (mainSeriesRef.current) {
      chart.removeSeries(mainSeriesRef.current);
      mainSeriesRef.current = null;
    }
    if (volumeSeriesRef.current) {
      chart.removeSeries(volumeSeriesRef.current);
      volumeSeriesRef.current = null;
    }

    if (mode === 'candles') {
      const candleSeries = chart.addSeries(CandlestickSeries, {
        upColor: c.bull,
        downColor: c.bear,
        borderUpColor: c.bullBorder,
        borderDownColor: c.bearBorder,
        wickUpColor: c.bullBorder,
        wickDownColor: c.bearBorder,
        priceFormat: {
          type: 'price',
          precision: decimals,
          minMove,
        },
      });

      const volSeries = chart.addSeries(HistogramSeries, {
        priceFormat: { type: 'volume' },
        priceScaleId: '',
        lastValueVisible: false,
        priceLineVisible: false,
      });

      chart.priceScale('').applyOptions({
        scaleMargins: { top: 0.82, bottom: 0 },
      });
      chart.priceScale('right').applyOptions({
        scaleMargins: { top: 0.1, bottom: 0.22 },
      });

      mainSeriesRef.current = candleSeries;
      volumeSeriesRef.current = volSeries;
    } else {
      const lineColor = isUpWinning ? c.bull : c.bear;
      const areaSeries = chart.addSeries(AreaSeries, {
        lineColor,
        topColor: isUpWinning ? 'rgba(0, 200, 83, 0.26)' : 'rgba(255, 59, 92, 0.26)',
        bottomColor: isUpWinning ? 'rgba(0, 200, 83, 0.01)' : 'rgba(255, 59, 92, 0.01)',
        lineWidth: 2,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 4,
        priceFormat: {
          type: 'price',
          precision: decimals,
          minMove,
        },
      });

      chart.priceScale('right').applyOptions({
        scaleMargins: { top: 0.12, bottom: 0.1 },
      });

      mainSeriesRef.current = areaSeries;
      volumeSeriesRef.current = null;
    }

    // Force fresh data hydration into newly created series while preserving zoom range on mode toggle
    appliedDatasetKeyRef.current = '';
    lastSeriesSecRef.current = null;

    if (candlesRef.current.length > 0 && prevRange) {
      // Restore after next paint once data effect hydrates the new series
      requestAnimationFrame(() => {
        try {
          chartRef.current?.timeScale().setVisibleLogicalRange(prevRange);
        } catch {
          // ignore
        }
      });
    }
    // Only recreate series when `mode` changes — theme/decimals/colors update via applyOptions!
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // 4. Update Series Styling & Precision dynamically (no series teardown!)
  useEffect(() => {
    const main = mainSeriesRef.current;
    if (!main) return;
    const c = getThemeColors(theme);
    const minMove = Number((1 / 10 ** Math.max(0, Math.min(8, decimals))).toFixed(decimals));

    if (mode === 'candles') {
      (main as ISeriesApi<'Candlestick'>).applyOptions({
        upColor: c.bull,
        downColor: c.bear,
        borderUpColor: c.bullBorder,
        borderDownColor: c.bearBorder,
        wickUpColor: c.bullBorder,
        wickDownColor: c.bearBorder,
        priceFormat: { type: 'price', precision: decimals, minMove },
      });
    } else {
      const lineColor = isUpWinning ? c.bull : c.bear;
      (main as ISeriesApi<'Area'>).applyOptions({
        lineColor,
        topColor: isUpWinning ? 'rgba(0, 200, 83, 0.26)' : 'rgba(255, 59, 92, 0.26)',
        bottomColor: isUpWinning ? 'rgba(0, 200, 83, 0.01)' : 'rgba(255, 59, 92, 0.01)',
        priceFormat: { type: 'price', precision: decimals, minMove },
      });
    }
  }, [theme, decimals, mode, isUpWinning]);

  // 5. Hydrate Dataset OR Stream Incremental Live Bar Updates (NEVER resets pan/zoom on ticks!)
  useEffect(() => {
    const chart = chartRef.current;
    const main = mainSeriesRef.current;
    if (!chart || !main || candles.length === 0) return;

    const c = getThemeColors(theme);
    const datasetKey = `${symbol}|${timeframe}|${mode}|${datasetVersion}`;
    const needsFullSet =
      appliedDatasetKeyRef.current !== datasetKey || lastSeriesSecRef.current === null;

    if (needsFullSet) {
      if (mode === 'candles') {
        const candleData: CandlestickData<UTCTimestamp>[] = candles.map((bar) => ({
          time: Math.floor(bar.time / 1000) as UTCTimestamp,
          open: bar.open,
          high: bar.high,
          low: bar.low,
          close: bar.close,
        }));
        const volData: HistogramData<UTCTimestamp>[] = candles.map((bar) => ({
          time: Math.floor(bar.time / 1000) as UTCTimestamp,
          value: bar.volume,
          color: bar.close >= bar.open ? c.bullVol : c.bearVol,
        }));
        (main as ISeriesApi<'Candlestick'>).setData(candleData);
        volumeSeriesRef.current?.setData(volData);
      } else {
        const areaData: AreaData<UTCTimestamp>[] = candles.map((bar) => ({
          time: Math.floor(bar.time / 1000) as UTCTimestamp,
          value: bar.close,
        }));
        (main as ISeriesApi<'Area'>).setData(areaData);
      }

      const lastBar = candles[candles.length - 1];
      lastSeriesSecRef.current = Math.floor(lastBar.time / 1000);
      appliedDatasetKeyRef.current = datasetKey;

      // Frame default readable live window whenever a new symbol/timeframe dataset loads
      // (but NOT when merely toggling Candles <-> Line on the same datasetVersion!)
      if (lastFramedVersionRef.current !== datasetVersion) {
        lastFramedVersionRef.current = datasetVersion;
        const total = candles.length;
        const hostWidth = chartHostRef.current?.clientWidth ?? 720;
        const defaultCount = hostWidth < 520 ? 40 : 72;
        const visibleBars = Math.min(total, defaultCount);
        chart.priceScale('right').applyOptions({ autoScale: true });
        if (total > 12) {
          chart.timeScale().setVisibleLogicalRange({
            from: Math.max(0, total - visibleBars),
            to: total + 4,
          });
        } else {
          chart.timeScale().fitContent();
        }
        setIsScrolledBack(false);
      }
      return;
    }

    // Incremental real-time tick update — keeps user pan/zoom 100% locked!
    const latest = candles[candles.length - 1];
    const latestSec = Math.floor(latest.time / 1000) as UTCTimestamp;

    if (lastSeriesSecRef.current !== null && latestSec < lastSeriesSecRef.current) {
      // Defensive fallback if clock/data moved backward
      appliedDatasetKeyRef.current = '';
      return;
    }

    try {
      if (mode === 'candles') {
        (main as ISeriesApi<'Candlestick'>).update({
          time: latestSec,
          open: latest.open,
          high: latest.high,
          low: latest.low,
          close: latest.close,
        });
        volumeSeriesRef.current?.update({
          time: latestSec,
          value: latest.volume,
          color: latest.close >= latest.open ? c.bullVol : c.bearVol,
        });
      } else {
        (main as ISeriesApi<'Area'>).update({
          time: latestSec,
          value: latest.close,
        });
      }
      lastSeriesSecRef.current = latestSec;
    } catch {
      appliedDatasetKeyRef.current = '';
    }
  }, [candles, symbol, timeframe, mode, datasetVersion, theme]);

  // 6. Manage STRIKE Price Line cleanly (zero duplicates!)
  useEffect(() => {
    const main = mainSeriesRef.current;
    if (!main) return;

    if (strikeLineRef.current) {
      try {
        main.removePriceLine(strikeLineRef.current);
      } catch {
        // ignore
      }
      strikeLineRef.current = null;
    }

    if (lockPrice != null && Number.isFinite(lockPrice) && lockPrice > 0) {
      const c = getThemeColors(theme);
      strikeLineRef.current = main.createPriceLine({
        price: lockPrice,
        color: c.strike,
        lineWidth: 2,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: 'STRIKE',
      });
    }
  }, [lockPrice, mode, theme, symbol, timeframe]);

  // Interactive Toolbar Handlers
  const handleZoomIn = useCallback(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const ts = chart.timeScale();
    const range = ts.getVisibleLogicalRange();
    if (!range) return;
    const total = candlesRef.current.length;
    const span = Math.max(4, range.to - range.from);
    const nextSpan = Math.max(10, span * 0.72);
    if (range.to >= total - 3) {
      ts.setVisibleLogicalRange({ from: range.to - nextSpan, to: range.to });
    } else {
      const mid = (range.from + range.to) / 2;
      ts.setVisibleLogicalRange({ from: mid - nextSpan / 2, to: mid + nextSpan / 2 });
    }
  }, []);

  const handleZoomOut = useCallback(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const ts = chart.timeScale();
    const range = ts.getVisibleLogicalRange();
    if (!range) return;
    const total = candlesRef.current.length;
    const span = Math.max(4, range.to - range.from);
    const maxSpan = Math.max(total + 16, 120);
    const nextSpan = Math.min(maxSpan, span * 1.38);
    if (range.to >= total - 3) {
      ts.setVisibleLogicalRange({ from: range.to - nextSpan, to: range.to });
    } else {
      const mid = (range.from + range.to) / 2;
      ts.setVisibleLogicalRange({ from: mid - nextSpan / 2, to: mid + nextSpan / 2 });
    }
  }, []);

  const handleFitAll = useCallback(() => {
    const chart = chartRef.current;
    if (!chart) return;
    chart.priceScale('right').applyOptions({ autoScale: true });
    chart.timeScale().fitContent();
  }, []);

  const handleResetLive = useCallback(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const total = candlesRef.current.length;
    const hostWidth = chartHostRef.current?.clientWidth ?? 720;
    const defaultCount = hostWidth < 520 ? 40 : 72;
    chart.priceScale('right').applyOptions({ autoScale: true });
    if (total > 12) {
      chart.timeScale().setVisibleLogicalRange({
        from: Math.max(0, total - Math.min(total, defaultCount)),
        to: total + 4,
      });
    } else {
      chart.timeScale().scrollToRealTime();
    }
    setIsScrolledBack(false);
  }, []);

  // Live Round HUD math
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

  // Displayed OHLCV bar (hovered candle if active, otherwise latest candle)
  const activeBar = hoveredCandle ?? (candles.length > 0 ? candles[candles.length - 1] : null);
  const activeBarChangePct =
    activeBar && activeBar.open > 0
      ? ((activeBar.close - activeBar.open) / activeBar.open) * 100
      : 0;
  const activeBarBullish = activeBar ? activeBar.close >= activeBar.open : true;

  // Radial ring math
  const ringR = 12;
  const ringC = 2 * Math.PI * ringR;
  const ringOffset = ringC * (1 - elapsedPct / 100);

  return (
    <div className="relative overflow-hidden rounded-xl border border-fg/[0.08] bg-surface">
      {/* Row 1: Integrated Live Round HUD + Pan/Zoom Controls (Zero Overlap With Chart!) */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-fg/[0.06] bg-raised/70 px-3 py-2">
        <div className="flex flex-wrap items-center gap-2.5">
          {liveRound ? (
            <>
              <div className="relative flex h-7 w-7 shrink-0 items-center justify-center">
                <svg className="h-7 w-7 -rotate-90" viewBox="0 0 30 30">
                  <circle
                    cx="15"
                    cy="15"
                    r={ringR}
                    fill="none"
                    stroke="currentColor"
                    className="text-fg/10"
                    strokeWidth="2.4"
                  />
                  <circle
                    cx="15"
                    cy="15"
                    r={ringR}
                    fill="none"
                    stroke={inAntiSnipeZone ? '#D97706' : '#00C853'}
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeDasharray={ringC}
                    strokeDashoffset={ringOffset}
                  />
                </svg>
                <Lock className="absolute h-2.5 w-2.5 text-fg" />
              </div>

              <div className="leading-tight">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-mono text-[11px] font-bold text-fg">
                    LIVE #{liveRound.roundNumber}
                  </span>
                  <span className="rounded bg-fg/[0.07] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-fg2">
                    LOCKED
                  </span>
                  {myLiveBet && (
                    <span
                      className={`rounded px-1.5 py-0.5 text-[9px] font-extrabold uppercase ${
                        (myLiveBet.direction === 'UP' && diff > 0) ||
                        (myLiveBet.direction === 'DOWN' && diff < 0)
                          ? 'bg-accent/15 text-accent'
                          : 'bg-gold/15 text-gold'
                      }`}
                    >
                      YOU: {myLiveBet.direction}
                    </span>
                  )}
                </div>
                <div className="mt-0.5 flex items-center gap-2 font-mono text-[10px] text-muted tabular-nums">
                  <span>
                    Settles{' '}
                    <strong className="text-fg">{formatCountdown(remainingMs)}</strong>
                  </span>
                  <span>·</span>
                  <span className="inline-flex items-center gap-0.5 text-fg2">
                    <Users className="h-2.5 w-2.5 text-accent" />
                    {liveRound.playerCount} playing
                  </span>
                  {lockPrice != null && (
                    <>
                      <span className="hidden sm:inline">·</span>
                      <span className="hidden sm:inline text-gold font-semibold">
                        Strike ${formatPrice(lockPrice, decimals)}
                      </span>
                    </>
                  )}
                </div>
              </div>

              <div className="hidden sm:block h-6 w-px bg-fg/10" />

              <div className="hidden sm:flex items-center gap-1 font-mono text-xs font-bold tabular-nums">
                {diff > 0 ? (
                  <span className="inline-flex items-center gap-0.5 rounded-md bg-accent/10 px-2 py-0.5 text-accent">
                    <ArrowUpRight className="h-3.5 w-3.5" />+{diffPct.toFixed(3)}% UP
                  </span>
                ) : diff < 0 ? (
                  <span className="inline-flex items-center gap-0.5 rounded-md bg-danger/10 px-2 py-0.5 text-danger">
                    <ArrowDownRight className="h-3.5 w-3.5" />
                    {diffPct.toFixed(3)}% DN
                  </span>
                ) : (
                  <span className="rounded-md bg-fg/[0.06] px-2 py-0.5 text-muted">
                    0.000% EVEN
                  </span>
                )}
              </div>

              {inAntiSnipeZone && (
                <div className="inline-flex items-center gap-1 rounded-lg border border-gold/40 bg-gold/15 px-2 py-1 text-[10px] font-bold text-gold">
                  <ShieldAlert className="h-3 w-3 shrink-0" />
                  <span className="hidden md:inline">ANTI-SNIPE SEALED</span>
                  <span className="md:hidden">SEALED</span>
                </div>
              )}
            </>
          ) : (
            <span className="font-mono text-xs font-semibold text-muted">
              {symbol} · {timeframe}
            </span>
          )}
        </div>

        {/* Interactive Chart Controls: Zoom In, Zoom Out, Fit All, Reset/Live */}
        <div className="flex items-center gap-1">
          {loading && (
            <span className="mr-1 inline-flex items-center gap-1 rounded-md bg-info/10 px-2 py-1 font-mono text-[10px] font-semibold text-info">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span className="hidden sm:inline">Syncing {timeframe}</span>
            </span>
          )}
          <div className="inline-flex items-center rounded-lg border border-fg/[0.09] bg-surface p-0.5">
            <button
              type="button"
              onClick={handleZoomIn}
              title="Zoom in"
              aria-label="Zoom in"
              className="flex h-6 w-6 items-center justify-center rounded-md text-muted transition hover:bg-fg/[0.06] hover:text-fg"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={handleZoomOut}
              title="Zoom out"
              aria-label="Zoom out"
              className="flex h-6 w-6 items-center justify-center rounded-md text-muted transition hover:bg-fg/[0.06] hover:text-fg"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={handleFitAll}
              title="Fit full history"
              aria-label="Fit full history"
              className="flex h-6 w-6 items-center justify-center rounded-md text-muted transition hover:bg-fg/[0.06] hover:text-fg"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={handleResetLive}
              title="Reset zoom & jump to live candle"
              aria-label="Reset zoom and jump to live"
              className="flex h-6 items-center gap-1 rounded-md px-1.5 font-mono text-[10px] font-bold text-muted transition hover:bg-fg/[0.06] hover:text-fg"
            >
              <RotateCcw className="h-3 w-3" />
              <span className="hidden sm:inline">Reset</span>
            </button>
          </div>
        </div>
      </div>

      {/* Row 2: Crisp Dedicated OHLCV Readout Strip (Wraps cleanly on mobile — zero clipping!) */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-fg/[0.05] bg-surface px-3 py-1.5 font-mono text-[11px] tabular-nums">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
          <span className="rounded bg-fg/[0.07] px-1.5 py-0.5 text-[10px] font-bold uppercase text-fg">
            {timeframe}
          </span>
          {activeBar ? (
            <>
              <span className="text-subtle">
                {formatBarTimestamp(activeBar.time, timeframe)}
              </span>
              <span className="text-muted">
                O <strong className="text-fg">{formatPrice(activeBar.open, decimals)}</strong>
              </span>
              <span className="text-muted">
                H <strong className="text-accent">{formatPrice(activeBar.high, decimals)}</strong>
              </span>
              <span className="text-muted">
                L <strong className="text-danger">{formatPrice(activeBar.low, decimals)}</strong>
              </span>
              <span className="text-muted">
                C{' '}
                <strong className={activeBarBullish ? 'text-accent' : 'text-danger'}>
                  {formatPrice(activeBar.close, decimals)}
                </strong>
              </span>
              <span
                className={`font-bold ${
                  activeBarBullish ? 'text-accent' : 'text-danger'
                }`}
              >
                {activeBarChangePct >= 0 ? '+' : ''}
                {activeBarChangePct.toFixed(2)}%
              </span>
              <span className="hidden sm:inline text-subtle">
                Vol <strong className="text-fg2">{formatCompactVolume(activeBar.volume)}</strong>
              </span>
            </>
          ) : (
            <span className="text-subtle">Loading {symbol} candles…</span>
          )}
        </div>

        <span className="hidden 2xl:inline shrink-0 text-[10px] text-subtle">
          Drag to pan · Scroll to zoom
        </span>
      </div>

      {/* Interactive TradingView Lightweight Charts Canvas */}
      <div className="relative h-[340px] w-full sm:h-[410px]">
        <div
          ref={chartHostRef}
          className="h-full w-full cursor-grab active:cursor-grabbing"
          aria-label={`${symbol} ${timeframe} interactive price chart`}
        />

        {/* Floating "Go to Live" button when user pans backward in history */}
        {isScrolledBack && (
          <button
            type="button"
            onClick={handleResetLive}
            className="absolute bottom-9 right-[86px] z-20 inline-flex items-center gap-1 rounded-full border border-fg/15 bg-surface/95 px-3 py-1 font-mono text-[11px] font-bold text-fg shadow-md backdrop-blur-md transition hover:border-accent/50 hover:text-accent"
          >
            <span>Live</span>
            <ArrowRight className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Bottom Dual-Zone Progress Strip: Open Entry Window vs Anti-Snipe Lock Zone */}
      <div className="border-t border-fg/[0.06] bg-raised/70 px-3 py-2">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2 font-mono text-[10px]">
          <span className="text-muted">
            LIVE {timeframe.toUpperCase()} CANDLE TIMELINE
          </span>
          <div className="flex items-center gap-3">
            <span className={inAntiSnipeZone ? 'text-gold font-bold' : 'text-muted'}>
              {inAntiSnipeZone
                ? `ANTI-SNIPE BUFFER ACTIVE (${Math.round(
                    (openRound?.entryCutoffMs ?? 15000) / 1000
                  )}s pre-lock)`
                : `Next round cutoff ${Math.round(
                    (openRound?.entryCutoffMs ?? 15000) / 1000
                  )}s before candle close`}
            </span>
            <a
              href="https://www.tradingview.com/"
              target="_blank"
              rel="noreferrer"
              className="hidden sm:inline text-[9px] text-subtle/80 transition hover:text-fg"
            >
              Charts by TradingView
            </a>
          </div>
        </div>
        <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-fg/[0.07]">
          <div
            className="absolute bottom-0 right-0 top-0 border-l border-gold/80 bg-gold/30"
            style={{ width: `${cutoffPct}%` }}
          />
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
