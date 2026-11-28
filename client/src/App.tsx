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
  OriginalGameId,
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
import {
  fetchTimeframeCandles,
  getCachedTimeframeCandles,
  patchCandlesWithLiveTick,
} from './utils/marketKlines';
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
import { AuthModal, AuthModalMode } from './components/AuthModal';
import { LandingPage } from './components/LandingPage';
import { LiveWinsTicker } from './components/LiveWinsTicker';
import { MobileTabBar } from './components/MobileTabBar';
import { BENTO_GAMES, BentoArtwork } from './components/originals/BentoGameCards';
import { ToastStack } from './components/ToastStack';
import { getStandaloneRuntime, isStandaloneMode } from './standalone/liveRuntime';

const STANDALONE = isStandaloneMode();
if (STANDALONE) {
  getStandaloneRuntime();
}

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

const VALID_GAMES: OriginalGameId[] = [
  'lobby',
  'blackjack',
  'crash',
  'pump',
  'mines',
  'plinko',
  'dice',
  'limbo',
  'keno',
  'tower',
  'wheel',
];

function parseUrlRoute(pathname: string): {
  isLanding: boolean;
  tab: AppTab;
  game: OriginalGameId;
} {
  const clean = pathname.replace(/\/+$/, '') || '/';
  if (clean === '/' || clean === '/home') {
    return { isLanding: true, tab: 'arena', game: 'lobby' };
  }
  if (clean === '/markets' || clean === '/arena') {
    return { isLanding: false, tab: 'arena', game: 'lobby' };
  }
  if (clean === '/vault' || clean === '/master-vault') {
    return { isLanding: false, tab: 'master_wallet', game: 'lobby' };
  }
  if (clean === '/leaderboard' || clean === '/ranks') {
    return { isLanding: false, tab: 'leaderboard', game: 'lobby' };
  }
  if (clean === '/originals' || clean.startsWith('/originals/')) {
    const seg = clean.split('/')[2] as OriginalGameId | undefined;
    const game = seg && VALID_GAMES.includes(seg) ? seg : 'lobby';
    return { isLanding: false, tab: 'originals', game };
  }
  return { isLanding: true, tab: 'arena', game: 'lobby' };
}

function tabToPath(tab: AppTab, game?: OriginalGameId): string {
  if (tab === 'arena') return '/markets';
  if (tab === 'master_wallet') return '/vault';
  if (tab === 'leaderboard') return '/leaderboard';
  return game && game !== 'lobby' ? `/originals/${game}` : '/originals';
}

export default function App() {
  const initialRoute = useMemo(() => parseUrlRoute(window.location.pathname), []);
  const [activeTab, setActiveTab] = useState<AppTab>(initialRoute.tab);
  const [connected, setConnected] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('pulse_theme_v3');
    return saved === 'dark' ? 'dark' : 'light';
  });
  const [authChecked, setAuthChecked] = useState(false);
  const [showLanding, setShowLanding] = useState(initialRoute.isLanding);
  const [activeOriginalGame, setActiveOriginalGame] = useState<OriginalGameId>(
    initialRoute.game
  );

  const [tickers, setTickers] = useState<MarketTicker[]>([]);
  const [timeframes, setTimeframes] = useState<TimeframeOption[]>(DEFAULT_TIMEFRAMES);
  const [tiers, setTiers] = useState<StakeTier[]>(DEFAULT_TIERS);

  const [selectedSymbol, setSelectedSymbol] = useState<string>('BTC/USDT');
  const [selectedTimeframe, setSelectedTimeframe] = useState<TimeframeId>('1m');
  const [selectedTierCents, setSelectedTierCents] = useState<number>(1000);
  const [chartMode, setChartMode] = useState<ChartMode>('candles');

  const [chartSeries, setChartSeries] = useState<{
    symbol: string;
    timeframe: TimeframeId;
    candles: CandlePoint[];
    source: 'binance' | 'synthetic';
    version: number;
  }>({
    symbol: 'BTC/USDT',
    timeframe: '1m',
    candles: [],
    source: 'synthetic',
    version: 0,
  });
  const [chartLoading, setChartLoading] = useState<boolean>(false);
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
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<AuthModalMode>('login');
  const [cashierOpen, setCashierOpen] = useState(false);
  const [cashierTab, setCashierTab] = useState<'deposit' | 'withdraw' | 'history'>('deposit');
  const [placingBet, setPlacingBet] = useState(false);
  const [topUpBusy, setTopUpBusy] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const clockOffsetRef = useRef<number>(0);
  const lastPriceRef = useRef<number | null>(null);

  const landingVisible = showLanding;

  // Keep state synced with Browser Back/Forward navigation
  useEffect(() => {
    const onPopState = () => {
      const next = parseUrlRoute(window.location.pathname);
      setShowLanding(next.isLanding);
      setActiveTab(next.tab);
      setActiveOriginalGame(next.game);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(theme);
    localStorage.setItem('pulse_theme_v3', theme);
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', theme === 'dark' ? '#0B0D11' : '#F8F9FB');
  }, [theme]);

  const socketRef = useRef<Socket | null>(null);
  const selectedSymbolRef = useRef<string>(selectedSymbol);
  const selectedTimeframeRef = useRef<TimeframeId>(selectedTimeframe);
  const tickersRef = useRef<MarketTicker[]>(tickers);
  const chartFetchSeqRef = useRef<number>(0);
  const userRef = useRef<UserProfile | null>(user);

  useEffect(() => {
    selectedSymbolRef.current = selectedSymbol;
    lastPriceRef.current = null;
  }, [selectedSymbol]);

  useEffect(() => {
    selectedTimeframeRef.current = selectedTimeframe;
  }, [selectedTimeframe]);

  useEffect(() => {
    tickersRef.current = tickers;
  }, [tickers]);

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

  const openAuthModal = useCallback((mode: AuthModalMode = 'login') => {
    setAuthModalMode(mode);
    setAuthModalOpen(true);
  }, []);

  const enterApp = useCallback((tab: AppTab = 'arena') => {
    const nextPath = tabToPath(tab, tab === 'originals' ? 'lobby' : undefined);
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, '', nextPath);
    }
    setShowLanding(false);
    setActiveTab(tab);
    if (tab === 'originals') setActiveOriginalGame('lobby');
    window.scrollTo(0, 0);
  }, []);

  const openOriginalGame = useCallback((game: OriginalGameId) => {
    const nextPath = tabToPath('originals', game);
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, '', nextPath);
    }
    setShowLanding(false);
    setActiveOriginalGame(game);
    setActiveTab('originals');
    window.scrollTo({ top: 0 });
  }, []);

  const openLanding = useCallback(() => {
    if (window.location.pathname !== '/') {
      window.history.pushState({}, '', '/');
    }
    setShowLanding(true);
    window.scrollTo(0, 0);
  }, []);

  const applyAuthenticatedSession = useCallback(
    (nextUser: UserProfile, token?: string) => {
      setUser(nextUser);
      if (token) {
        localStorage.setItem('pulse_auth_token', token);
      }
      localStorage.setItem('pulsepredict_user_id', nextUser.id);
      localStorage.setItem('pulsepredict_username', nextUser.username);
      if (window.location.pathname === '/' || window.location.pathname === '/home') {
        window.history.pushState({}, '', '/markets');
        setShowLanding(false);
        setActiveTab('arena');
      }
      socketRef.current?.emit('user:identify', { userId: nextUser.id });
      fetchUserBets(nextUser.id);
    },
    [fetchUserBets]
  );

  const handleSignUp = useCallback(
    async (payload: { username: string; email: string; password: string }) => {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Unable to create account');
      }
      applyAuthenticatedSession(data.user, data.token);
      pushToast(
        `Welcome to PULSE, ${data.user.username}!`,
        'Account created. Deposit USDT (BEP-20) anytime from the Cashier.',
        'emerald'
      );
    },
    [applyAuthenticatedSession, pushToast]
  );

  const handleSignIn = useCallback(
    async (payload: { identifier: string; password: string }) => {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Invalid credentials');
      }
      applyAuthenticatedSession(data.user, data.token);
      pushToast(
        `Signed in as ${data.user.username}`,
        `Wallet balance: ${formatUsd(data.user.balanceCents)}`,
        'sky'
      );
    },
    [applyAuthenticatedSession, pushToast]
  );

  const handleLogout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // ignore network errors on logout
    }
    localStorage.removeItem('pulse_auth_token');
    localStorage.removeItem('pulsepredict_user_id');
    localStorage.removeItem('pulsepredict_username');
    setUser(null);
    setUserBets([]);
    socketRef.current?.emit('user:identify', { userId: null });
    pushToast('Signed Out', 'Your session has been cleared.', 'sky');
  }, [pushToast]);

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

      // Restore real authenticated session only — never auto-create a demo guest account
      const savedToken = localStorage.getItem('pulse_auth_token');
      try {
        const headers: Record<string, string> = {};
        if (savedToken) headers.Authorization = `Bearer ${savedToken}`;
        const meRes = await fetch('/api/auth/me', {
          headers,
          credentials: 'include',
        });
        if (meRes.ok && active) {
          const meData = await meRes.json();
          if (meData.user) {
            setUser(meData.user);
            socketRef.current?.emit('user:identify', { userId: meData.user.id });
            fetchUserBets(meData.user.id);
            return;
          }
        } else if (meRes.status === 401) {
          localStorage.removeItem('pulse_auth_token');
          localStorage.removeItem('pulsepredict_user_id');
          localStorage.removeItem('pulsepredict_username');
        }
      } catch {
        // stay logged out until user signs in
      } finally {
        if (active) setAuthChecked(true);
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
  }, [fetchUserBets, fetchLeaderboardAndRounds]);

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

        setChartSeries((prev) => {
          if (
            prev.symbol !== match.symbol ||
            prev.timeframe !== selectedTimeframeRef.current ||
            prev.candles.length === 0
          ) {
            return prev;
          }
          // Do not overwrite real Binance klines with fallback simulated ticks
          if (prev.source === 'binance' && match.source !== 'binance_live') {
            return prev;
          }
          const updated = patchCandlesWithLiveTick(
            prev.candles,
            serverTime,
            match.price,
            prev.timeframe,
            match.decimals
          );
          if (updated === prev.candles) return prev;
          return { ...prev, candles: updated };
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
        const roomRes = await fetch(
          `/api/room?symbol=${encodeURIComponent(
            selectedSymbol
          )}&timeframe=${encodeURIComponent(
            selectedTimeframe
          )}&tierCents=${selectedTierCents}`
        );
        if (!cancelled && roomRes.ok) {
          setRoomSnapshot(await roomRes.json());
        }
      } catch {
        // handled via socket
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedSymbol, selectedTimeframe, selectedTierCents, connected]);

  const hasTickers = tickers.length > 0;
  const loadedKeyRef = useRef<string>('');

  // Dedicated per-timeframe historical klines loader (independent of stake tier changes!)
  useEffect(() => {
    const ticker = tickersRef.current.find((t) => t.symbol === selectedSymbol) ?? null;
    const isKnownCrypto = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT', 'XRP/USDT'].includes(
      selectedSymbol
    );
    // Wait for bootstrap ticker price before synthesizing commodity candles
    if (!isKnownCrypto && (!hasTickers || !ticker)) return;

    const targetKey = `${selectedSymbol}|${selectedTimeframe}`;
    if (loadedKeyRef.current === targetKey) return;

    const seq = ++chartFetchSeqRef.current;
    const controller = new AbortController();

    const cached = getCachedTimeframeCandles(selectedSymbol, selectedTimeframe);
    if (cached && cached.length >= 2) {
      const shouldPatch =
        ticker &&
        ticker.price > 0 &&
        (!isKnownCrypto || ticker.source === 'binance_live');
      const patched = shouldPatch
        ? patchCandlesWithLiveTick(
            cached,
            Date.now(),
            ticker.price,
            selectedTimeframe,
            ticker.decimals
          )
        : cached;
      loadedKeyRef.current = targetKey;
      setChartLoading(false);
      setChartSeries((prev) => ({
        symbol: selectedSymbol,
        timeframe: selectedTimeframe,
        candles: patched,
        source: isKnownCrypto ? 'binance' : 'synthetic',
        version: prev.version + 1,
      }));
      return () => {
        controller.abort();
      };
    }

    setChartLoading(true);
    fetchTimeframeCandles({
      symbol: selectedSymbol,
      binanceSymbol: ticker?.binanceSymbol,
      timeframe: selectedTimeframe,
      currentPrice: ticker?.price ?? 0,
      decimals: ticker?.decimals ?? (selectedSymbol === 'XRP/USDT' ? 4 : 2),
      isLivePrice: ticker?.source === 'binance_live',
      signal: controller.signal,
    })
      .then((res) => {
        if (seq !== chartFetchSeqRef.current) return;
        loadedKeyRef.current = targetKey;
        setChartSeries((prev) => ({
          symbol: selectedSymbol,
          timeframe: selectedTimeframe,
          candles: res.candles,
          source: res.source,
          version: prev.version + 1,
        }));
      })
      .catch((err: any) => {
        if (err?.name === 'AbortError') return;
      })
      .finally(() => {
        if (seq === chartFetchSeqRef.current) {
          setChartLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [selectedSymbol, selectedTimeframe, hasTickers]);

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
      openAuthModal('login');
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

  if (!authChecked && !showLanding) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-base">
        <div className="flex flex-col items-center gap-3 animate-pulse">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent shadow-[0_0_32px_rgba(0,200,83,0.45)]">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="h-6 w-6 text-onaccent"
              stroke="currentColor"
              strokeWidth="2.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="22 12 18 12 15 20 9 4 6 12 2 12" />
            </svg>
          </div>
          <span className="font-display text-sm font-bold tracking-widest text-fg">
            PULSE EXCHANGE
          </span>
        </div>
      </div>
    );
  }

  if (landingVisible) {
    return (
      <>
        <LandingPage
          tickers={tickers}
          globalStats={globalStats}
          masterWallet={masterWallet}
          user={user}
          onSignUp={() => openAuthModal('signup')}
          onSignIn={() => openAuthModal('login')}
          onEnterApp={enterApp}
          onOpenGame={openOriginalGame}
          onOpenCashier={(tab) => {
            if (!user) {
              openAuthModal('signup');
              return;
            }
            setCashierTab(tab);
            setCashierOpen(true);
          }}
          theme={theme}
          onToggleTheme={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}
          isLoggedIn={Boolean(user)}
        />
        <AuthModal
          isOpen={authModalOpen}
          initialMode={authModalMode}
          onClose={() => setAuthModalOpen(false)}
          currentUser={user}
          onSignIn={handleSignIn}
          onSignUp={handleSignUp}
          onLogout={handleLogout}
          onOpenCashier={(tab) => {
            setCashierTab(tab);
            setCashierOpen(true);
          }}
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
      </>
    );
  }

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden flex flex-col bg-base pb-20 md:pb-0">
      <TopNav
        activeTab={activeTab}
        onTabChange={enterApp}
        connected={connected}
        globalStats={globalStats}
        masterWallet={masterWallet}
        user={user}
        onOpenAuthModal={openAuthModal}
        onOpenCashier={(tab) => {
          if (!user) {
            openAuthModal('login');
            return;
          }
          setCashierTab(tab);
          setCashierOpen(true);
        }}
        onOpenLanding={openLanding}
        onTopUp={handleTopUp}
        onToggleBots={handleToggleBots}
        topUpBusy={topUpBusy}
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}
      />

      <LiveWinsTicker
        originalsRecentBets={originalsRecentBets}
        globalRounds={globalRounds}
        lastSettled={roomSnapshot?.lastSettled ?? null}
      />

      {activeTab === 'arena' && (
        <div className="flex-1 flex flex-col">
          {/* Compact Horizontal Market Selector Strip */}
          <div className="2xl:hidden">
            <MarketRail
              tickers={tickers}
              selectedSymbol={selectedSymbol}
              onSelectSymbol={setSelectedSymbol}
              globalStats={globalStats}
            />
          </div>

          <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-4 px-3 py-4 sm:px-6 sm:py-6 xl:flex-row">
            {/* LEFT WATCHLIST RAIL (xl+) */}
            <div className="hidden 2xl:block">
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
              <div className="surface-card rounded-xl p-4">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                  {/* Left: Symbol + Big Price + 24h Telemetry */}
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{
                          backgroundColor: currentTicker?.accent ?? '#00C853',
                        }}
                      />
                      <h1 className="font-display text-lg font-bold tracking-tight text-fg">
                        {selectedSymbol}
                      </h1>
                      <span className="text-xs font-medium text-subtle">
                        {currentTicker?.name}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] font-bold uppercase ${
                          currentTicker?.source === 'binance_live'
                            ? 'bg-accent/12 text-accent'
                            : 'bg-gold/12 text-gold'
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
                        className={`font-mono text-3xl font-extrabold tracking-tight text-fg tabular-nums ${
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
                                ? 'text-accent'
                                : 'text-danger'
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
                          <span className="hidden md:inline font-mono text-[11px] text-subtle tabular-nums">
                            H ${formatPrice(currentTicker.high24h, decimals)} · L $
                            {formatPrice(currentTicker.low24h, decimals)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Right: Chart Mode Toggle + All 7 Timeframes */}
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center rounded-xl border border-fg/[0.07] bg-raised p-0.5">
                      <button
                        onClick={() => setChartMode('candles')}
                        title="Candlestick chart"
                        className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold transition ${
                          chartMode === 'candles'
                            ? 'bg-fg text-inverse'
                            : 'text-muted hover:text-fg'
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
                            ? 'bg-fg text-inverse'
                            : 'text-muted hover:text-fg'
                        }`}
                      >
                        <Activity className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Line</span>
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-0.5 rounded-xl border border-fg/[0.07] bg-raised p-0.5">
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
                                ? 'bg-accent text-onaccent shadow-[0_0_16px_rgba(0,200,83,0.3)]'
                                : 'text-muted hover:bg-fg/[0.05] hover:text-fg'
                            }`}
                          >
                            <span>{tf.shortLabel}</span>
                            {tfPlayers > 0 && (
                              <span
                                className={`rounded px-1 text-[9px] tabular-nums ${
                                  active
                                    ? 'bg-black/20 text-onaccent'
                                    : 'bg-fg/[0.07] text-accent'
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

                {/* Interactive TradingView Lightweight Charts Terminal */}
                <PriceChart
                  mode={chartMode}
                  candles={chartSeries.candles}
                  timeframe={chartSeries.timeframe}
                  datasetVersion={chartSeries.version}
                  loading={chartLoading}
                  liveRound={roomSnapshot?.liveRound ?? null}
                  openRound={roomSnapshot?.openRound ?? null}
                  currentPrice={livePrice}
                  decimals={decimals}
                  symbol={chartSeries.symbol}
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
            <aside className="w-full xl:w-[360px] shrink-0 space-y-4">
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
                    onOpenUserModal={() => openAuthModal('login')}
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

          {/* Option 3 Signature: Quick-Launch 4-Card Pastel Bento Originals Strip */}
          <div className="mx-auto w-full max-w-[1440px] px-3 pb-8 sm:px-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-sm font-bold text-fg">
                Instant Provably-Fair Originals
              </h2>
              <button
                onClick={() => openOriginalGame('lobby')}
                className="text-xs font-semibold text-info hover:underline"
              >
                All 10 Originals →
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {BENTO_GAMES.slice(0, 4).map((g) => (
                <button
                  key={g.id}
                  onClick={() => openOriginalGame(g.id)}
                  style={{
                    backgroundColor: theme === 'dark' ? g.darkBg : g.lightBg,
                    borderColor: theme === 'dark' ? g.darkBorder : g.lightBorder,
                  }}
                  className="bento-tile group flex items-center justify-between gap-2 rounded-2xl border p-4 text-left"
                >
                  <div>
                    <div className="font-display text-lg font-extrabold text-fg">
                      {g.name}
                    </div>
                    <div
                      className="mt-1 font-mono text-[11px] font-bold"
                      style={{ color: g.accent }}
                    >
                      Up to {g.maxMult}
                    </div>
                  </div>
                  <BentoArtwork
                    id={g.id}
                    className="h-14 w-14 sm:h-16 sm:w-16 shrink-0 transition-transform duration-200 group-hover:scale-105"
                  />
                </button>
              ))}
            </div>
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
          onOpenUserModal={() => openAuthModal('login')}
          activeGame={activeOriginalGame}
          onGameChange={openOriginalGame}
          theme={theme}
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

      <MobileTabBar
        activeTab={activeTab}
        onTabChange={enterApp}
        onOpenCasino={() => openOriginalGame('lobby')}
        onOpenWallet={() => {
          if (!user) {
            openAuthModal('signup');
            return;
          }
          setCashierTab('deposit');
          setCashierOpen(true);
        }}
      />

      <AuthModal
        isOpen={authModalOpen}
        initialMode={authModalMode}
        onClose={() => setAuthModalOpen(false)}
        currentUser={user}
        onSignIn={handleSignIn}
        onSignUp={handleSignUp}
        onLogout={handleLogout}
        onOpenCashier={(tab) => {
          setCashierTab(tab);
          setCashierOpen(true);
        }}
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
