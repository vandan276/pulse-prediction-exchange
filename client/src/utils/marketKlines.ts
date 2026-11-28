import { CandlePoint, TimeframeId } from '../types';

export const TIMEFRAME_DURATION_MS: Record<TimeframeId, number> = {
  '1m': 60_000,
  '5m': 300_000,
  '10m': 600_000,
  '15m': 900_000,
  '30m': 1_800_000,
  '1h': 3_600_000,
  '1d': 86_400_000,
};

const BINANCE_KLINE_SPEC: Record<
  TimeframeId,
  { interval: string; limit: number; aggregate: number }
> = {
  '1m': { interval: '1m', limit: 240, aggregate: 1 },
  '5m': { interval: '5m', limit: 240, aggregate: 1 },
  '10m': { interval: '5m', limit: 360, aggregate: 2 },
  '15m': { interval: '15m', limit: 240, aggregate: 1 },
  '30m': { interval: '30m', limit: 240, aggregate: 1 },
  '1h': { interval: '1h', limit: 240, aggregate: 1 },
  '1d': { interval: '1d', limit: 240, aggregate: 1 },
};

const FALLBACK_BINANCE_SYMBOLS: Record<string, string> = {
  'BTC/USDT': 'BTCUSDT',
  'ETH/USDT': 'ETHUSDT',
  'SOL/USDT': 'SOLUSDT',
  'BNB/USDT': 'BNBUSDT',
  'XRP/USDT': 'XRPUSDT',
};

const DEFAULT_BASE_VOL_1M: Record<string, number> = {
  'BTC/USDT': 0.0009,
  'ETH/USDT': 0.0012,
  'SOL/USDT': 0.0018,
  'BNB/USDT': 0.0011,
  'XRP/USDT': 0.0019,
  'XAU/USD': 0.00048,
  'XAG/USD': 0.00082,
  'WTI/USD': 0.00095,
  'BRENT/USD': 0.00092,
  'NG/USD': 0.00145,
};

const BINANCE_ENDPOINTS = [
  'https://api.binance.com/api/v3/klines',
  'https://data-api.binance.vision/api/v3/klines',
];

interface CachedSeries {
  candles: CandlePoint[];
  fetchedAt: number;
  source: 'binance' | 'synthetic';
}

const klineCache = new Map<string, CachedSeries>();
const inFlightRequests = new Map<string, Promise<FetchKlinesResult>>();
const CACHE_TTL_MS = 25_000;

export function getTimeframeDurationMs(tf: TimeframeId): number {
  return TIMEFRAME_DURATION_MS[tf] ?? 60_000;
}

function roundToDecimals(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Ensures candles are strictly sorted by unique UTC second timestamps,
 * with valid OHLC bounds (high >= max(open, close), low <= min(open, close)).
 */
export function normalizeCandles(raw: CandlePoint[], decimals = 2): CandlePoint[] {
  const bySec = new Map<number, CandlePoint>();
  for (const c of raw) {
    if (
      !c ||
      !Number.isFinite(c.time) ||
      !Number.isFinite(c.open) ||
      !Number.isFinite(c.high) ||
      !Number.isFinite(c.low) ||
      !Number.isFinite(c.close) ||
      c.close <= 0
    ) {
      continue;
    }
    const secKey = Math.floor(c.time / 1000);
    const open = roundToDecimals(c.open, decimals);
    const close = roundToDecimals(c.close, decimals);
    const high = roundToDecimals(Math.max(c.high, open, close), decimals);
    const low = roundToDecimals(Math.min(c.low, open, close), decimals);
    const volume = Number.isFinite(c.volume) && c.volume >= 0 ? c.volume : 0;
    bySec.set(secKey, {
      time: secKey * 1000,
      open,
      high,
      low,
      close,
      volume,
    });
  }
  return Array.from(bySec.values()).sort((a, b) => a.time - b.time);
}

/**
 * Aggregates 5-minute Binance klines into true 10-minute candles aligned on 10m UTC boundaries.
 */
function aggregateCandles(
  candles: CandlePoint[],
  bucketMs: number,
  decimals: number
): CandlePoint[] {
  const buckets = new Map<number, CandlePoint>();
  for (const c of candles) {
    const key = Math.floor(c.time / bucketMs) * bucketMs;
    const existing = buckets.get(key);
    if (!existing) {
      buckets.set(key, {
        time: key,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume,
      });
    } else {
      existing.high = Math.max(existing.high, c.high);
      existing.low = Math.min(existing.low, c.low);
      existing.close = c.close;
      existing.volume += c.volume;
    }
  }
  return normalizeCandles(Array.from(buckets.values()), decimals);
}

/**
 * Generates 200 deterministic, realistic OHLCV candles for commodities or offline fallback,
 * scaled to the exact timeframe duration and anchored seamlessly at `anchorPrice`.
 */
export function generateTimeframeCandles({
  symbol,
  timeframe,
  anchorPrice,
  decimals = 2,
  count = 200,
  nowMs = Date.now(),
}: {
  symbol: string;
  timeframe: TimeframeId;
  anchorPrice: number;
  decimals?: number;
  count?: number;
  nowMs?: number;
}): CandlePoint[] {
  const durationMs = getTimeframeDurationMs(timeframe);
  const currentBucket = Math.floor(nowMs / durationMs) * durationMs;
  const safeAnchor = Number.isFinite(anchorPrice) && anchorPrice > 0 ? anchorPrice : 100;

  // Volatility scales with sqrt(timeframe in minutes), capped sensibly for 1d
  const baseVol1m = DEFAULT_BASE_VOL_1M[symbol] ?? 0.0009;
  const tfMinutes = durationMs / 60_000;
  const barVol = Math.min(0.022, baseVol1m * Math.sqrt(tfMinutes));

  // Deterministic seed anchored to symbol + timeframe + current coarse bucket
  const seedBucket = Math.floor(currentBucket / Math.max(durationMs * 4, 3_600_000));
  const rng = mulberry32(hashString(`${symbol}|${timeframe}|${seedBucket}`));
  const gauss = () => {
    const u1 = Math.max(1e-7, rng());
    const u2 = rng();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  };

  // Build normalized log-returns path first, then rescale/shift so final close === safeAnchor
  const rawCloses: number[] = new Array(count);
  let val = 1.0;
  let trend = 0;
  for (let i = 0; i < count; i++) {
    // Gentle regime wave + mean reversion so chart shows natural swings, trends & consolidations
    trend = trend * 0.86 + gauss() * barVol * 0.22;
    const meanRev = (1.0 - val) * 0.015;
    const ret = trend + meanRev + gauss() * barVol * 0.78;
    val = Math.max(0.55, Math.min(1.8, val * (1 + ret)));
    rawCloses[i] = val;
  }

  const endScale = safeAnchor / rawCloses[count - 1];
  const candles: CandlePoint[] = [];

  for (let i = 0; i < count; i++) {
    const time = currentBucket - (count - 1 - i) * durationMs;
    const close =
      i === count - 1
        ? roundToDecimals(safeAnchor, decimals)
        : roundToDecimals(rawCloses[i] * endScale, decimals);
    const open =
      i === 0
        ? roundToDecimals(close * (1 - gauss() * barVol * 0.35), decimals)
        : candles[i - 1].close;

    const bodySpread = Math.abs(close - open);
    const wickScale = Math.max(bodySpread * 0.65, close * barVol * 0.45);
    const upperWick = Math.abs(gauss()) * wickScale * 0.7;
    const lowerWick = Math.abs(gauss()) * wickScale * 0.7;
    const high = roundToDecimals(Math.max(open, close) + upperWick, decimals);
    const low = roundToDecimals(
      Math.max(1 / 10 ** decimals, Math.min(open, close) - lowerWick),
      decimals
    );

    const volBase = 40 + rng() * 140;
    const volBurst = (bodySpread / Math.max(close * barVol, 1e-9)) * 90;
    candles.push({
      time,
      open,
      high,
      low,
      close,
      volume: Number((volBase + volBurst).toFixed(2)),
    });
  }

  return normalizeCandles(candles, decimals);
}

/**
 * Patches the tail of an existing candle array with a live price tick using the
 * active timeframe's exact bucket duration (rolling over cleanly into a new bar).
 */
export function patchCandlesWithLiveTick(
  prev: CandlePoint[],
  serverTimeMs: number,
  livePrice: number,
  timeframe: TimeframeId,
  decimals: number
): CandlePoint[] {
  if (!Number.isFinite(livePrice) || livePrice <= 0) return prev;
  const durationMs = getTimeframeDurationMs(timeframe);
  const bucket = Math.floor(serverTimeMs / durationMs) * durationMs;
  const price = roundToDecimals(livePrice, decimals);

  if (prev.length === 0) {
    return [
      {
        time: bucket,
        open: price,
        high: price,
        low: price,
        close: price,
        volume: 12,
      },
    ];
  }

  const last = prev[prev.length - 1];

  // Guard against extreme stale-seed drift (>12%) by smoothly scaling only if needed
  if (last.close > 0 && Math.abs(price - last.close) / last.close > 0.12) {
    const ratio = price / last.close;
    const rescaled = prev.map((c) => ({
      ...c,
      open: roundToDecimals(c.open * ratio, decimals),
      high: roundToDecimals(c.high * ratio, decimals),
      low: roundToDecimals(c.low * ratio, decimals),
      close: roundToDecimals(c.close * ratio, decimals),
    }));
    const tail = rescaled[rescaled.length - 1];
    tail.close = price;
    tail.high = Math.max(tail.high, price);
    tail.low = Math.min(tail.low, price);
    return rescaled;
  }

  if (bucket > last.time) {
    const nextBar: CandlePoint = {
      time: bucket,
      open: last.close,
      high: Math.max(last.close, price),
      low: Math.min(last.close, price),
      close: price,
      volume: 18,
    };
    const next = [...prev, nextBar];
    return next.length > 320 ? next.slice(-320) : next;
  }

  // Same candle bucket — update in place (immutably)
  const updatedLast: CandlePoint = {
    ...last,
    close: price,
    high: Math.max(last.high, price),
    low: Math.min(last.low, price),
    volume: Number((last.volume + 2.5).toFixed(2)),
  };
  const next = prev.slice();
  next[next.length - 1] = updatedLast;
  return next;
}

export function getCachedTimeframeCandles(
  symbol: string,
  timeframe: TimeframeId
): CandlePoint[] | null {
  const key = `${symbol}|${timeframe}`;
  const hit = klineCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.fetchedAt > CACHE_TTL_MS) return null;
  return hit.candles.map((c) => ({ ...c }));
}

export interface FetchKlinesParams {
  symbol: string;
  binanceSymbol?: string | null;
  timeframe: TimeframeId;
  currentPrice: number;
  decimals: number;
  isLivePrice?: boolean;
  signal?: AbortSignal;
}

export interface FetchKlinesResult {
  candles: CandlePoint[];
  source: 'binance' | 'synthetic';
  latestPrice: number | null;
}

export async function fetchTimeframeCandles({
  symbol,
  binanceSymbol,
  timeframe,
  currentPrice,
  decimals,
  isLivePrice = false,
  signal,
}: FetchKlinesParams): Promise<FetchKlinesResult> {
  const cacheKey = `${symbol}|${timeframe}`;
  const cached = klineCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt <= CACHE_TTL_MS && cached.candles.length > 5) {
    const cloned = cached.candles.map((c) => ({ ...c }));
    const patched =
      isLivePrice && currentPrice > 0
        ? patchCandlesWithLiveTick(cloned, Date.now(), currentPrice, timeframe, decimals)
        : cloned;
    return {
      candles: patched,
      source: cached.source,
      latestPrice: patched[patched.length - 1]?.close ?? null,
    };
  }

  const resolvedBinance =
    (binanceSymbol ? binanceSymbol.toUpperCase() : null) ??
    FALLBACK_BINANCE_SYMBOLS[symbol] ??
    null;

  if (resolvedBinance) {
    const existingFlight = inFlightRequests.get(cacheKey);
    if (existingFlight) {
      const res = await existingFlight;
      const cloned = res.candles.map((c) => ({ ...c }));
      const patched =
        isLivePrice && currentPrice > 0
          ? patchCandlesWithLiveTick(cloned, Date.now(), currentPrice, timeframe, decimals)
          : cloned;
      return {
        candles: patched,
        source: res.source,
        latestPrice: patched[patched.length - 1]?.close ?? null,
      };
    }

    const spec = BINANCE_KLINE_SPEC[timeframe] ?? BINANCE_KLINE_SPEC['1m'];
    const durationMs = getTimeframeDurationMs(timeframe);

    const requestPromise = (async (): Promise<FetchKlinesResult> => {
      for (const baseEndpoint of BINANCE_ENDPOINTS) {
        try {
          const url = `${baseEndpoint}?symbol=${encodeURIComponent(
            resolvedBinance
          )}&interval=${encodeURIComponent(spec.interval)}&limit=${spec.limit}`;
          const res = await fetch(url);
          if (!res.ok) continue;
          const rows = await res.json();
          if (!Array.isArray(rows) || rows.length < 2) continue;

          let parsed: CandlePoint[] = rows.map((row: any[]) => ({
            time: Number(row[0]),
            open: parseFloat(String(row[1])),
            high: parseFloat(String(row[2])),
            low: parseFloat(String(row[3])),
            close: parseFloat(String(row[4])),
            volume: parseFloat(String(row[5])),
          }));

          if (spec.aggregate > 1) {
            parsed = aggregateCandles(parsed, durationMs, decimals);
          } else {
            parsed = normalizeCandles(parsed, decimals);
          }

          if (parsed.length >= 2) {
            klineCache.set(cacheKey, {
              candles: parsed.map((c) => ({ ...c })),
              fetchedAt: Date.now(),
              source: 'binance',
            });
            return {
              candles: parsed,
              source: 'binance',
              latestPrice: parsed[parsed.length - 1]?.close ?? null,
            };
          }
        } catch {
          // Try fallback Binance mirror
        }
      }

      const fallback = generateTimeframeCandles({
        symbol,
        timeframe,
        anchorPrice: currentPrice,
        decimals,
        count: 200,
        nowMs: Date.now(),
      });
      klineCache.set(cacheKey, {
        candles: fallback.map((c) => ({ ...c })),
        fetchedAt: Date.now(),
        source: 'synthetic',
      });
      return {
        candles: fallback,
        source: 'synthetic',
        latestPrice: fallback[fallback.length - 1]?.close ?? null,
      };
    })().finally(() => {
      inFlightRequests.delete(cacheKey);
    });

    inFlightRequests.set(cacheKey, requestPromise);
    const result = await requestPromise;
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }
    const cloned = result.candles.map((c) => ({ ...c }));
    const finalCandles =
      isLivePrice && currentPrice > 0
        ? patchCandlesWithLiveTick(cloned, Date.now(), currentPrice, timeframe, decimals)
        : cloned;
    return {
      candles: finalCandles,
      source: result.source,
      latestPrice: finalCandles[finalCandles.length - 1]?.close ?? null,
    };
  }

  // Commodities or offline fallback: deterministic timeframe-scaled OHLCV candles
  const synthetic = generateTimeframeCandles({
    symbol,
    timeframe,
    anchorPrice: currentPrice,
    decimals,
    count: 200,
    nowMs: Date.now(),
  });

  klineCache.set(cacheKey, {
    candles: synthetic.map((c) => ({ ...c })),
    fetchedAt: Date.now(),
    source: 'synthetic',
  });

  return {
    candles: synthetic,
    source: 'synthetic',
    latestPrice: synthetic[synthetic.length - 1]?.close ?? null,
  };
}
