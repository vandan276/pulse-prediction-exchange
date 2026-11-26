const EventEmitter = require('events');
const WebSocket = require('ws');
const { MARKETS } = require('../config');

const MAX_HISTORY_POINTS = 240;
const CANDLE_INTERVAL_MS = 5_000; // Crisp 5-second live candlesticks
const MAX_CANDLES = 64;

function roundPrice(value, decimals) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function gaussianRandom() {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

class PriceFeedService extends EventEmitter {
  constructor({ enableExternalFeeds = true } = {}) {
    super();
    this.enableExternalFeeds = enableExternalFeeds;
    this.tickers = new Map();
    this.history = new Map();
    this.candles = new Map();
    this.trends = new Map();
    this.binanceWs = null;
    this.binanceConnected = false;
    this.reconnectTimer = null;
    this.tickInterval = null;
    this.lastBinanceTickAt = new Map();

    this._initMarkets();
  }

  _initMarkets() {
    const now = Date.now();
    const currentBucket = Math.floor(now / CANDLE_INTERVAL_MS) * CANDLE_INTERVAL_MS;

    for (const market of MARKETS) {
      const open24h = roundPrice(
        market.basePrice * (1 + (Math.random() - 0.5) * 0.03),
        market.decimals
      );

      const candles = [];
      let p = market.basePrice * (1 + (Math.random() - 0.5) * 0.0025);
      for (let i = 51; i >= 0; i--) {
        const bucketTime = currentBucket - i * CANDLE_INTERVAL_MS;
        const open = roundPrice(p, market.decimals);
        let high = open;
        let low = open;
        for (let sub = 0; sub < 5; sub++) {
          const step = gaussianRandom() * market.volatility * 0.52;
          p = Math.max(market.basePrice * 0.85, p * (1 + step));
          const rp = roundPrice(p, market.decimals);
          if (rp > high) high = rp;
          if (rp < low) low = rp;
        }
        const close = roundPrice(p, market.decimals);
        const volume = Number((15 + Math.random() * 85).toFixed(2));
        candles.push({
          time: bucketTime,
          open,
          high: Math.max(high, open, close),
          low: Math.min(low, open, close),
          close,
          volume,
        });
      }

      const pts = [];
      for (const c of candles.slice(-36)) {
        pts.push({ time: c.time, price: c.open });
        pts.push({ time: c.time + Math.floor(CANDLE_INTERVAL_MS * 0.35), price: c.high });
        pts.push({ time: c.time + Math.floor(CANDLE_INTERVAL_MS * 0.7), price: c.low });
        pts.push({ time: c.time + CANDLE_INTERVAL_MS - 500, price: c.close });
      }

      const price = candles[candles.length - 1].close;
      const changePercent = Number((((price - open24h) / open24h) * 100).toFixed(2));

      this.candles.set(market.symbol, candles);
      this.history.set(market.symbol, pts.slice(-MAX_HISTORY_POINTS));
      this.tickers.set(market.symbol, {
        ...market,
        price,
        prevPrice: price,
        open24h,
        high24h: roundPrice(Math.max(price, open24h) * 1.008, market.decimals),
        low24h: roundPrice(Math.min(price, open24h) * 0.992, market.decimals),
        changePercent,
        source: 'simulated',
        sparkline: candles.slice(-20).map((c) => c.close),
        updatedAt: now,
      });

      this.trends.set(market.symbol, {
        drift: (Math.random() - 0.5) * market.volatility * 0.25,
        ttl: 15 + Math.floor(Math.random() * 25),
      });
    }
  }

  _updateCandle(symbol, price, now) {
    const list = this.candles.get(symbol);
    if (!list) return;
    const bucketTime = Math.floor(now / CANDLE_INTERVAL_MS) * CANDLE_INTERVAL_MS;
    const last = list[list.length - 1];

    if (!last || bucketTime > last.time) {
      const openPrice = last ? last.close : price;
      list.push({
        time: bucketTime,
        open: openPrice,
        high: Math.max(openPrice, price),
        low: Math.min(openPrice, price),
        close: price,
        volume: Number((10 + Math.random() * 35).toFixed(2)),
      });
      if (list.length > MAX_CANDLES) {
        list.shift();
      }
    } else {
      last.close = price;
      if (price > last.high) last.high = price;
      if (price < last.low) last.low = price;
      last.volume = Number((last.volume + 3 + Math.random() * 14).toFixed(2));
    }
  }

  _reanchorHistoryAndCandles(symbol, livePrice, decimals) {
    const hist = this.history.get(symbol) || [];
    const cList = this.candles.get(symbol) || [];
    const lastPrice =
      (cList.length ? cList[cList.length - 1].close : null) ||
      (hist.length ? hist[hist.length - 1].price : null) ||
      livePrice;

    const ratio = livePrice / (lastPrice || livePrice);
    for (const pt of hist) {
      pt.price = roundPrice(pt.price * ratio, decimals);
    }
    if (hist.length > 0) hist[hist.length - 1].price = livePrice;

    for (const c of cList) {
      c.open = roundPrice(c.open * ratio, decimals);
      c.high = roundPrice(c.high * ratio, decimals);
      c.low = roundPrice(c.low * ratio, decimals);
      c.close = roundPrice(c.close * ratio, decimals);
    }
    if (cList.length > 0) {
      const last = cList[cList.length - 1];
      last.close = livePrice;
      last.high = Math.max(last.high, livePrice);
      last.low = Math.min(last.low, livePrice);
    }
  }

  start() {
    if (this.enableExternalFeeds) {
      this._fetchBinanceSnapshot().catch(() => {});
      this._connectBinanceWs();
    }

    this.tickInterval = setInterval(() => {
      this._runTickCycle();
    }, 1000);
  }

  stop() {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.binanceWs) {
      try {
        this.binanceWs.terminate();
      } catch {
        // ignore
      }
      this.binanceWs = null;
    }
  }

  async _fetchBinanceSnapshot() {
    const cryptoMarkets = MARKETS.filter((m) => m.binanceSymbol);
    const symbolsParam = JSON.stringify(
      cryptoMarkets.map((m) => m.binanceSymbol.toUpperCase())
    );
    const url = `https://api.binance.com/api/v3/ticker/24hr?symbols=${encodeURIComponent(
      symbolsParam
    )}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) return;
      const data = await res.json();
      if (!Array.isArray(data)) return;

      const now = Date.now();
      for (const item of data) {
        const market = cryptoMarkets.find(
          (m) => m.binanceSymbol.toUpperCase() === item.symbol
        );
        if (!market) continue;

        const price = roundPrice(parseFloat(item.lastPrice), market.decimals);
        if (!Number.isFinite(price) || price <= 0) continue;

        const open24h = roundPrice(parseFloat(item.openPrice), market.decimals);
        const high24h = roundPrice(parseFloat(item.highPrice), market.decimals);
        const low24h = roundPrice(parseFloat(item.lowPrice), market.decimals);
        const changePercent = Number(parseFloat(item.priceChangePercent).toFixed(2));

        this._reanchorHistoryAndCandles(market.symbol, price, market.decimals);

        const existing = this.tickers.get(market.symbol);
        const cList = this.candles.get(market.symbol) || [];

        this.tickers.set(market.symbol, {
          ...existing,
          price,
          prevPrice: price,
          open24h: Number.isFinite(open24h) ? open24h : existing.open24h,
          high24h: Number.isFinite(high24h) ? high24h : existing.high24h,
          low24h: Number.isFinite(low24h) ? low24h : existing.low24h,
          changePercent: Number.isFinite(changePercent) ? changePercent : 0,
          source: 'binance_live',
          sparkline: cList.slice(-20).map((c) => c.close),
          updatedAt: now,
        });
        this.lastBinanceTickAt.set(market.symbol, now);
      }
    } catch {
      // Fall back gracefully to simulated crypto feed
    } finally {
      clearTimeout(timeout);
    }
  }

  _connectBinanceWs() {
    if (!this.enableExternalFeeds) return;
    const cryptoMarkets = MARKETS.filter((m) => m.binanceSymbol);
    const streams = cryptoMarkets.map((m) => `${m.binanceSymbol}@ticker`).join('/');
    const wsUrl = `wss://stream.binance.com:9443/stream?streams=${streams}`;

    try {
      const ws = new WebSocket(wsUrl);
      this.binanceWs = ws;

      ws.on('open', () => {
        this.binanceConnected = true;
      });

      ws.on('message', (raw) => {
        try {
          const msg = JSON.parse(raw.toString());
          const d = msg.data;
          if (!d || !d.s) return;
          const market = cryptoMarkets.find(
            (m) => m.binanceSymbol.toUpperCase() === d.s
          );
          if (!market) return;

          const price = roundPrice(parseFloat(d.c), market.decimals);
          if (!Number.isFinite(price) || price <= 0) return;

          const existing = this.tickers.get(market.symbol);
          const now = Date.now();
          if (existing.source !== 'binance_live') {
            this._reanchorHistoryAndCandles(market.symbol, price, market.decimals);
          }

          this.tickers.set(market.symbol, {
            ...existing,
            prevPrice: existing.price,
            price,
            open24h: roundPrice(parseFloat(d.o) || existing.open24h, market.decimals),
            high24h: roundPrice(parseFloat(d.h) || existing.high24h, market.decimals),
            low24h: roundPrice(parseFloat(d.l) || existing.low24h, market.decimals),
            changePercent: Number(parseFloat(d.P || 0).toFixed(2)),
            source: 'binance_live',
            updatedAt: now,
          });
          this.lastBinanceTickAt.set(market.symbol, now);
        } catch {
          // ignore malformed frame
        }
      });

      const scheduleReconnect = () => {
        this.binanceConnected = false;
        this.binanceWs = null;
        if (!this.reconnectTimer) {
          this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this._connectBinanceWs();
          }, 15_000);
        }
      };

      ws.on('error', () => {
        try {
          ws.close();
        } catch {
          // ignore
        }
      });

      ws.on('close', scheduleReconnect);
    } catch {
      this.binanceConnected = false;
    }
  }

  _runTickCycle() {
    const now = Date.now();

    for (const market of MARKETS) {
      const ticker = this.tickers.get(market.symbol);
      const lastLive = this.lastBinanceTickAt.get(market.symbol) || 0;
      const hasFreshLiveFeed =
        market.category === 'crypto' && now - lastLive < 12_000;

      if (!hasFreshLiveFeed) {
        const trend = this.trends.get(market.symbol);
        trend.ttl -= 1;
        if (trend.ttl <= 0) {
          trend.drift = (Math.random() - 0.5) * market.volatility * 0.4;
          trend.ttl = 12 + Math.floor(Math.random() * 28);
        }

        const meanReversion =
          ((ticker.open24h - ticker.price) / ticker.open24h) * 0.004;
        const shock = gaussianRandom() * market.volatility * 0.65;
        let nextPrice = ticker.price * (1 + trend.drift + meanReversion + shock);
        nextPrice = Math.max(
          ticker.open24h * 0.85,
          Math.min(ticker.open24h * 1.15, nextPrice)
        );
        nextPrice = roundPrice(nextPrice, market.decimals);

        if (nextPrice === ticker.price) {
          const tickUnit = 1 / 10 ** market.decimals;
          nextPrice = roundPrice(
            ticker.price + (Math.random() > 0.5 ? tickUnit : -tickUnit),
            market.decimals
          );
        }

        const high24h = Math.max(ticker.high24h, nextPrice);
        const low24h = Math.min(ticker.low24h, nextPrice);
        const changePercent = Number(
          (((nextPrice - ticker.open24h) / ticker.open24h) * 100).toFixed(2)
        );

        this.tickers.set(market.symbol, {
          ...ticker,
          prevPrice: ticker.price,
          price: nextPrice,
          high24h,
          low24h,
          changePercent,
          source: 'simulated',
          updatedAt: now,
        });
      }

      const updated = this.tickers.get(market.symbol);
      this._updateCandle(market.symbol, updated.price, now);
      const cList = this.candles.get(market.symbol) || [];
      updated.sparkline = cList.slice(-20).map((c) => c.close);

      const hist = this.history.get(market.symbol);
      hist.push({ time: now, price: updated.price });
      if (hist.length > MAX_HISTORY_POINTS) {
        hist.shift();
      }
    }

    this.emit('tick', this.getAllTickers());
  }

  getPrice(symbol) {
    const t = this.tickers.get(symbol);
    return t ? t.price : null;
  }

  getTicker(symbol) {
    return this.tickers.get(symbol) || null;
  }

  getAllTickers() {
    return MARKETS.map((m) => this.tickers.get(m.symbol));
  }

  getHistory(symbol) {
    return this.history.get(symbol) || [];
  }

  getCandles(symbol) {
    return this.candles.get(symbol) || [];
  }
}

module.exports = { PriceFeedService, CANDLE_INTERVAL_MS };
