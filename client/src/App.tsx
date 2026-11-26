import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  Activity,
  CandlestickChart,
  Radio,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import {
  AppTab,
  CandlePoint,
  ChartMode,
  CrashState,
  Direction,
  GlobalStats,
  MarketTicker,
  MasterWalletSummary,
  OriginalBetRecord,
  PricePoint,
  RoomSnapshot,
  SettledRound,
  StakeTier,
  TimeframeId,
  TimeframeOption,
  ToastItem,
  UserBetRecord,
  UserProfile,
} from './types';
import { formatPrice, formatUsd } from './utils/format';
import { TopNav } from './components/TopNav';
import { MarketRail } from './components/MarketRail';
import { PriceChart } from './components/PriceChart';
import { LiveRoundBanner } from './components/LiveRoundBanner';
import { BetTicketPanel } from './components/BetTicketPanel';
import { PlayersPanel } from './components/PlayersPanel';
import { SettlementSpotlight } from './components/SettlementSpotlight';
import { RoundHistoryPanel } from './components/RoundHistoryPanel';
import { MasterWalletView } from './components/MasterWalletView';
import { LeaderboardView } from './components/LeaderboardView';
import { OriginalsHub } from './components/originals/OriginalsHub';
import { CashierModal } from './components/CashierModal';
import { UserModal } from './components/UserModal';
import { ToastStack } from './components/ToastStack';
import { getStandaloneRuntime, isStandaloneMode } from './standalone/liveRuntime';

const STANDALONE = isStandaloneMode();
if (STANDALONE) {
  getStandaloneRuntime();
}

const CANDLE_BUCKET_MS = 5_000;

const DEFAULT_TIMEFRAMES: TimeframeOption[] = [
  { id: '1m', label: '1 Min', shortLabel: '1m', durationMs: 60_000, entryCutoffMs: 15_000 },
  { id: '5m', label: '5 Min', shortLabel: '5m', durationMs: 300_000, entryCutoffMs: 30_000 },
  { id: '10m', label: '10 Min', shortLabel: '10m', durationMs: 600_000, entryCutoffMs: 45_000 },
  { id: '15m', label: '15 Min', shortLabel: '15m', durationMs: 900_000, entryCutoffMs: 60_000 },
  { id: '30m', label: '30 Min', shortLabel: '30m', durationMs: 1_800_000, entryCutoffMs: 90_000 },
  { id: '1h', label: '1 Hour', shortLabel: '1h', durationMs: 3_600_000, entryCutoffMs: 120_000 },
  { id: '1d', label: '1 Day', shortLabel: '1d', durationMs: 86_400_000, entryCutoffMs: 600_000 },
];

const DEFAULT_TIERS: StakeTier[] = [
  { id: 'tier_10', label: '$10', amountCents: 1000 },
  { id: 'tier_50', label: '$50', amountCents: 5000 },
  { id: 'tier_100', label: '$100', amountCents: 10000 },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('arena');
  const [connected, setConnected] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('pulse_theme');
    return saved === 'dark' ? 'dark' : 'light';
  });

  useEffect(() => {
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(theme);
    localStorage.setItem('pulse_theme', theme);
  }, [theme]);

  const [tickers, setTickers] = useState<MarketTicker[]>([]);
  const [timeframes, setTimeframes] = useState<TimeframeOption[]>(DEFAULT_TIMEFRAMES);
  const [tiers, setTiers] = useState<StakeTier[]>(DEFAULT_TIERS);

  const [selectedSymbol, setSelectedSymbol] = useState<string>('BTC/USDT');
  const [selectedTimeframe, setSelectedTimeframe] = useState<TimeframeId>('1m');
  const [selectedTierCents, setSelectedTierCents] = useState<number>(1000);
  const [chartMode, setChartMode] = useState<ChartMode>('candles');

  const [priceHistory, setPriceHistory] = useState<PricePoint[]>([]);
  const [candles, setCandles] = useState<CandlePoint[]>([]);
  const [priceFlash, setPriceFlash] = useState<'up' | 'down' | null>(null);
  const [roomSnapshot, setRoomSnapshot] = useState<RoomSnapshot | null>(null);
  const [globalStats, setGlobalStats] = useState<GlobalStats | null>(null);
  const [masterWallet, setMasterWallet] = useState<MasterWalletSummary | null>(null);
  const [leaderboard, setLeaderboard] = useState<UserProfile[]>([]);
  const [globalRounds, setGlobalRounds] = useState<SettledRound[]>([]);
  const [crashState, setCrashState] = useState<CrashState | null>(null);
  const [originalsRecentBets, setOriginalsRecentBets] = useState<OriginalBetRecord[]>([]);

  const [user, setUser] = useState<UserProfile | null>(null);
  const [userBets, setUserBets] = useState<UserBetRecord[]>([]);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [cashierOpen, setCashierOpen] = useState(false);
  const [cashierTab, setCashierTab] = useState<'deposit' | 'withdraw' | 'history'>('deposit');
  const [placingBet, setPlacingBet] = useState(false);
  const [topUpBusy, setTopUpBusy] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const clockOffsetRef = useRef<number>(0);
  const lastPriceRef = useRef<number | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const selectedSymbolRef = useRef<string>(selectedSymbol);
  const userRef = useRef<UserProfile | null>(user);

  useEffect(() => {
    selectedSymbolRef.current = selectedSymbol;
    lastPriceRef.current = null;
  }, [selectedSymbol]);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const pushToast = useCallback(
    (title: string, subtitle: string | undefined, tone: ToastItem['tone']) => {
      const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev.slice(-3), { id, title, subtitle, tone }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4800);
    },
    []
  );

  const fetchUserBets = useCallback(async (userId: string) => {
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(userId)}/bets`);
      if (!res.ok) return;
      const data = await res.json();
      setUserBets(data.bets || []);
    } catch {
      // ignore
    }
  }, []);

  const fetchLeaderboardAndRounds = useCallback(async () => {
    try {
      const [lbRes, rRes] = await Promise.all([
        fetch('/api/leaderboard'),
        fetch('/api/rounds/recent?limit=30'),
      ]);
      if (lbRes.ok) {
        const d = await lbRes.json();
        setLeaderboard(d.leaderboard || []);
      }
      if (rRes.ok) {
        const d = await rRes.json();
        setGlobalRounds(d.rounds || []);
      }
    } catch {
      // ignore
    }
  }, []);

  const loginUsername = useCallback(
    async (rawUsername: string, silent = false) => {
      const res = await fetch('/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: rawUsername }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to sign in');
      }
      setUser(data.user);
      localStorage.setItem('pulsepredict_user_id', data.user.id);
      localStorage.setItem('pulsepredict_username', data.user.username);
      socketRef.current?.emit('user:identify', { userId: data.user.id });
      fetchUserBets(data.user.id);
      if (!silent) {
        pushToast(
          `Connected as ${data.user.username}`,
          `Wallet balance: ${formatUsd(data.user.balanceCents)}`,
          'sky'
        );
      }
    },
    [fetchUserBets, pushToast]
  );

  useEffect(() => {
    const id = setInterval(() => {
      setNowMs(Date.now() + clockOffsetRef.current);
    }, 200);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/bootstrap');
        if (!res.ok || !active) return;
        const data = await res.json();
        setTickers(data.tickers || []);
        if (data.timeframes?.length) setTimeframes(data.timeframes);
        if (data.tiers?.length) setTiers(data.tiers);
        setGlobalStats(data.globalStats || null);
        setMasterWallet(data.masterWallet || null);
        if (data.globalStats?.serverTime) {
          clockOffsetRef.current = data.globalStats.serverTime - Date.now();
        }
      } catch {
        // retry via socket
      }

      const savedId = localStorage.getItem('pulsepredict_user_id');
      if (savedId) {
        try {
          const uRes = await fetch(`/api/users/${encodeURIComponent(savedId)}`);
          if (uRes.ok && active) {
            const uData = await uRes.json();
            setUser(uData.user);
            socketRef.current?.emit('user:identify', { userId: uData.user.id });
            fetchUserBets(uData.user.id);
            return;
          }
        } catch {
          // fallback
        }
      }

      const guestHandle = `Trader${Math.floor(1000 + Math.random() * 9000)}`;
      try {
        if (active) await loginUsername(guestHandle, true);
      } catch {
        // user can sign in manually
      }
    })();

    fetchLeaderboardAndRounds();
    fetch('/api/originals/config')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!active || !d) return;
        if (d.crash) setCrashState(d.crash);
        if (Array.isArray(d.recentBets)) setOriginalsRecentBets(d.recentBets);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [fetchUserBets, fetchLeaderboardAndRounds, loginUsername]);

  useEffect(() => {
    const handleTicks = ({
      serverTime,
      tickers: nextTickers,
    }: {
      serverTime: number;
      tickers: MarketTicker[];
    }) => {
      clockOffsetRef.current = serverTime - Date.now();
      setTickers(nextTickers);

      const activeSym = selectedSymbolRef.current;
      const match = nextTickers.find((t) => t.symbol === activeSym);
      if (match) {
        if (lastPriceRef.current != null && match.price !== lastPriceRef.current) {
          setPriceFlash(match.price > lastPriceRef.current ? 'up' : 'down');
          setTimeout(() => setPriceFlash(null), 550);
        }
        lastPriceRef.current = match.price;

        setPriceHistory((prev) => {
          const next = [...prev, { time: serverTime, price: match.price }];
          return next.length > 220 ? next.slice(-220) : next;
        });

        setCandles((prev) => {
          const bucket = Math.floor(serverTime / CANDLE_BUCKET_MS) * CANDLE_BUCKET_MS;
          if (prev.length === 0) {
            return [
              {
                time: bucket,
                open: match.price,
                high: match.price,
                low: match.price,
                close: match.price,
                volume: 15,
              },
            ];
          }
          const next = [...prev];
          const last = { ...next[next.length - 1] };
          if (bucket > last.time) {
            next.push({
              time: bucket,
              open: last.close,
              high: Math.max(last.close, match.price),
              low: Math.min(last.close, match.price),
              close: match.price,
              volume: 18,
            });
            return next.length > 64 ? next.slice(-64) : next;
          }
          last.close = match.price;
          if (match.price > last.high) last.high = match.price;
          if (match.price < last.low) last.low = match.price;
          last.volume += 4;
          next[next.length - 1] = last;
          return next;
        });
      }
    };

    const handleRoomState = (snapshot: RoomSnapshot) => {
      if (snapshot.serverTime) {
        clockOffsetRef.current = snapshot.serverTime - Date.now();
      }
      setRoomSnapshot(snapshot);
    };

    const handleSettled = (settlement: SettledRound) => {
      const me = userRef.current;
      const myResult = me
        ? settlement.players.find((p) => p.userId === me.id)
        : null;

      if (myResult && myResult.status === 'WON') {
        pushToast(
          `YOU WON ${formatUsd(myResult.payoutCents ?? settlement.payoutPerWinnerCents)}!`,
          `${settlement.symbol} ${settlement.timeframe} #${settlement.roundNumber} (${settlement.outcome}) · Split equally among ${settlement.winnerCount} winners`,
          'emerald'
        );
      } else if (myResult && myResult.status === 'LOST') {
        pushToast(
          `Candle #${settlement.roundNumber} Settled — ${settlement.outcome} Won`,
          `10% (${formatUsd(settlement.masterFeeCents)}) routed to Master Vault · ${settlement.winnerCount} winners split ${formatUsd(settlement.distributablePoolCents)}`,
          'rose'
        );
      } else if (settlement.winnerCount > 0) {
        pushToast(
          `${settlement.symbol} #${settlement.roundNumber}: ${settlement.outcome} Won`,
          `${settlement.winnerCount} winners earned ${formatUsd(settlement.payoutPerWinnerCents)} ea · Vault +${formatUsd(settlement.masterFeeCents)}`,
          'amber'
        );
      }

      if (me) fetchUserBets(me.id);
      fetchLeaderboardAndRounds();
    };

    const handleCrashTick = (tick: {
      roundNumber: number;
      phase: CrashState['phase'];
      multiplier: number;
      players: CrashState['players'];
    }) => {
      setCrashState((prev) =>
        prev && prev.roundNumber === tick.roundNumber
          ? { ...prev, phase: tick.phase, multiplier: tick.multiplier, players: tick.players }
          : prev
      );
    };

    const handleOrigBet = (record: OriginalBetRecord) => {
      setOriginalsRecentBets((prev) => [record, ...prev].slice(0, 25));
    };

    const handleUserUpdated = (updatedUser: UserProfile) => {
      setUser(updatedUser);
      fetchUserBets(updatedUser.id);
    };

    if (STANDALONE) {
      const rt = getStandaloneRuntime();
      setConnected(true);
      rt.on('market:ticks', handleTicks);
      rt.on('room:state', handleRoomState);
      rt.on('global:stats', setGlobalStats);
      rt.on('master_wallet:update', setMasterWallet);
      rt.on('crash:state', setCrashState);
      rt.on('crash:tick', handleCrashTick);
      rt.on('originals:bet', handleOrigBet);
      rt.on('user:updated', handleUserUpdated);
      rt.on('round:settled', handleSettled);
      return () => {
        rt.off('market:ticks', handleTicks);
        rt.off('room:state', handleRoomState);
        rt.off('global:stats', setGlobalStats);
        rt.off('master_wallet:update', setMasterWallet);
        rt.off('crash:state', setCrashState);
        rt.off('crash:tick', handleCrashTick);
        rt.off('originals:bet', handleOrigBet);
        rt.off('user:updated', handleUserUpdated);
        rt.off('round:settled', handleSettled);
      };
    }

    const socket = io('/', {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: Infinity,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      if (userRef.current) {
        socket.emit('user:identify', { userId: userRef.current.id });
      }
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('market:ticks', handleTicks);
    socket.on(
      'market:history',
      ({
        symbol,
        points,
        candles: histCandles,
      }: {
        symbol: string;
        points: PricePoint[];
        candles?: CandlePoint[];
      }) => {
        if (symbol === selectedSymbolRef.current) {
          setPriceHistory(points || []);
          if (histCandles) setCandles(histCandles);
        }
      }
    );
    socket.on('room:state', handleRoomState);
    socket.on('global:stats', setGlobalStats);
    socket.on('master_wallet:update', setMasterWallet);
    socket.on('crash:state', (snap: CrashState) => {
      if (snap.serverTime) {
        clockOffsetRef.current = snap.serverTime - Date.now();
      }
      setCrashState(snap);
    });
    socket.on('crash:tick', handleCrashTick);
    socket.on('originals:bet', handleOrigBet);
    socket.on('user:updated', handleUserUpdated);
    socket.on('round:settled', handleSettled);

    return () => {
      socket.disconnect();
    };
  }, [fetchUserBets, fetchLeaderboardAndRounds, pushToast]);

  useEffect(() => {
    const socket = socketRef.current;
    if (socket) {
      socket.emit('room:subscribe', {
        symbol: selectedSymbol,
        timeframe: selectedTimeframe,
        tierCents: selectedTierCents,
      });
    }

    let cancelled = false;
    (async () => {
      try {
        const [roomRes, histRes] = await Promise.all([
          fetch(
            `/api/room?symbol=${encodeURIComponent(
              selectedSymbol
            )}&timeframe=${encodeURIComponent(
              selectedTimeframe
            )}&tierCents=${selectedTierCents}`
          ),
          fetch(`/api/markets/${encodeURIComponent(selectedSymbol)}/history`),
        ]);
        if (!cancelled && roomRes.ok) {
          setRoomSnapshot(await roomRes.json());
        }
        if (!cancelled && histRes.ok) {
          const h = await histRes.json();
          setPriceHistory(h.points || []);
          if (h.candles) setCandles(h.candles);
        }
      } catch {
        // handled via socket
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedSymbol, selectedTimeframe, selectedTierCents, connected]);

  useEffect(() => {
    if (activeTab === 'leaderboard') {
      fetchLeaderboardAndRounds();
    }
  }, [activeTab, fetchLeaderboardAndRounds]);

  const currentTicker = useMemo(
    () => tickers.find((t) => t.symbol === selectedSymbol) || tickers[0] || null,
    [tickers, selectedSymbol]
  );

  const currentTimeframeObj = useMemo(
    () => timeframes.find((t) => t.id === selectedTimeframe) || timeframes[0],
    [timeframes, selectedTimeframe]
  );

  const handlePlaceBet = async (direction: Direction) => {
    if (!user) {
      setUserModalOpen(true);
      return;
    }
    setPlacingBet(true);
    try {
      const res = await fetch('/api/bets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          symbol: selectedSymbol,
          timeframe: selectedTimeframe,
          tierCents: selectedTierCents,
          direction,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        pushToast('Entry Rejected', data.error || 'Could not place prediction', 'amber');
        return;
      }
      setUser(data.user);
      setRoomSnapshot(data.room);
      fetchUserBets(user.id);
      pushToast(
        `Position Entered: ${direction} on ${selectedSymbol} (${selectedTimeframe})`,
        `Next Candle #${data.roundNumber} · Stake ${formatUsd(selectedTierCents)} locked`,
        direction === 'UP' ? 'emerald' : 'rose'
      );
    } catch {
      pushToast('Network Error', 'Unable to reach exchange engine', 'rose');
    } finally {
      setPlacingBet(false);
    }
  };

  const handleTopUp = async () => {
    if (!user) return;
    setTopUpBusy(true);
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(user.id)}/topup`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok && data.user) {
        setUser(data.user);
        pushToast(
          'Wallet Topped Up',
          `+${formatUsd(data.addedCents)} credited · Balance ${formatUsd(data.user.balanceCents)}`,
          'emerald'
        );
      }
    } finally {
      setTopUpBusy(false);
    }
  };

  const handleToggleBots = async () => {
    const next = !(globalStats?.botsEnabled ?? true);
    try {
      const res = await fetch('/api/settings/bots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: next }),
      });
      if (res.ok) {
        pushToast(
          next ? 'Demo Traders Enabled' : 'Demo Traders Paused',
          next
            ? 'Simulated traders now join open windows alongside real players.'
            : 'Only human players will enter upcoming rounds.',
          'sky'
        );
      }
    } catch {
      // ignore
    }
  };

  const livePrice = currentTicker?.price ?? roomSnapshot?.currentPrice ?? 0;
  const decimals = currentTicker?.decimals ?? 2;

  return (
    <div className="min-h-screen flex flex-col bg-[#040507]">
      <TopNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        connected={connected}
        globalStats={globalStats}
        masterWallet={masterWallet}
        user={user}
        onOpenUserModal={() => setUserModalOpen(true)}
        onOpenCashier={(tab) => {
          setCashierTab(tab);
          setCashierOpen(true);
        }}
        onTopUp={handleTopUp}
        onToggleBots={handleToggleBots}
        topUpBusy={topUpBusy}
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}
      />

      {activeTab === 'arena' && (
        <div className="flex-1 flex flex-col">
          {/* Responsive layout: Mobile Market Strip inside MarketRail + Desktop 3-Zone Exchange Grid */}
          <div className="xl:hidden">
            <MarketRail
              tickers={tickers}
              selectedSymbol={selectedSymbol}
              onSelectSymbol={setSelectedSymbol}
              globalStats={globalStats}
            />
          </div>

          <div className="mx-auto flex w-full max-w-[1680px] flex-1 flex-col gap-4 px-4 py-4 xl:flex-row lg:px-5">
            {/* LEFT WATCHLIST RAIL (xl+) */}
            <div className="hidden xl:block">
              <MarketRail
                tickers={tickers}
                selectedSymbol={selectedSymbol}
                onSelectSymbol={setSelectedSymbol}
                globalStats={globalStats}
              />
            </div>

            {/* CENTER HERO TERMINAL */}
            <main className="min-w-0 flex-1 space-y-3.5">
              {/* Instrument Command Bar + Hero Chart */}
              <div className="surface-card rounded-2xl p-4">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                  {/* Left: Symbol + Big Price + 24h Telemetry */}
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{
                          backgroundColor: currentTicker?.accent ?? '#00E599',
                        }}
                      />
                      <h1 className="font-display text-lg font-bold tracking-tight text-white">
                        {selectedSymbol}
                      </h1>
                      <span className="text-xs font-medium text-zinc-500">
                        {currentTicker?.name}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] font-bold uppercase ${
                          currentTicker?.source === 'binance_live'
                            ? 'bg-[#00E599]/12 text-[#00E599]'
                            : 'bg-[#F5B731]/12 text-[#F5B731]'
                        }`}
                      >
                        <Radio className="h-2.5 w-2.5" />
                        {currentTicker?.source === 'binance_live'
                          ? 'BINANCE LIVE'
                          : currentTicker?.category === 'commodity'
                          ? 'COMMODITY LIVE'
                          : 'LIVE SIM'}
                      </span>
                    </div>

                    <div className="mt-1 flex flex-wrap items-baseline gap-3">
                      <span
                        className={`font-mono text-3xl font-extrabold tracking-tight text-white tabular-nums ${
                          priceFlash === 'up'
                            ? 'flash-up'
                            : priceFlash === 'down'
                            ? 'flash-down'
                            : ''
                        }`}
                      >
                        ${formatPrice(livePrice, decimals)}
                      </span>
                      {currentTicker && (
                        <>
                          <span
                            className={`inline-flex items-center gap-1 font-mono text-xs font-bold tabular-nums ${
                              currentTicker.changePercent >= 0
                                ? 'text-[#00E599]'
                                : 'text-[#FF3B69]'
                            }`}
                          >
                            {currentTicker.changePercent >= 0 ? (
                              <TrendingUp className="h-3.5 w-3.5" />
                            ) : (
                              <TrendingDown className="h-3.5 w-3.5" />
                            )}
                            {currentTicker.changePercent >= 0 ? '+' : ''}
                            {currentTicker.changePercent.toFixed(2)}%
                          </span>
                          <span className="hidden md:inline font-mono text-[11px] text-zinc-500 tabular-nums">
                            H ${formatPrice(currentTicker.high24h, decimals)} · L $
                            {formatPrice(currentTicker.low24h, decimals)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Right: Chart Mode Toggle + All 7 Timeframes */}
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center rounded-xl border border-white/[0.07] bg-[#05070A] p-0.5">
                      <button
                        onClick={() => setChartMode('candles')}
                        title="Candlestick chart"
                        className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold transition ${
                          chartMode === 'candles'
                            ? 'bg-white text-[#040507]'
                            : 'text-zinc-400 hover:text-white'
                        }`}
                      >
                        <CandlestickChart className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Candles</span>
                      </button>
                      <button
                        onClick={() => setChartMode('line')}
                        title="Area line chart"
                        className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold transition ${
                          chartMode === 'line'
                            ? 'bg-white text-[#040507]'
                            : 'text-zinc-400 hover:text-white'
                        }`}
                      >
                        <Activity className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Line</span>
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-0.5 rounded-xl border border-white/[0.07] bg-[#05070A] p-0.5">
                      {timeframes.map((tf) => {
                        const active = tf.id === selectedTimeframe;
                        const tfPlayers =
                          globalStats?.byMarketTimeframe?.[selectedSymbol]?.[tf.id] ?? 0;
                        return (
                          <button
                            key={tf.id}
                            onClick={() => setSelectedTimeframe(tf.id)}
                            className={`flex items-center gap-1 rounded-lg px-2 py-1 font-mono text-[11px] font-bold transition ${
                              active
                                ? 'bg-[#00E599] text-[#040507] shadow-[0_0_16px_rgba(0,229,153,0.3)]'
                                : 'text-zinc-400 hover:bg-white/[0.05] hover:text-white'
                            }`}
                          >
                            <span>{tf.shortLabel}</span>
                            {tfPlayers > 0 && (
                              <span
                                className={`rounded px-1 text-[9px] tabular-nums ${
                                  active
                                    ? 'bg-black/20 text-[#040507]'
                                    : 'bg-white/[0.07] text-[#00E599]'
                                }`}
                              >
                                {tfPlayers}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Hero Candlestick / Area Chart with Floating Live HUD */}
                <PriceChart
                  mode={chartMode}
                  points={priceHistory}
                  candles={candles}
                  liveRound={roomSnapshot?.liveRound ?? null}
                  openRound={roomSnapshot?.openRound ?? null}
                  currentPrice={livePrice}
                  decimals={decimals}
                  symbol={selectedSymbol}
                  nowMs={nowMs}
                  durationMs={currentTimeframeObj.durationMs}
                  userId={user?.id}
                  theme={theme}
                />
              </div>

              {/* 4-Metric Live Pool Strip */}
              {roomSnapshot && (
                <LiveRoundBanner
                  liveRound={roomSnapshot.liveRound}
                  currentPrice={livePrice}
                  decimals={decimals}
                />
              )}

              {/* Just-Settled Winners Spotlight */}
              <SettlementSpotlight
                round={roomSnapshot?.lastSettled ?? null}
                decimals={decimals}
                userId={user?.id}
              />

              {/* Settled Rounds Audit & My Positions */}
              <RoundHistoryPanel
                recentRounds={roomSnapshot?.recentRounds ?? []}
                userBets={userBets}
                decimals={decimals}
                userId={user?.id}
              />
            </main>

            {/* RIGHT EXECUTION & LIVE ORDERFLOW SIDEBAR */}
            <aside className="w-full xl:w-[348px] shrink-0 space-y-3.5">
              {roomSnapshot && (
                <>
                  <BetTicketPanel
                    openRound={roomSnapshot.openRound}
                    timeframe={currentTimeframeObj}
                    tiers={tiers}
                    selectedTierCents={selectedTierCents}
                    onSelectTier={setSelectedTierCents}
                    user={user}
                    nowMs={nowMs}
                    placing={placingBet}
                    onPlaceBet={handlePlaceBet}
                    onOpenUserModal={() => setUserModalOpen(true)}
                  />

                  <PlayersPanel
                    liveRound={roomSnapshot.liveRound}
                    openRound={roomSnapshot.openRound}
                    lastSettled={roomSnapshot.lastSettled}
                    currentPrice={livePrice}
                    userId={user?.id}
                  />
                </>
              )}
            </aside>
          </div>
        </div>
      )}

      {activeTab === 'originals' && (
        <OriginalsHub
          user={user}
          crashState={crashState}
          recentBets={originalsRecentBets}
          nowMs={nowMs}
          onUserUpdated={setUser}
          onToast={pushToast}
          onOpenUserModal={() => setUserModalOpen(true)}
        />
      )}

      {activeTab === 'master_wallet' && (
        <MasterWalletView summary={masterWallet} />
      )}

      {activeTab === 'leaderboard' && (
        <LeaderboardView
          leaderboard={leaderboard}
          globalRounds={globalRounds}
          currentUserId={user?.id}
        />
      )}

      <UserModal
        isOpen={userModalOpen}
        onClose={() => setUserModalOpen(false)}
        currentUser={user}
        onLogin={loginUsername}
      />

      <CashierModal
        isOpen={cashierOpen}
        initialTab={cashierTab}
        onClose={() => setCashierOpen(false)}
        user={user}
        onUserUpdated={setUser}
        onToast={pushToast}
      />

      <ToastStack toasts={toasts} />
    </div>
  );
}
