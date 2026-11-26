export type MarketCategory = 'crypto' | 'commodity';
export type Direction = 'UP' | 'DOWN';
export type TimeframeId = '1m' | '5m' | '10m' | '15m' | '30m' | '1h' | '1d';
export type AppTab = 'arena' | 'originals' | 'master_wallet' | 'leaderboard';
export type OriginalGameId =
  | 'lobby'
  | 'blackjack'
  | 'crash'
  | 'pump'
  | 'mines'
  | 'plinko'
  | 'dice'
  | 'limbo'
  | 'keno'
  | 'tower'
  | 'wheel';
export type ChartMode = 'candles' | 'line';

export interface MarketTicker {
  symbol: string;
  name: string;
  shortName: string;
  category: MarketCategory;
  binanceSymbol: string | null;
  basePrice: number;
  decimals: number;
  unit: string;
  accent: string;
  price: number;
  prevPrice: number;
  open24h: number;
  high24h: number;
  low24h: number;
  changePercent: number;
  source: 'binance_live' | 'simulated';
  sparkline?: number[];
  updatedAt: number;
}

export interface TimeframeOption {
  id: TimeframeId;
  label: string;
  shortLabel: string;
  durationMs: number;
  entryCutoffMs: number;
}

export interface StakeTier {
  id: string;
  label: string;
  amountCents: number;
}

export interface PricePoint {
  time: number;
  price: number;
}

export interface CandlePoint {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface UserProfile {
  id: string;
  username: string;
  avatarColor: string;
  balanceCents: number;
  isBot: boolean;
  totalBets: number;
  totalWins: number;
  totalWageredCents: number;
  totalWonCents: number;
  netProfitCents: number;
  winRate: number;
  createdAt: number;
}

export interface RoundPlayer {
  betId: string;
  userId: string;
  username: string;
  avatarColor: string;
  isBot: boolean;
  direction: Direction;
  stakeCents: number;
  payoutCents?: number;
  status?: 'PENDING' | 'WON' | 'LOST' | 'REFUNDED';
  createdAt: number;
}

export interface ActiveRoundState {
  roundId: string;
  roundNumber: number;
  symbol: string;
  timeframe: TimeframeId;
  tierCents: number;
  status: 'LIVE' | 'OPEN';
  phase: 'LIVE' | 'OPEN' | 'LOCKED_CUTOFF';
  entriesOpen: boolean;
  entryCloseTime: number;
  entryCutoffMs: number;
  lockTime: number;
  closeTime: number;
  lockPrice: number | null;
  leadingSide: 'UP' | 'DOWN' | 'TIE';
  playerCount: number;
  upCount: number;
  downCount: number;
  totalPoolCents: number;
  masterFeeCents: number;
  distributablePoolCents: number;
  estUpPayoutCents: number;
  estDownPayoutCents: number;
  players: RoundPlayer[];
}

export interface SettledRound {
  roundId: string;
  roundNumber: number;
  symbol: string;
  category: MarketCategory;
  timeframe: TimeframeId;
  tierCents: number;
  lockTime: number;
  closeTime: number;
  lockPrice: number;
  closePrice: number;
  outcome: 'UP' | 'DOWN' | 'DRAW' | 'NO_WINNERS';
  playerCount: number;
  upCount: number;
  downCount: number;
  totalPoolCents: number;
  masterFeeCents: number;
  dustCents?: number;
  distributablePoolCents: number;
  winnerCount: number;
  payoutPerWinnerCents: number;
  txRef: string;
  settledAt: number;
  players: RoundPlayer[];
  winners: RoundPlayer[];
}

export interface RoomSnapshot {
  roomKey: string;
  symbol: string;
  category: MarketCategory;
  timeframe: TimeframeId;
  tierCents: number;
  serverTime: number;
  currentPrice: number;
  liveRound: ActiveRoundState;
  openRound: ActiveRoundState;
  lastSettled: SettledRound | null;
  recentRounds: SettledRound[];
}

export interface GlobalStats {
  onlineClients: number;
  livePlayersTotal: number;
  openPlayersTotal: number;
  totalPlayingNow: number;
  totalActivePoolCents: number;
  botsEnabled: boolean;
  byMarket: Record<string, number>;
  byMarketTimeframe: Record<string, Record<string, number>>;
  serverTime: number;
}

export interface MasterWalletLedgerItem {
  id: string;
  roundId: string;
  roundNumber: number;
  symbol: string;
  category: MarketCategory;
  timeframe: TimeframeId;
  tierCents: number;
  totalPoolCents: number;
  feeCents: number;
  dustCents: number;
  totalMasterCreditCents: number;
  distributableCents: number;
  winnerCount: number;
  payoutPerWinnerCents: number;
  txRef: string;
  createdAt: number;
}

export interface MasterWalletSummary {
  address: string;
  feeRatePercent: number;
  totalBalanceCents: number;
  combinedTreasuryCents?: number;
  totalFeeCents: number;
  totalDustCents: number;
  totalVolumeCents: number;
  totalDistributedCents: number;
  settledRoundsCount: number;
  byCategory: Array<{
    category: MarketCategory;
    roundsCount: number;
    volumeCents: number;
    feeCents: number;
  }>;
  byTimeframe: Array<{
    timeframe: TimeframeId;
    roundsCount: number;
    volumeCents: number;
    feeCents: number;
  }>;
  ledger: MasterWalletLedgerItem[];
  originals?: {
    totalWageredCents: number;
    totalPayoutCents: number;
    netHouseCents: number;
    totalBetsCount: number;
    byGame: Array<{
      game: string;
      betsCount: number;
      wageredCents: number;
      payoutCents: number;
      houseDeltaCents: number;
    }>;
    ledger: OriginalBetRecord[];
  };
}

export interface OriginalBetRecord {
  id: string;
  userId: string;
  username: string;
  avatarColor: string;
  isBot: boolean;
  game: string;
  stakeCents: number;
  multiplier: number;
  payoutCents: number;
  houseDeltaCents: number;
  status: 'WON' | 'LOST';
  details?: Record<string, unknown>;
  serverSeedHash?: string | null;
  clientSeed?: string | null;
  nonce?: number | null;
  createdAt: number;
}

export interface CrashPlayer {
  betId: string;
  userId: string;
  username: string;
  avatarColor: string;
  isBot: boolean;
  stakeCents: number;
  autoCashout: number | null;
  status: 'ACTIVE' | 'CASHED_OUT' | 'BUSTED';
  cashoutMultiplier: number | null;
  payoutCents: number;
}

export interface CrashState {
  roundNumber: number;
  phase: 'BETTING' | 'FLYING' | 'CRASHED';
  multiplier: number;
  phaseStartedAt: number;
  phaseEndsAt: number;
  serverTime: number;
  serverSeedHash: string;
  revealedServerSeed: string | null;
  crashPoint: number | null;
  history: number[];
  players: CrashPlayer[];
}

export interface FairnessState {
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
}

export interface UserBetRecord {
  betId: string;
  roundId: string;
  roundNumber: number;
  symbol: string;
  timeframe: TimeframeId;
  tierCents: number;
  direction: Direction;
  stakeCents: number;
  payoutCents: number;
  status: 'PENDING' | 'WON' | 'LOST' | 'REFUNDED';
  lockPrice: number | null;
  closePrice: number | null;
  outcome: string | null;
  totalPoolCents: number | null;
  masterFeeCents: number | null;
  winnerCount: number | null;
  createdAt: number;
  settledAt: number | null;
}

export interface ToastItem {
  id: string;
  title: string;
  subtitle?: string;
  tone: 'emerald' | 'rose' | 'amber' | 'sky';
}
