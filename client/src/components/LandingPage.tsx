import React, { useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ChevronDown,
  Clock,
  Coins,
  Diamond,
  Dices,
  Disc3,
  Flame,
  Gamepad2,
  Grid,
  Landmark,
  Lock,
  LogIn,
  RefreshCw,
  Rocket,
  Scale,
  ShieldCheck,
  Spade,
  Sparkles,
  TrendingUp,
  Trophy,
  UserPlus,
  Users,
  Wallet,
  Wind,
  Zap,
} from 'lucide-react';
import {
  AppTab,
  GlobalStats,
  MarketTicker,
  MasterWalletSummary,
} from '../types';
import { formatPrice, formatUsd } from '../utils/format';

interface LandingPageProps {
  tickers: MarketTicker[];
  globalStats: GlobalStats | null;
  masterWallet: MasterWalletSummary | null;
  onSignUp: () => void;
  onSignIn: () => void;
  onEnterApp: (tab?: AppTab) => void;
  theme: 'light' | 'dark';
  isLoggedIn?: boolean;
}

const ORIGINALS_TILES = [
  {
    name: 'Blackjack',
    maxWin: '2.50x',
    accent: '#00E599',
    tagline: 'Hit, Stand, Double & Split',
    icon: Spade,
  },
  {
    name: 'Crash',
    maxWin: '10,000x',
    accent: '#10B981',
    tagline: 'Cash out before detonation',
    icon: Rocket,
  },
  {
    name: 'Pump',
    maxWin: '3.2Mx',
    accent: '#FF3B69',
    tagline: 'Inflate & bail out in time',
    icon: Wind,
  },
  {
    name: 'Mines',
    maxWin: '5.1Mx',
    accent: '#34D399',
    tagline: 'Dodge bombs on 5x5 grid',
    icon: Diamond,
  },
  {
    name: 'Plinko',
    maxWin: '1,000x',
    accent: '#F5B731',
    tagline: 'Drop balls into multiplier pins',
    icon: Sparkles,
  },
  {
    name: 'Dice',
    maxWin: '49.50x',
    accent: '#38BDF8',
    tagline: 'Custom Roll Over / Under odds',
    icon: Dices,
  },
  {
    name: 'Limbo',
    maxWin: '1,000,000x',
    accent: '#FBBF24',
    tagline: 'Pick any target multiplier',
    icon: Zap,
  },
  {
    name: 'Keno',
    maxWin: '1,000x',
    accent: '#2DD4BF',
    tagline: 'Match up to 10 lucky tiles',
    icon: Grid,
  },
  {
    name: 'Dragon Tower',
    maxWin: '19,486x',
    accent: '#F97316',
    tagline: 'Climb 9 volcanic floors',
    icon: Flame,
  },
  {
    name: 'Wheel',
    maxWin: '49.50x',
    accent: '#A855F7',
    tagline: 'Spin 10-50 risk segments',
    icon: Disc3,
  },
];

const FAQS = [
  {
    q: 'How do I win in the Prediction Arena?',
    a: 'Pick any crypto or commodity market, choose your candle timeframe (1m up to 1D) and stake tier ($10, $50, or $100), then predict whether the next candle will close HIGHER (UP) or LOWER (DOWN) than its opening strike price. If your direction wins when the candle closes, you share the 90% winner pot equally with all other winners in that room.',
  },
  {
    q: 'What is the 10% Master Vault fee?',
    a: 'Every settled round reserves 10% of the combined UP + DOWN pool for the PULSE Master Vault treasury and distributes the remaining 90% equally among every player on the winning side. Zero hidden spreads or variable house odds.',
  },
  {
    q: 'Why can’t I bet at the last second before a candle opens?',
    a: 'Our Anti-Snipe Lock seals entries early (15s before 1m candles up to 10m before 1D candles) so nobody can watch late momentum right before open and snipe a stale strike price. Once entries seal, every ticket is locked cleanly for the upcoming candle.',
  },
  {
    q: 'How do deposits and withdrawals work?',
    a: 'Sign in and open the Cashier to deposit USDT (BEP-20 on BNB Smart Chain) via our live USDTautopay checkout — with no minimum amount and 0% deposit fee. Once confirmed on-chain, your wallet credits automatically. Withdrawals verify your BEP-20 wallet address and dispatch directly to BSC.',
  },
  {
    q: 'Are PULSE Originals provably fair?',
    a: 'Yes. All 10 Originals run at 99% RTP (99.5% on Blackjack) and generate outcomes deterministically via HMAC-SHA256 combining a hashed Server Seed, your customizable Client Seed, and an incrementing Nonce. You can inspect or rotate your seed anytime inside the Originals hub.',
  },
  {
    q: 'What happens on a tie or if nobody chooses the winning side?',
    a: 'If a candle opens and closes at the exact same price (DRAW), or if every player in the room picked the losing side (NO WINNERS), 100% of every stake is refunded automatically with 0% vault fee.',
  },
];

export const LandingPage: React.FC<LandingPageProps> = ({
  tickers,
  globalStats,
  masterWallet,
  onSignUp,
  onSignIn,
  onEnterApp,
  theme: _theme,
  isLoggedIn = false,
}) => {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const btcTicker =
    tickers.find((t) => t.symbol === 'BTC/USDT') || tickers[0] || null;
  const playingNow = globalStats?.totalPlayingNow;
  const hasMarketMarquee = tickers.length > 0;

  return (
    <div className="min-h-screen w-full min-w-0 overflow-x-hidden bg-[#07050F] text-zinc-100">
      {/* Ambient Neon Casino Glows */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 left-1/2 h-[520px] w-[860px] -translate-x-1/2 rounded-full bg-[#00E599]/10 blur-[140px]" />
        <div className="absolute top-24 -left-24 h-[400px] w-[420px] rounded-full bg-purple-600/15 blur-[130px]" />
        <div className="absolute top-64 -right-24 h-[380px] w-[380px] rounded-full bg-[#F5B731]/10 blur-[130px]" />
      </div>

      {/* 1. Sticky Landing Header */}
      <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-[#07050F]/85 backdrop-blur-2xl">
        <div className="mx-auto flex h-16 max-w-[1380px] items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#00E599] shadow-[0_0_24px_rgba(0,229,153,0.45)]">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="h-5 w-5 text-[#040507]"
                stroke="currentColor"
                strokeWidth="2.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="22 12 18 12 15 20 9 4 6 12 2 12" />
              </svg>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-display text-lg font-extrabold tracking-[-0.03em] text-white">
                PULSE
              </span>
              <span className="hidden xs:inline sm:inline rounded-md bg-white/[0.08] px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-widest text-[#00E599]">
                EXCHANGE
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isLoggedIn ? (
              <button
                onClick={() => onEnterApp('arena')}
                className="btn-glow flex items-center gap-1.5 rounded-full bg-[#00E599] px-4 py-2 font-display text-xs font-extrabold text-[#040507] transition hover:brightness-110"
              >
                <span>Back to App</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            ) : (
              <>
                <button
                  onClick={onSignIn}
                  className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.05] px-3.5 py-2 text-xs font-bold text-white transition hover:bg-white/[0.1]"
                >
                  <LogIn className="h-3.5 w-3.5" />
                  <span>Sign In</span>
                </button>
                <button
                  onClick={onSignUp}
                  className="btn-glow flex items-center gap-1.5 rounded-full bg-[#00E599] px-4 py-2 font-display text-xs font-extrabold text-[#040507] transition hover:brightness-110"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  <span>Sign Up</span>
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-[1380px] px-4 sm:px-6">
        {/* 2. Hero Section */}
        <section className="grid grid-cols-1 items-center gap-8 py-10 sm:py-16 lg:grid-cols-12 lg:gap-10">
          <div className="animate-fade-up lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#00E599]/35 bg-[#00E599]/10 px-3.5 py-1.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00E599] opacity-80" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#00E599]" />
              </span>
              <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#00E599]">
                LIVE · {playingNow != null ? `${playingNow} players online` : 'Exchange live'}
              </span>
            </div>

            <h1 className="font-display text-4xl font-black leading-[1.06] tracking-tight text-white sm:text-5xl lg:text-6xl">
              Predict the Market.{' '}
              <span className="bg-gradient-to-r from-[#00E599] via-emerald-300 to-[#F5B731] bg-clip-text text-transparent">
                Win the Pot.
              </span>
            </h1>

            <p className="max-w-xl text-sm leading-relaxed text-zinc-300 sm:text-base">
              Call <strong className="text-[#00E599]">UP</strong> or{' '}
              <strong className="text-[#FF3B69]">DOWN</strong> on live BTC, ETH,
              Gold, and Oil candles across 1m to 1D timeframes — plus play{' '}
              <strong className="text-white">10 Provably-Fair Originals</strong>{' '}
              like Blackjack, Crash, Mines, and Plinko. Winners split{' '}
              <strong className="text-[#F5B731]">90% of every round pool</strong>{' '}
              equally.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              {isLoggedIn ? (
                <button
                  onClick={() => onEnterApp('arena')}
                  className="btn-glow flex items-center gap-2 rounded-2xl bg-gradient-to-b from-[#00F0A0] to-[#00C480] px-6 py-3.5 font-display text-sm font-black text-[#040507] transition hover:brightness-110"
                >
                  <span>Enter Trading Arena</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  onClick={onSignUp}
                  className="btn-glow flex items-center gap-2 rounded-2xl bg-gradient-to-b from-[#00F0A0] to-[#00C480] px-6 py-3.5 font-display text-sm font-black text-[#040507] transition hover:brightness-110"
                >
                  <UserPlus className="h-4 w-4" />
                  <span>Create Free Account</span>
                </button>
              )}

              <button
                onClick={() => onEnterApp('arena')}
                className="flex items-center gap-2 rounded-2xl border border-white/15 bg-white/[0.06] px-6 py-3.5 font-display text-sm font-bold text-white transition hover:border-white/30 hover:bg-white/[0.1]"
              >
                <span>{isLoggedIn ? 'Open Arena' : 'Explore as Guest'}</span>
                <ArrowRight className="h-4 w-4 text-zinc-400" />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-zinc-400">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-[#00E599]" />
                Anti-Snipe Lock
              </span>
              <span className="flex items-center gap-1.5">
                <Coins className="h-4 w-4 text-[#F5B731]" />
                No-Min USDT (BEP-20)
              </span>
              <span className="flex items-center gap-1.5">
                <Gamepad2 className="h-4 w-4 text-purple-400" />
                99% RTP Originals
              </span>
            </div>
          </div>

          {/* Decorative Live Round Preview Card */}
          <div className="lg:col-span-5">
            <div className="relative rounded-3xl border border-white/12 bg-gradient-to-br from-[#121626]/95 via-[#0B0E17]/95 to-[#160D24]/95 p-5 sm:p-6 shadow-[0_24px_80px_-24px_rgba(0,229,153,0.28)] backdrop-blur-xl">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F5B731]/15 text-[#F5B731] ring-1 ring-[#F5B731]/30">
                    <TrendingUp className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-display text-base font-bold text-white">
                        {btcTicker?.symbol || 'BTC/USDT'}
                      </span>
                      <span className="rounded-full bg-[#00E599]/15 px-2 py-0.5 font-mono text-[10px] font-bold text-[#00E599]">
                        1m NEXT CANDLE
                      </span>
                    </div>
                    <div className="font-mono text-xs text-zinc-400">
                      Live Room Preview · Anti-Snipe Active
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 rounded-full border border-[#F5B731]/35 bg-[#F5B731]/15 px-2.5 py-1 font-mono text-[11px] font-bold text-[#F5B731]">
                  <Clock className="h-3 w-3" />
                  00:34
                </div>
              </div>

              <div className="mt-5 flex items-baseline justify-between rounded-2xl border border-white/[0.08] bg-[#060810]/85 px-4 py-3.5">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                    Live Spot Index
                  </div>
                  <div className="mt-0.5 font-mono text-2xl font-extrabold text-white tabular-nums">
                    ${btcTicker ? formatPrice(btcTicker.price, btcTicker.decimals) : '—'}
                  </div>
                </div>
                {btcTicker && (
                  <span
                    className={`rounded-lg px-2.5 py-1 font-mono text-xs font-bold tabular-nums ${
                      btcTicker.changePercent >= 0
                        ? 'bg-[#00E599]/15 text-[#00E599]'
                        : 'bg-[#FF3B69]/15 text-[#FF3B69]'
                    }`}
                  >
                    {btcTicker.changePercent >= 0 ? '+' : ''}
                    {btcTicker.changePercent.toFixed(2)}%
                  </span>
                )}
              </div>

              {/* UP / DOWN Pool Bar */}
              <div className="mt-4 rounded-2xl border border-white/[0.08] bg-[#060810]/85 p-4">
                <div className="mb-2 flex items-center justify-between font-mono text-xs font-bold">
                  <span className="text-[#00E599]">UP · 60% ($60)</span>
                  <span className="text-[#FF3B69]">DOWN · 40% ($40)</span>
                </div>
                <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-white/[0.07] gap-0.5">
                  <div className="h-full w-[60%] rounded-l-full bg-[#00E599] shadow-[0_0_16px_rgba(0,229,153,0.6)]" />
                  <div className="h-full w-[40%] rounded-r-full bg-[#FF3B69] shadow-[0_0_16px_rgba(255,59,105,0.6)]" />
                </div>
                <div className="mt-3 flex items-center justify-between text-[11px] text-zinc-400">
                  <span>Pool: <strong className="font-mono text-white">$100.00</strong></span>
                  <span>Winners Pot (90%): <strong className="font-mono text-[#00E599]">$90.00</strong></span>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => onEnterApp('arena')}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-b from-[#00F0A0] to-[#00C480] py-3 font-display text-xs font-black text-[#040507] shadow-[0_8px_24px_-6px_rgba(0,229,153,0.5)] transition hover:brightness-110"
                >
                  <ArrowUp className="h-4 w-4 stroke-[3]" />
                  CALL HIGHER
                </button>
                <button
                  type="button"
                  onClick={() => onEnterApp('arena')}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-b from-[#FF4774] to-[#E11D48] py-3 font-display text-xs font-black text-white shadow-[0_8px_24px_-6px_rgba(255,59,105,0.5)] transition hover:brightness-110"
                >
                  <ArrowDown className="h-4 w-4 stroke-[3]" />
                  CALL LOWER
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* 3. Live Market Marquee Strip */}
      {hasMarketMarquee && (
        <div className="marquee-wrap relative z-10 overflow-hidden border-y border-white/[0.08] bg-[#0B0816]/90 py-2.5">
          <div className="marquee-track flex items-center gap-6 px-3">
            {[...tickers, ...tickers].map((t, idx) => (
              <button
                key={`${t.symbol}_${idx}`}
                type="button"
                onClick={() => onEnterApp('arena')}
                className="flex shrink-0 items-center gap-2 rounded-full border border-white/[0.07] bg-white/[0.03] px-3 py-1 text-xs transition hover:border-white/20"
              >
                <span className="font-display font-bold text-white">{t.symbol}</span>
                <span className="font-mono font-semibold text-zinc-200 tabular-nums">
                  ${formatPrice(t.price, t.decimals)}
                </span>
                <span
                  className={`font-mono text-[11px] font-bold tabular-nums ${
                    t.changePercent >= 0 ? 'text-[#00E599]' : 'text-[#FF3B69]'
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

      <div className="relative z-10 mx-auto max-w-[1380px] space-y-16 px-4 py-12 sm:px-6 sm:py-16">
        {/* 4. Stats Row (4 Cards) */}
        <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-[#0D0B18]/90 p-4 sm:p-5">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span>Players Online</span>
              <Users className="h-4 w-4 text-[#00E599]" />
            </div>
            <div className="mt-2 font-mono text-2xl font-extrabold text-white sm:text-3xl tabular-nums">
              {playingNow != null ? playingNow.toLocaleString() : '—'}
            </div>
            <div className="mt-1 text-[11px] text-[#00E599]">Live active pools</div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#0D0B18]/90 p-4 sm:p-5">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span>Total Pool Volume</span>
              <TrendingUp className="h-4 w-4 text-sky-400" />
            </div>
            <div className="mt-2 font-mono text-2xl font-extrabold text-white sm:text-3xl tabular-nums">
              {masterWallet ? formatUsd(masterWallet.totalVolumeCents) : '—'}
            </div>
            <div className="mt-1 text-[11px] text-zinc-400">Across crypto & metals</div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#0D0B18]/90 p-4 sm:p-5">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span>Paid to Winners</span>
              <Trophy className="h-4 w-4 text-[#F5B731]" />
            </div>
            <div className="mt-2 font-mono text-2xl font-extrabold text-[#00E599] sm:text-3xl tabular-nums">
              {masterWallet ? formatUsd(masterWallet.totalDistributedCents) : '—'}
            </div>
            <div className="mt-1 text-[11px] text-[#F5B731]">90% equal payout rule</div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#0D0B18]/90 p-4 sm:p-5">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span>Originals Arcade</span>
              <Gamepad2 className="h-4 w-4 text-purple-400" />
            </div>
            <div className="mt-2 font-mono text-2xl font-extrabold text-white sm:text-3xl">
              10 Games
            </div>
            <div className="mt-1 text-[11px] text-purple-300">99% RTP · Provably Fair</div>
          </div>
        </section>

        {/* 5. How It Works (3 Steps) */}
        <section className="space-y-6">
          <div className="text-center max-w-2xl mx-auto">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-purple-400/30 bg-purple-500/10 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-widest text-purple-300">
              How PULSE Works
            </span>
            <h2 className="mt-3 font-display text-2xl font-extrabold text-white sm:text-3xl">
              Three Steps From Entry to Payout
            </h2>
            <p className="mt-2 text-xs text-zinc-400 sm:text-sm">
              Transparent peer-pooled market predictions with fixed stakes and automated settlement.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-transparent p-6">
              <div className="flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#00E599]/15 font-mono text-sm font-black text-[#00E599] ring-1 ring-[#00E599]/30">
                  01
                </span>
                <Wallet className="h-5 w-5 text-[#00E599]" />
              </div>
              <h3 className="mt-4 font-display text-lg font-bold text-white">
                Sign Up &amp; Deposit USDT
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-zinc-400">
                Create your account in seconds and deposit USDT (BEP-20) with{' '}
                <strong className="text-white">no minimum limit</strong> and{' '}
                <strong className="text-[#00E599]">0% deposit fee</strong>. Credits land automatically after BSC confirmation.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-transparent p-6">
              <div className="flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/20 font-mono text-sm font-black text-purple-300 ring-1 ring-purple-400/30">
                  02
                </span>
                <TrendingUp className="h-5 w-5 text-purple-300" />
              </div>
              <h3 className="mt-4 font-display text-lg font-bold text-white">
                Pick Market, Timeframe &amp; Direction
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-zinc-400">
                Choose a live asset, select a timeframe (<strong className="text-white">1m, 5m, 10m, 15m, 30m, 1h, 1D</strong>) and stake tier (<strong className="text-white">$10 / $50 / $100</strong>), and call <strong className="text-[#00E599]">UP</strong> or <strong className="text-[#FF3B69]">DOWN</strong> on the <strong className="text-white">next</strong> candle.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-transparent p-6">
              <div className="flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F5B731]/15 font-mono text-sm font-black text-[#F5B731] ring-1 ring-[#F5B731]/30">
                  03
                </span>
                <Trophy className="h-5 w-5 text-[#F5B731]" />
              </div>
              <h3 className="mt-4 font-display text-lg font-bold text-white">
                Candle Closes · Winners Split 90%
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-zinc-400">
                When the candle closes, <strong className="text-[#00E599]">90% of the total pool</strong> is split equally among every player on the winning side, while <strong className="text-[#F5B731]">10%</strong> routes to the Master Vault.
              </p>
            </div>
          </div>
        </section>

        {/* 6. Fair-Play Explainer */}
        <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#100D1E] via-[#0B0914] to-[#081312] p-6 sm:p-8">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-[#00E599]">
                Fair-Play Mechanics
              </span>
              <h2 className="mt-1 font-display text-2xl font-extrabold text-white">
                Zero Last-Second Sniping. Pure Pool Math.
              </h2>
            </div>
            <button
              onClick={() => onEnterApp('master_wallet')}
              className="flex items-center gap-1.5 rounded-xl border border-[#F5B731]/35 bg-[#F5B731]/10 px-4 py-2 text-xs font-bold text-[#F5B731] transition hover:bg-[#F5B731]/20"
            >
              <Landmark className="h-3.5 w-3.5" />
              <span>Audit Master Vault</span>
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-[#07060E]/90 p-5">
              <div className="flex items-center gap-2 text-[#F5B731]">
                <Lock className="h-4 w-4" />
                <span className="font-display text-sm font-bold text-white">
                  Anti-Snipe Lock
                </span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-zinc-400">
                Entries close <strong className="text-white">15s before 1m candles</strong> (scaling up to 10m before 1D candles). Nobody can jump into a round right as the candle starts or snipe late price moves.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#07060E]/90 p-5">
              <div className="flex items-center gap-2 text-[#00E599]">
                <Scale className="h-4 w-4" />
                <span className="font-display text-sm font-bold text-white">
                  Equal Split Example
                </span>
              </div>
              <p className="mt-2 font-mono text-xs leading-relaxed text-emerald-200">
                10 players × $10 = $100 pool → $10 fee → $90 split among 4 winners ={' '}
                <strong className="text-[#00E599]">$22.50 each</strong>
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#07060E]/90 p-5">
              <div className="flex items-center gap-2 text-sky-400">
                <RefreshCw className="h-4 w-4" />
                <span className="font-display text-sm font-bold text-white">
                  Draw &amp; Zero-Winner Refund
                </span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-zinc-400">
                If a candle closes exactly equal to its opening strike price, or if all players backed the losing side, <strong className="text-white">100% of every stake is refunded</strong> with zero vault fee.
              </p>
            </div>
          </div>
        </section>

        {/* 7. Originals Showcase */}
        <section className="space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full border border-[#00E599]/35 bg-[#00E599]/10 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-[#00E599]">
                <ShieldCheck className="h-3.5 w-3.5" />
                99% RTP · Provably Fair (HMAC-SHA256)
              </div>
              <h2 className="mt-2 font-display text-2xl font-extrabold text-white sm:text-3xl">
                10 PULSE Originals Casino Games
              </h2>
            </div>
            <button
              onClick={() => onEnterApp('originals')}
              className="flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.06] px-4 py-2 text-xs font-bold text-white transition hover:bg-white/[0.12]"
            >
              <span>Open Originals Arcade</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {ORIGINALS_TILES.map((game) => {
              const Icon = game.icon;
              return (
                <button
                  key={game.name}
                  type="button"
                  onClick={() => onEnterApp('originals')}
                  style={{
                    background: `linear-gradient(140deg, ${game.accent}2B 0%, rgba(15, 13, 28, 0.96) 75%)`,
                    borderColor: `${game.accent}44`,
                  }}
                  className="group relative overflow-hidden rounded-2xl border p-4 text-left transition-all duration-200 hover:-translate-y-1 hover:shadow-2xl"
                >
                  <Icon
                    className="pointer-events-none absolute -bottom-3 -right-3 h-20 w-20 opacity-10 transition-transform duration-300 group-hover:scale-110"
                    style={{ color: game.accent }}
                  />
                  <div className="flex items-center justify-between">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-[#07050F]/85"
                      style={{ color: game.accent }}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <span
                      className="rounded-full px-2 py-0.5 font-mono text-[10px] font-extrabold"
                      style={{
                        backgroundColor: `${game.accent}24`,
                        color: game.accent,
                      }}
                    >
                      {game.maxWin}
                    </span>
                  </div>
                  <div className="mt-3 font-display text-base font-bold text-white">
                    {game.name}
                  </div>
                  <div className="mt-0.5 text-[11px] text-zinc-400">
                    {game.tagline}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* 8. Deposits & Withdrawals */}
        <section className="rounded-3xl border border-[#00E599]/25 bg-gradient-to-r from-[#071915] via-[#0B101D] to-[#120C22] p-6 sm:p-8">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
            <div className="space-y-2 max-w-2xl">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-[#00E599]/15 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-[#00E599]">
                <Coins className="h-3.5 w-3.5" />
                USDT (BEP-20) Cashier Powered by USDTautopay
              </div>
              <h2 className="font-display text-2xl font-extrabold text-white">
                Instant USDT (BEP-20) Deposits &amp; Fast BSC Payouts
              </h2>
              <p className="text-xs leading-relaxed text-zinc-300 sm:text-sm">
                Start with any amount — <strong className="text-white">no minimum deposit</strong> and{' '}
                <strong className="text-[#00E599]">0% deposit fee</strong>. Generate a live BEP-20 deposit address, pay via QR or checkout link, and watch BSC confirmations auto-credit your balance.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2.5 shrink-0 font-mono text-center">
              <div className="rounded-2xl border border-white/10 bg-[#07050F]/80 px-3 py-3">
                <div className="text-[10px] uppercase text-zinc-500">Network</div>
                <div className="mt-1 text-xs font-extrabold text-[#00E599]">BSC BEP-20</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-[#07050F]/80 px-3 py-3">
                <div className="text-[10px] uppercase text-zinc-500">Deposit Fee</div>
                <div className="mt-1 text-xs font-extrabold text-white">0%</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-[#07050F]/80 px-3 py-3">
                <div className="text-[10px] uppercase text-zinc-500">Minimum</div>
                <div className="mt-1 text-xs font-extrabold text-[#F5B731]">No Min</div>
              </div>
            </div>
          </div>
        </section>

        {/* 9. FAQ Accordion */}
        <section className="max-w-3xl mx-auto space-y-5">
          <div className="text-center">
            <h2 className="font-display text-2xl font-extrabold text-white sm:text-3xl">
              Frequently Asked Questions
            </h2>
            <p className="mt-1.5 text-xs text-zinc-400">
              Everything you need to know before placing your first prediction or spin.
            </p>
          </div>

          <div className="space-y-2.5">
            {FAQS.map((item, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={item.q}
                  className="overflow-hidden rounded-2xl border border-white/10 bg-[#0D0B18]/90"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
                  >
                    <span className="font-display text-sm font-bold text-white">
                      {item.q}
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-zinc-400 transition-transform ${
                        isOpen ? 'rotate-180 text-[#00E599]' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="border-t border-white/[0.06] px-5 pb-4 pt-3 text-xs leading-relaxed text-zinc-300">
                      {item.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* 10. Final CTA Band & Footer */}
        <section className="rounded-3xl border border-white/12 bg-gradient-to-br from-[#00E599]/15 via-[#0E0B1D] to-[#F5B731]/15 p-7 sm:p-10 text-center">
          <h2 className="font-display text-2xl font-black text-white sm:text-4xl">
            Ready to Make Your Call?
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-xs text-zinc-300 sm:text-sm">
            Create your PULSE account or jump straight into live markets and 10 provably-fair Originals games.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            {!isLoggedIn && (
              <button
                onClick={onSignUp}
                className="btn-glow flex items-center gap-2 rounded-2xl bg-[#00E599] px-7 py-3.5 font-display text-sm font-black text-[#040507] transition hover:brightness-110"
              >
                <UserPlus className="h-4 w-4" />
                <span>Create Free Account</span>
              </button>
            )}
            <button
              onClick={() => onEnterApp('arena')}
              className="flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-6 py-3.5 font-display text-sm font-bold text-white transition hover:bg-white/15"
            >
              <span>Enter PULSE Exchange</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>

        <footer className="border-t border-white/[0.08] pt-8 pb-10 flex flex-col items-center justify-between gap-4 text-xs text-zinc-500 sm:flex-row">
          <div>
            <span className="font-display font-bold text-zinc-300">© PULSE Exchange</span>
            <span className="mx-2">·</span>
            <span>18+ only · Play responsibly</span>
          </div>
          <div className="flex flex-wrap items-center gap-4 font-semibold">
            <button
              type="button"
              onClick={() => onEnterApp('arena')}
              className="text-zinc-400 transition hover:text-[#00E599]"
            >
              Arena
            </button>
            <button
              type="button"
              onClick={() => onEnterApp('originals')}
              className="text-zinc-400 transition hover:text-[#00E599]"
            >
              Originals
            </button>
            <button
              type="button"
              onClick={() => onEnterApp('leaderboard')}
              className="text-zinc-400 transition hover:text-[#00E599]"
            >
              Leaderboard
            </button>
            <button
              type="button"
              onClick={() => onEnterApp('master_wallet')}
              className="text-zinc-400 transition hover:text-[#F5B731]"
            >
              Master Vault
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};
