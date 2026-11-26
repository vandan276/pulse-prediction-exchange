# PULSE — Crypto & Commodities Prediction Exchange + 10 Stake-Style Originals

A real-time full-stack **Crypto & Commodities Prediction Arena** paired with **10 Provably-Fair Stake-style Originals** (**Blackjack, Crash, Pump, Mines, Plinko, Dice, Limbo, Keno, Dragon Tower, Wheel**), a unified **Master Treasury Vault**, and a Daylight Light / Midnight Dark institutional trading UI.

## Core Features

- **10 Live Markets**: 5 Crypto pairs (`BTC/USDT`, `ETH/USDT`, `SOL/USDT`, `BNB/USDT`, `XRP/USDT` via live Binance WebSocket) + 5 Commodities (`XAU/USD` Gold, `XAG/USD` Silver, `WTI/USD`, `BRENT/USD`, `NG/USD`).
- **7 Synchronized Timeframes**: `1m`, `5m`, `10m`, `15m`, `30m`, `1h`, and `1d` with fixed equal-stake rooms (`$10`, `$50`, `$100`).
- **Anti-Snipe Pre-Lock Cutoff**: Entries hard-close before each candle opens (`15s` pre-lock on `1m`, scaled up to `10m` on `1d`) so no one can snipe at the last second.
- **90 / 10 Equal-Split Pool Economics**: Every settled prediction round routes **10%** to the **Master Treasury Vault** and splits **90%** equally among all winning players (100% refund on ties or zero winners).
- **10 PULSE Originals**: **Blackjack** (`3:2`, Hit/Stand/Double/Split), **Crash** (live rising curve), **Pump**, **Mines 5×5**, **Plinko** (60fps canvas), **Dice**, **Limbo**, **Keno**, **Dragon Tower**, and **Wheel**.

## Local Full-Stack Development (Node.js + SQLite + Socket.IO)

```bash
npm run install:all
npm run build && npm start
# Opens at http://localhost:4000
```

Run automated tests (10 unit & integration tests):

```bash
npm test
```

## Vercel Hosting

`vercel.json` builds the frontend with `VITE_STANDALONE=true`, enabling the built-in browser live engine (live Binance WebSocket crypto prices, simulated commodities, full 90/10 prediction engine, all 10 Originals, and `localStorage` persistence) so the app runs 100% live on Vercel with zero external server required.
