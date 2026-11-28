import React, { useState } from 'react';
import {
  ArrowRight,
  ChevronDown,
  Clock,
  Coins,
  Gamepad2,
  Landmark,
  Lock,
  Moon,
  Plus,
  RefreshCw,
  Scale,
  ShieldCheck,
  Sun,
  TrendingUp,
  Trophy,
  Users,
  Wallet,
} from 'lucide-react';
import {
  AppTab,
  GlobalStats,
  MarketTicker,
  MasterWalletSummary,
  OriginalGameId,
} from '../types';
import { formatPrice, formatUsd } from '../utils/format';
import { PulseMark } from './TopNav';
import { BENTO_GAMES, BentoArtwork } from './originals/BentoGameCards';

interface LandingPageProps {
  tickers: MarketTicker[];
  globalStats: GlobalStats | null;
  masterWallet: MasterWalletSummary | null;
  onSignUp: () => void;
  onSignIn: () => void;
  onEnterApp: (tab?: AppTab) => void;
  onOpenGame?: (game: OriginalGameId) => void;
  theme: 'light' | 'dark';
  onToggleTheme?: () => void;
  isLoggedIn?: boolean;
}

const FAQS = [
  {
    q: 'How do I win in the Prediction Arena?',
    a: 'Pick any crypto or commodity market, choose your candle timeframe (1m up to 1D) and stake tier ($10, $50, or $100), then predict whether the next candle will close UP or DOWN relative to its opening strike price. When the candle closes, every player on the winning side splits 90% of the total pool equally.',
  },
  {
    q: 'What is the 10% Master Vault fee?',
    a: 'Each settled pool routes 10% to the transparent PULSE Master Vault and distributes the remaining 90% equally among all winners. Zero hidden spreads, variable juice, or order-book slippage.',
  },
  {
    q: 'Why is there an Anti-Snipe cutoff before each candle opens?',
    a: 'Entries seal early (15s before 1m candles, scaling up to 10m before 1D candles) so nobody can watch late price momentum and snipe a stale strike price right before open.',
  },
  {
    q: 'How do deposits and withdrawals work?',
    a: 'Sign in and tap + Deposit USDT to generate a live USDT (BEP-20) deposit address via USDTautopay — with no minimum deposit and 0% deposit fee. Balances credit automatically upon BSC confirmation, and payouts withdraw directly to your BEP-20 wallet.',
  },
  {
    q: 'Are the 10 PULSE Originals provably fair?',
    a: 'Yes. Every round in Blackjack, Crash, Mines, Plinko, Pump, Dice, Limbo, Keno, Dragon Tower, and Wheel uses HMAC-SHA256 with a hashed Server Seed, your editable Client Seed, and an incrementing Nonce at 99% RTP (99.5% on Blackjack).',
  },
  {
    q: 'What happens on an exact price tie or if nobody wins?',
    a: 'If a candle opens and closes at the exact same price (DRAW), or if every player backed the losing side, 100% of every stake is refunded with zero fee.',
  },
];

export const LandingPage: React.FC<LandingPageProps> = ({
  tickers,
  globalStats,
  masterWallet,
  onSignUp,
  onSignIn,
  onEnterApp,
  onOpenGame,
  theme,
  onToggleTheme,
  isLoggedIn = false,
}) => {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [previewStake, setPreviewStake] = useState<number>(50);

  const btcTicker =
    tickers.find((t) => t.symbol === 'BTC/USDT') || tickers[0] || null;
  const playingNow = globalStats?.totalPlayingNow;
  const isDark = theme === 'dark';

  return (
    <div className="min-h-screen w-full min-w-0 overflow-x-hidden bg-base text-fg">
      {/* 1. Minimalist Apex Pro Fintech Header (Matches Option 3 Mockup) */}
      <header className="sticky top-0 z-40 h-16 border-b border-line bg-surface/95 backdrop-blur-xl">
        <div className="mx-auto flex h-full max-w-[1360px] items-center justify-between gap-3 px-4 sm:px-6">
          <button onClick={() => onEnterApp('arena')} className="shrink-0">
            <PulseMark />
          </button>

          <nav className="hidden md:flex items-center gap-0.5 rounded-full border border-line bg-surface p-1 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <button
              onClick={() => onEnterApp('arena')}
              className="rounded-full bg-raised px-4 py-1.5 text-sm font-semibold text-fg"
            >
              Markets
            </button>
            <button
              onClick={() => onEnterApp('originals')}
              className="rounded-full px-4 py-1.5 text-sm font-medium text-muted transition hover:text-fg"
            >
              10 Originals
            </button>
            <button
              onClick={() => onEnterApp('master_wallet')}
              className="rounded-full px-4 py-1.5 text-sm font-medium text-muted transition hover:text-fg"
            >
              Vault
            </button>
            <button
              onClick={() => onEnterApp('leaderboard')}
              className="rounded-full px-4 py-1.5 text-sm font-medium text-muted transition hover:text-fg"
            >
              Leaderboard
            </button>
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            {onToggleTheme && (
              <button
                type="button"
                onClick={onToggleTheme}
                title={isDark ? 'Switch to Alabaster Light Mode' : 'Switch to Carbon Dark Mode'}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface text-muted transition hover:bg-raised hover:text-fg"
              >
                {isDark ? <Sun className="h-4 w-4 text-gold" /> : <Moon className="h-4 w-4" />}
              </button>
            )}
            {isLoggedIn ? (
              <button
                onClick={() => onEnterApp('arena')}
                className="flex h-9 items-center gap-1.5 rounded-full bg-fg px-4 text-xs sm:text-sm font-semibold text-inverse transition hover:opacity-90"
              >
                <span>Back to App</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            ) : (
              <>
                <button
                  onClick={onSignIn}
                  className="hidden sm:flex h-9 items-center rounded-full px-3 text-sm font-medium text-fg2 transition hover:bg-raised hover:text-fg"
                >
                  Sign In
                </button>
                <button
                  onClick={onSignUp}
                  className="btn-glow hidden sm:flex h-9 items-center gap-1 rounded-full bg-accent px-4 text-sm font-semibold text-onaccent transition hover:brightness-105"
                >
                  <Plus className="h-3.5 w-3.5 stroke-[2.8]" />
                  <span>Deposit USDT</span>
                </button>
                <button
                  onClick={onSignUp}
                  className="flex h-9 items-center rounded-full bg-fg px-4 text-xs sm:text-sm font-semibold text-inverse transition hover:opacity-90"
                >
                  Sign Up
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1360px] space-y-14 px-4 py-8 sm:px-6 sm:py-12">
        {/* 2. Hero Editorial + Live Polymarket-Style Order Ticket Preview */}
        <section className="grid grid-cols-1 items-center gap-8 lg:grid-cols-12 lg:gap-10">
          <div className="animate-fade-up lg:col-span-7 space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-1.5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
              <span className="h-2 w-2 rounded-full bg-accent animate-pulse" />
              <span className="font-mono text-xs font-semibold text-fg">
                {playingNow != null ? `${playingNow} traders live` : 'Markets open 24/7'}
              </span>
              <span className="text-xs text-muted">· Crypto, Gold &amp; Oil</span>
            </div>

            <h1 className="font-display text-4xl font-extrabold leading-[1.05] tracking-[-0.03em] text-fg sm:text-5xl lg:text-[58px]">
              Predict real-time markets.{' '}
              <span className="text-accent">Split the 90% pot.</span>
            </h1>

            <p className="max-w-xl text-base leading-relaxed text-fg2">
              Call <strong className="font-semibold text-accent">UP</strong> or{' '}
              <strong className="font-semibold text-danger">DOWN</strong> on live
              1m to 1D candles across BTC, ETH, Gold, and Crude Oil — or play{' '}
              <strong className="font-semibold text-fg">10 Provably-Fair Originals</strong>{' '}
              on the same instant USDT (BEP-20) wallet.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              {isLoggedIn ? (
                <button
                  onClick={() => onEnterApp('arena')}
                  className="btn-glow flex items-center gap-2 rounded-full bg-accent px-6 py-3 font-display text-sm font-bold text-onaccent transition hover:brightness-105"
                >
                  <span>Open Live Markets</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  onClick={onSignUp}
                  className="flex items-center gap-2 rounded-full bg-fg px-6 py-3 font-display text-sm font-bold text-inverse transition hover:opacity-90"
                >
                  <span>Create Free Account</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              )}

              <button
                onClick={() => onEnterApp('arena')}
                className="flex items-center gap-2 rounded-full border border-line bg-surface px-6 py-3 font-display text-sm font-semibold text-fg transition hover:bg-raised"
              >
                <span>{isLoggedIn ? 'Enter Arena' : 'Explore Live Markets'}</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-5 pt-1 text-xs font-medium text-muted">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-accent" />
                Anti-Snipe Cutoff
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Coins className="h-4 w-4 text-info" />
                No-Min USDT (BEP-20)
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Gamepad2 className="h-4 w-4 text-fg" />
                99% RTP Originals
              </span>
            </div>
          </div>

          {/* Right: Crisp Option 3 Polymarket-Style Order Ticket Preview */}
          <div className="lg:col-span-5">
            <div className="surface-card rounded-2xl p-6">
              <div className="flex items-center justify-between gap-2 pb-4 border-b border-line">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/15 font-mono text-xs font-extrabold text-amber-600">
                    ₿
                  </span>
                  <div>
                    <div className="font-display text-sm font-bold text-fg">
                      {btcTicker?.symbol || 'BTC/USDT'}
                    </div>
                    <div className="font-mono text-xl font-extrabold text-fg tabular-nums leading-tight">
                      ${btcTicker ? formatPrice(btcTicker.price, btcTicker.decimals) : '62,480.50'}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  {btcTicker && (
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 font-mono text-xs font-bold tabular-nums ${
                        btcTicker.changePercent >= 0
                          ? 'bg-accent/12 text-accent'
                          : 'bg-danger/12 text-danger'
                      }`}
                    >
                      {btcTicker.changePercent >= 0 ? '+' : ''}
                      {btcTicker.changePercent.toFixed(2)}%
                    </span>
                  )}
                  <div className="mt-1 flex items-center justify-end gap-1 font-mono text-[11px] text-muted">
                    <Clock className="h-3 w-3 text-accent" />
                    1m Next Candle
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <div className="text-xs font-medium text-muted">Probability split</div>
                <div className="mt-1.5 flex items-center justify-between font-display text-sm font-bold">
                  <span className="text-accent">58% UP</span>
                  <span className="text-danger">42% DOWN</span>
                </div>
                <div className="mt-1.5 flex h-2 w-full overflow-hidden rounded-full bg-raised">
                  <div className="h-full w-[58%] bg-accent" />
                  <div className="h-full w-[42%] bg-danger" />
                </div>
              </div>

              <div className="mt-4">
                <div className="mb-2 text-xs font-medium text-muted">Stake</div>
                <div className="grid grid-cols-3 gap-2">
                  {[10, 50, 100].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setPreviewStake(amt)}
                      className={`rounded-full border py-2 font-mono text-sm font-bold transition ${
                        previewStake === amt
                          ? 'border-info bg-info/10 text-info ring-1 ring-info/40'
                          : 'border-line bg-surface text-fg hover:bg-raised'
                      }`}
                    >
                      ${amt}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4 space-y-1.5 border-t border-line pt-3.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted">Payout Model</span>
                  <span className="font-semibold text-fg">90% Equal Split</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted">Est. Return</span>
                  <span className="font-mono font-bold text-accent tabular-nums">
                    ${(previewStake * 1.9).toFixed(2)} (+90%)
                  </span>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <button
                  type="button"
                  onClick={() => onEnterApp('arena')}
                  className="btn-glow w-full rounded-xl bg-accent py-3 font-display text-sm font-bold text-onaccent transition hover:brightness-105"
                >
                  Predict UP
                </button>
                <button
                  type="button"
                  onClick={() => onEnterApp('arena')}
                  className="w-full rounded-xl bg-danger py-3 font-display text-sm font-bold text-white transition hover:brightness-105"
                >
                  Predict DOWN
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* 3. Live Market Strip */}
        {tickers.length > 0 && (
          <div className="marquee-wrap overflow-hidden rounded-2xl border border-line bg-surface py-2.5">
            <div className="marquee-track flex items-center gap-3 px-3">
              {[...tickers, ...tickers].map((t, idx) => (
                <button
                  key={`${t.symbol}_${idx}`}
                  type="button"
                  onClick={() => onEnterApp('arena')}
                  className="flex shrink-0 items-center gap-2 rounded-full border border-line bg-raised px-3.5 py-1 text-xs transition hover:border-fg/30"
                >
                  <span className="font-display font-bold text-fg">{t.symbol}</span>
                  <span className="font-mono font-semibold text-fg2 tabular-nums">
                    ${formatPrice(t.price, t.decimals)}
                  </span>
                  <span
                    className={`font-mono text-[11px] font-bold tabular-nums ${
                      t.changePercent >= 0 ? 'text-accent' : 'text-danger'
                    }`}
                  >
                    {t.changePercent >= 0 ? '+' : ''}
                    {t.changePercent.toFixed(2)}%
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 4. Stats Row */}
        <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <div className="surface-card rounded-2xl p-5">
            <div className="flex items-center justify-between text-xs font-medium text-muted">
              <span>Players Online</span>
              <Users className="h-4 w-4 text-accent" />
            </div>
            <div className="mt-2 font-mono text-2xl font-extrabold text-fg sm:text-3xl tabular-nums">
              {playingNow != null ? playingNow.toLocaleString() : '—'}
            </div>
            <div className="mt-1 text-xs text-accent font-medium">Live across 10 pairs</div>
          </div>

          <div className="surface-card rounded-2xl p-5">
            <div className="flex items-center justify-between text-xs font-medium text-muted">
              <span>Total Pool Volume</span>
              <TrendingUp className="h-4 w-4 text-info" />
            </div>
            <div className="mt-2 font-mono text-2xl font-extrabold text-fg sm:text-3xl tabular-nums">
              {masterWallet ? formatUsd(masterWallet.totalVolumeCents) : '—'}
            </div>
            <div className="mt-1 text-xs text-muted">Crypto &amp; commodities</div>
          </div>

          <div className="surface-card rounded-2xl p-5">
            <div className="flex items-center justify-between text-xs font-medium text-muted">
              <span>Paid to Winners</span>
              <Trophy className="h-4 w-4 text-gold" />
            </div>
            <div className="mt-2 font-mono text-2xl font-extrabold text-accent sm:text-3xl tabular-nums">
              {masterWallet ? formatUsd(masterWallet.totalDistributedCents) : '—'}
            </div>
            <div className="mt-1 text-xs text-muted">90% equal distribution</div>
          </div>

          <div className="surface-card rounded-2xl p-5">
            <div className="flex items-center justify-between text-xs font-medium text-muted">
              <span>Originals Arcade</span>
              <Gamepad2 className="h-4 w-4 text-fg" />
            </div>
            <div className="mt-2 font-mono text-2xl font-extrabold text-fg sm:text-3xl">
              10 Games
            </div>
            <div className="mt-1 text-xs text-muted">99% RTP · Provably fair</div>
          </div>
        </section>

        {/* 5. Pastel Bento Originals Showcase (Option 3 Signature) */}
        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <span className="font-mono text-xs font-semibold uppercase tracking-wider text-accent">
                99% RTP · HMAC-SHA256 Verified
              </span>
              <h2 className="mt-1 font-display text-2xl font-extrabold tracking-tight text-fg sm:text-3xl">
                10 Instant Originals Games
              </h2>
            </div>
            <button
              onClick={() => onEnterApp('originals')}
              className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-4 py-2 text-xs font-semibold text-fg transition hover:bg-raised"
            >
              <span>View all 10 games</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-5">
            {BENTO_GAMES.map((game) => (
              <button
                key={game.id}
                type="button"
                onClick={() =>
                  onOpenGame ? onOpenGame(game.id) : onEnterApp('originals')
                }
                style={{
                  backgroundColor: isDark ? game.darkBg : game.lightBg,
                  borderColor: isDark ? game.darkBorder : game.lightBorder,
                }}
                className="bento-tile group flex items-center justify-between gap-2 rounded-2xl border p-4 text-left"
              >
                <div className="min-w-0">
                  <div className="font-display text-base font-extrabold text-fg">
                    {game.name}
                  </div>
                  <div className="mt-0.5 text-[11px] text-fg2 line-clamp-2">
                    {game.tagline}
                  </div>
                  <div
                    className="mt-2 font-mono text-[11px] font-bold"
                    style={{ color: game.accent }}
                  >
                    Up to {game.maxMult}
                  </div>
                </div>
                <BentoArtwork
                  id={game.id}
                  className="h-14 w-14 shrink-0 transition-transform duration-200 group-hover:scale-105"
                />
              </button>
            ))}
          </div>
        </section>

        {/* 6. How It Works (3 Crisp Steps) */}
        <section className="space-y-6">
          <div className="max-w-2xl">
            <span className="font-mono text-xs font-semibold uppercase tracking-wider text-info">
              How PULSE Works
            </span>
            <h2 className="mt-1 font-display text-2xl font-extrabold tracking-tight text-fg sm:text-3xl">
              Three steps from entry to instant settlement
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="surface-card rounded-2xl p-6">
              <div className="flex items-center justify-between">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/12 font-mono text-xs font-bold text-accent">
                  01
                </span>
                <Wallet className="h-5 w-5 text-accent" />
              </div>
              <h3 className="mt-4 font-display text-lg font-bold text-fg">
                Sign Up &amp; Deposit USDT
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-muted">
                Create an account in seconds and deposit USDT (BEP-20) with{' '}
                <strong className="text-fg">no minimum limit</strong> and{' '}
                <strong className="text-accent">0% deposit fee</strong>. Credits settle automatically after BSC confirmation.
              </p>
            </div>

            <div className="surface-card rounded-2xl p-6">
              <div className="flex items-center justify-between">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-info/12 font-mono text-xs font-bold text-info">
                  02
                </span>
                <TrendingUp className="h-5 w-5 text-info" />
              </div>
              <h3 className="mt-4 font-display text-lg font-bold text-fg">
                Choose Pair, Timeframe &amp; Side
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-muted">
                Pick BTC, ETH, Gold, or Oil, select a timeframe (<strong className="text-fg">1m–1D</strong>) and stake (<strong className="text-fg">$10 / $50 / $100</strong>), and predict <strong className="text-accent">UP</strong> or <strong className="text-danger">DOWN</strong> on the next candle.
              </p>
            </div>

            <div className="surface-card rounded-2xl p-6">
              <div className="flex items-center justify-between">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gold/12 font-mono text-xs font-bold text-gold">
                  03
                </span>
                <Trophy className="h-5 w-5 text-gold" />
              </div>
              <h3 className="mt-4 font-display text-lg font-bold text-fg">
                Winners Split 90% Equally
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-muted">
                At candle close, <strong className="text-accent">90% of the total pool</strong> is split equally among every player on the winning side, while <strong className="text-fg">10%</strong> goes to the Master Vault.
              </p>
            </div>
          </div>
        </section>

        {/* 7. Fair-Play Mechanics & Math Example */}
        <section className="surface-card rounded-2xl p-6 sm:p-8">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="font-mono text-xs font-semibold uppercase tracking-wider text-accent">
                Transparent Pool Rules
              </span>
              <h2 className="mt-1 font-display text-2xl font-extrabold tracking-tight text-fg">
                Anti-Snipe Protection &amp; Exact Pool Math
              </h2>
            </div>
            <button
              onClick={() => onEnterApp('master_wallet')}
              className="flex items-center gap-1.5 rounded-full border border-line bg-raised px-4 py-2 text-xs font-semibold text-fg transition hover:bg-overlay"
            >
              <Landmark className="h-3.5 w-3.5 text-gold" />
              <span>Audit Master Vault</span>
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="rounded-xl border border-line bg-raised p-5">
              <div className="flex items-center gap-2 text-gold">
                <Lock className="h-4 w-4" />
                <span className="font-display text-sm font-bold text-fg">
                  Anti-Snipe Lock
                </span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted">
                Entries close <strong className="text-fg">15s before 1m candles</strong> (scaling up to 10m before 1D candles), blocking last-second sniping.
              </p>
            </div>

            <div className="rounded-xl border border-line bg-raised p-5">
              <div className="flex items-center gap-2 text-accent">
                <Scale className="h-4 w-4" />
                <span className="font-display text-sm font-bold text-fg">
                  Equal Split Example
                </span>
              </div>
              <p className="mt-2 font-mono text-xs leading-relaxed text-fg2">
                10 players × $10 = $100 pool → $10 fee → $90 split among 4 winners ={' '}
                <strong className="text-accent">$22.50 each</strong>
              </p>
            </div>

            <div className="rounded-xl border border-line bg-raised p-5">
              <div className="flex items-center gap-2 text-info">
                <RefreshCw className="h-4 w-4" />
                <span className="font-display text-sm font-bold text-fg">
                  Draw &amp; Zero-Winner Refund
                </span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted">
                Exact open = close ties or zero-winner rounds automatically trigger a{' '}
                <strong className="text-fg">100% stake refund</strong> with 0% vault fee.
              </p>
            </div>
          </div>
        </section>

        {/* 8. Deposits & Withdrawals */}
        <section className="surface-card rounded-2xl p-6 sm:p-8">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
            <div className="max-w-2xl space-y-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/12 px-3 py-1 font-mono text-[11px] font-bold text-accent">
                <Coins className="h-3.5 w-3.5" />
                USDTautopay Live Cashier
              </span>
              <h2 className="font-display text-2xl font-extrabold tracking-tight text-fg">
                Instant USDT (BEP-20) Deposits &amp; Payouts
              </h2>
              <p className="text-xs leading-relaxed text-muted sm:text-sm">
                Fund your wallet with <strong className="text-fg">no minimum deposit</strong> and{' '}
                <strong className="text-accent">0% deposit fee</strong> on BNB Smart Chain. Withdraw anytime directly to your verified BEP-20 address.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2.5 shrink-0 font-mono text-center">
              <div className="rounded-xl border border-line bg-raised px-4 py-3">
                <div className="text-[10px] uppercase text-muted">Network</div>
                <div className="mt-1 text-xs font-extrabold text-accent">BSC BEP-20</div>
              </div>
              <div className="rounded-xl border border-line bg-raised px-4 py-3">
                <div className="text-[10px] uppercase text-muted">Deposit Fee</div>
                <div className="mt-1 text-xs font-extrabold text-fg">0%</div>
              </div>
              <div className="rounded-xl border border-line bg-raised px-4 py-3">
                <div className="text-[10px] uppercase text-muted">Minimum</div>
                <div className="mt-1 text-xs font-extrabold text-info">No Min</div>
              </div>
            </div>
          </div>
        </section>

        {/* 9. FAQ Accordion */}
        <section className="mx-auto max-w-3xl space-y-5">
          <div className="text-center">
            <h2 className="font-display text-2xl font-extrabold tracking-tight text-fg sm:text-3xl">
              Frequently Asked Questions
            </h2>
            <p className="mt-1 text-xs text-muted">
              Clear rules, verifiable fairness, and automated payouts.
            </p>
          </div>

          <div className="space-y-2.5">
            {FAQS.map((item, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={item.q}
                  className="surface-card overflow-hidden rounded-xl"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
                  >
                    <span className="font-display text-sm font-bold text-fg">
                      {item.q}
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-muted transition-transform ${
                        isOpen ? 'rotate-180 text-accent' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="border-t border-line px-5 pb-4 pt-3 text-xs leading-relaxed text-fg2">
                      {item.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* 10. Clean Footer */}
        <footer className="flex flex-col items-center justify-between gap-4 border-t border-line pt-8 pb-6 text-xs text-muted sm:flex-row">
          <div>
            <span className="font-display font-bold text-fg">© PULSE Exchange</span>
            <span className="mx-2">·</span>
            <span>18+ only · Play responsibly</span>
          </div>
          <div className="flex flex-wrap items-center gap-5 font-medium">
            <button onClick={() => onEnterApp('arena')} className="hover:text-fg">
              Markets
            </button>
            <button onClick={() => onEnterApp('originals')} className="hover:text-fg">
              10 Originals
            </button>
            <button onClick={() => onEnterApp('leaderboard')} className="hover:text-fg">
              Leaderboard
            </button>
            <button onClick={() => onEnterApp('master_wallet')} className="hover:text-fg">
              Vault
            </button>
          </div>
        </footer>
      </main>
    </div>
  );
};
