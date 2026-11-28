import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Diamond,
  Dices,
  Disc3,
  Flame,
  Gamepad2,
  Grid,
  RefreshCw,
  Rocket,
  ShieldCheck,
  Spade,
  Sparkles,
  Wind,
  Zap,
} from 'lucide-react';
import {
  CrashState,
  FairnessState,
  OriginalBetRecord,
  OriginalGameId,
  ToastItem,
  UserProfile,
} from '../../types';
import { formatTimeShort, formatUsd } from '../../utils/format';
import { BENTO_GAMES, BentoArtwork } from './BentoGameCards';
import { BlackjackGame } from './BlackjackGame';
import { CrashGame } from './CrashGame';
import { PumpGame } from './PumpGame';
import { MinesGame } from './MinesGame';
import { PlinkoGame } from './PlinkoGame';
import { DiceGame } from './DiceGame';
import { LimboGame } from './LimboGame';
import { KenoGame } from './KenoGame';
import { TowerGame } from './TowerGame';
import { WheelGame } from './WheelGame';

interface OriginalsHubProps {
  user: UserProfile | null;
  crashState: CrashState | null;
  recentBets: OriginalBetRecord[];
  nowMs: number;
  onUserUpdated: (user: UserProfile) => void;
  onToast: (title: string, subtitle: string | undefined, tone: ToastItem['tone']) => void;
  onOpenUserModal: () => void;
  activeGame?: OriginalGameId;
  onGameChange?: (game: OriginalGameId) => void;
  theme?: 'light' | 'dark';
}

const GAMES: Array<{
  id: Exclude<OriginalGameId, 'lobby'>;
  name: string;
  badge: string;
  tagline: string;
  maxMult: string;
  gradient: string;
  accent: string;
  icon: React.ReactNode;
}> = [
  {
    id: 'blackjack',
    name: 'Blackjack',
    badge: '99.5% RTP · 3:2',
    tagline: 'Classic casino 21 with Hit, Stand, Double Down & Split pairs',
    maxMult: '2.50x',
    gradient: 'from-emerald-500/25 via-surface to-surface',
    accent: '#059669',
    icon: <Spade className="h-6 w-6 text-accent" />,
  },
  {
    id: 'crash',
    name: 'Crash',
    badge: 'LIVE MULTIPLAYER',
    tagline: 'Ride the rising rocket curve & cash out before detonation',
    maxMult: '10,000x',
    gradient: 'from-raised/25 via-surface to-surface',
    accent: '#00C853',
    icon: <Rocket className="h-6 w-6 text-accent" />,
  },
  {
    id: 'pump',
    name: 'Pump',
    badge: 'VIRAL HIT',
    tagline: 'Inflate the pressure balloon step by step — cash out before it pops',
    maxMult: '3,200,000x',
    gradient: 'from-danger/25 via-surface to-surface',
    accent: '#FF4E4E',
    icon: <Wind className="h-6 w-6 text-danger" />,
  },
  {
    id: 'mines',
    name: 'Mines',
    badge: 'CLASSIC 5×5',
    tagline: 'Uncover emerald gems on a 25-tile obsidian board while dodging bombs',
    maxMult: '5,148,297x',
    gradient: 'from-emerald-400/20 via-surface to-surface',
    accent: '#00C853',
    icon: <Diamond className="h-6 w-6 text-accent" />,
  },
  {
    id: 'plinko',
    name: 'Plinko',
    badge: '60FPS PHYSICS',
    tagline: 'Drop glowing balls through 8–16 peg rows into massive risk buckets',
    maxMult: '1,000x',
    gradient: 'from-gold/25 via-surface to-surface',
    accent: '#FFC800',
    icon: <Sparkles className="h-6 w-6 text-gold" />,
  },
  {
    id: 'dice',
    name: 'Dice',
    badge: 'INSTANT',
    tagline: 'Set custom Roll Over / Roll Under odds with precision slider control',
    maxMult: '49.50x',
    gradient: 'from-sky-400/25 via-surface to-surface',
    accent: '#38BDF8',
    icon: <Dices className="h-6 w-6 text-sky-400" />,
  },
  {
    id: 'limbo',
    name: 'Limbo',
    badge: 'HIGH ROLLER',
    tagline: 'Pick any target multiplier up to 1,000,000x for instant hyper-bursts',
    maxMult: '1,000,000x',
    gradient: 'from-amber-400/25 via-surface to-surface',
    accent: '#FFC800',
    icon: <Zap className="h-6 w-6 text-gold" />,
  },
  {
    id: 'keno',
    name: 'Keno',
    badge: '40 TILES',
    tagline: 'Select up to 10 lucky tiles and match the provably-fair 10-number draw',
    maxMult: '1,000x',
    gradient: 'from-teal-400/25 via-surface to-surface',
    accent: '#2DD4BF',
    icon: <Grid className="h-6 w-6 text-teal-400" />,
  },
  {
    id: 'tower',
    name: 'Dragon Tower',
    badge: '9 FLOORS',
    tagline: 'Ascend 9 volcanic tower levels across Easy, Medium, Hard & Expert',
    maxMult: '19,486x',
    gradient: 'from-orange-500/25 via-surface to-surface',
    accent: '#F97316',
    icon: <Flame className="h-6 w-6 text-orange-400" />,
  },
  {
    id: 'wheel',
    name: 'Wheel',
    badge: 'NEON SPIN',
    tagline: 'Spin the customizable 10–50 segment wheel across Low, Med & High risk',
    maxMult: '49.50x',
    gradient: 'from-purple-500/25 via-surface to-surface',
    accent: '#A855F7',
    icon: <Disc3 className="h-6 w-6 text-purple-400" />,
  },
];

export const OriginalsHub: React.FC<OriginalsHubProps> = ({
  user,
  crashState,
  recentBets,
  nowMs,
  onUserUpdated,
  onToast,
  onOpenUserModal,
  activeGame: controlledGame,
  onGameChange,
  theme = 'light',
}) => {
  const [internalGame, setInternalGame] = useState<OriginalGameId>('lobby');
  const activeGame = controlledGame ?? internalGame;
  const setActiveGame = (g: OriginalGameId) => {
    if (onGameChange) onGameChange(g);
    else setInternalGame(g);
    window.scrollTo({ top: 0 });
  };
  const [fairness, setFairness] = useState<FairnessState | null>(null);
  const [fairnessOpen, setFairnessOpen] = useState(false);
  const [clientSeedInput, setClientSeedInput] = useState('');
  const [rotating, setRotating] = useState(false);
  const [sessions, setSessions] = useState<{
    pump: any;
    mines: any;
    tower: any;
    blackjack: any;
  }>({ pump: null, mines: null, tower: null, blackjack: null });

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    fetch(`/api/originals/sessions/${encodeURIComponent(user.id)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) {
          if (d.sessions) setSessions(d.sessions);
          if (d.fairness) {
            setFairness(d.fairness);
            setClientSeedInput(d.fairness.clientSeed);
          }
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user?.id, activeGame]);

  const handleRotateSeed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setRotating(true);
    try {
      const res = await fetch('/api/originals/fairness/rotate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, clientSeed: clientSeedInput }),
      });
      const data = await res.json();
      if (!res.ok) {
        onToast('Fairness', data.error || 'Could not rotate seed', 'amber');
        return;
      }
      setFairness(data.current);
      setClientSeedInput(data.current.clientSeed);
      onToast(
        'Provably Fair Seed Rotated',
        `Previous server seed revealed: ${data.revealedPreviousServerSeed.slice(0, 16)}...`,
        'emerald'
      );
    } finally {
      setRotating(false);
    }
  };

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1680px] space-y-5 px-3 py-4 sm:px-4 sm:py-5 lg:px-6">
      {/* Top Originals Sub-Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="no-scrollbar flex w-full lg:w-auto lg:flex-1 min-w-0 items-center gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveGame('lobby')}
            className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold transition ${
              activeGame === 'lobby'
                ? 'bg-accent text-onaccent'
                : 'bg-surface text-fg2 hover:bg-raised hover:text-fg'
            }`}
          >
            {activeGame !== 'lobby' ? (
              <ArrowLeft className="h-3.5 w-3.5" />
            ) : (
              <Gamepad2 className="h-3.5 w-3.5" />
            )}
            {activeGame !== 'lobby' ? 'Lobby' : 'All Games (10)'}
          </button>

          {GAMES.map((g) => (
            <button
              key={g.id}
              onClick={() => setActiveGame(g.id)}
              className={`shrink-0 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                activeGame === g.id
                  ? 'bg-raised text-fg ring-1 ring-accent/60'
                  : 'bg-surface text-muted hover:bg-raised hover:text-fg'
              }`}
            >
              {g.name}
            </button>
          ))}
        </div>

        <button
          onClick={() => setFairnessOpen((o) => !o)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-surface px-3 py-2 text-xs font-bold text-accent transition hover:bg-raised"
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          Provably Fair
          {fairness && (
            <span className="font-mono text-[10px] text-fg2">
              #{fairness.nonce}
            </span>
          )}
        </button>
      </div>

      {/* Collapsible Provably Fair Inspector */}
      {fairnessOpen && fairness && (
        <form
          onSubmit={handleRotateSeed}
          className="surface-card rounded-xl p-4 grid grid-cols-1 gap-3 md:grid-cols-12 items-end"
        >
          <div className="md:col-span-5">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-subtle">
              Active Server Seed Hash (SHA-256)
            </label>
            <div className="mt-1 truncate rounded-xl border border-fg/[0.07] bg-raised px-3 py-2 font-mono text-xs text-accent">
              {fairness.serverSeedHash}
            </div>
          </div>
          <div className="md:col-span-4">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-subtle">
              Client Seed (Editable)
            </label>
            <input
              type="text"
              value={clientSeedInput}
              onChange={(e) => setClientSeedInput(e.target.value)}
              className="mt-1 w-full rounded-xl border border-fg/15 bg-raised px-3 py-2 font-mono text-xs text-fg outline-none focus:border-accent"
            />
          </div>
          <div className="md:col-span-1">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-subtle">
              Nonce
            </label>
            <div className="mt-1 rounded-xl border border-fg/[0.07] bg-raised px-3 py-2 font-mono text-xs font-bold text-fg text-center">
              {fairness.nonce}
            </div>
          </div>
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={rotating}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-fg py-2 text-xs font-bold text-inverse hover:opacity-90 disabled:opacity-50"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Rotate Seed
            </button>
          </div>
        </form>
      )}

      {/* Lobby View vs Active Game Stage */}
      {activeGame === 'lobby' ? (
        <div className="space-y-6">
          {/* Clean Editorial Fintech Originals Header */}
          <div className="surface-card rounded-2xl p-5 sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="min-w-0 max-w-2xl">
                <div className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-accent">
                  <Sparkles className="h-3 w-3 shrink-0" />
                  <span>99% RTP · Provably Fair (HMAC-SHA256)</span>
                </div>
                <h1 className="mt-3 font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-fg">
                  PULSE 10 Originals
                </h1>
                <p className="mt-1.5 text-sm text-muted">
                  Instant provably-fair games sharing your PULSE USDT wallet. Verify every seed &amp; nonce anytime.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setActiveGame('blackjack')}
                  className="btn-glow rounded-full bg-accent px-5 py-2.5 font-display text-sm font-bold text-onaccent transition hover:brightness-105"
                >
                  Play Blackjack
                </button>
                <button
                  onClick={() => setActiveGame('crash')}
                  className="rounded-full bg-fg px-5 py-2.5 font-display text-sm font-bold text-inverse transition hover:opacity-90"
                >
                  Crash Live
                </button>
              </div>
            </div>
          </div>

          {/* Crisp Pastel-Tinted Bento Game Grid (Option 3 Signature) */}
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
            {BENTO_GAMES.map((g) => (
              <button
                key={g.id}
                onClick={() => setActiveGame(g.id)}
                className="bento-tile group relative flex flex-col justify-between overflow-hidden rounded-2xl border p-4 text-left"
                style={{
                  backgroundColor: theme === 'dark' ? g.darkBg : g.lightBg,
                  borderColor: theme === 'dark' ? g.darkBorder : g.lightBorder,
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-display text-lg font-extrabold tracking-tight text-fg">
                      {g.name}
                    </h3>
                    <span
                      className="mt-1 inline-block rounded-full px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider"
                      style={{
                        backgroundColor: `${g.accent}1A`,
                        color: g.accent,
                      }}
                    >
                      {g.badge}
                    </span>
                  </div>
                  <BentoArtwork
                    id={g.id}
                    className="h-16 w-16 shrink-0 transition-transform duration-200 group-hover:scale-105"
                  />
                </div>

                <p className="mt-2.5 text-xs leading-relaxed text-fg2">
                  {g.tagline}
                </p>

                <div className="mt-3 flex items-center justify-between border-t border-fg/10 pt-2.5 font-mono text-[11px]">
                  <span className="text-muted">
                    Max <strong className="text-fg">{g.maxMult}</strong>
                  </span>
                  <span
                    className="font-display text-xs font-bold transition-transform group-hover:translate-x-0.5"
                    style={{ color: g.accent }}
                  >
                    Play →
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div>
          {activeGame === 'blackjack' && (
            <BlackjackGame
              user={user}
              initialSession={sessions.blackjack}
              onUserUpdated={onUserUpdated}
              onToast={onToast}
              onOpenUserModal={onOpenUserModal}
            />
          )}
          {activeGame === 'crash' && (
            <CrashGame
              crashState={crashState}
              user={user}
              nowMs={nowMs}
              onUserUpdated={onUserUpdated}
              onToast={onToast}
              onOpenUserModal={onOpenUserModal}
            />
          )}
          {activeGame === 'pump' && (
            <PumpGame
              user={user}
              initialSession={sessions.pump}
              onUserUpdated={onUserUpdated}
              onToast={onToast}
              onOpenUserModal={onOpenUserModal}
            />
          )}
          {activeGame === 'mines' && (
            <MinesGame
              user={user}
              initialSession={sessions.mines}
              onUserUpdated={onUserUpdated}
              onToast={onToast}
              onOpenUserModal={onOpenUserModal}
            />
          )}
          {activeGame === 'plinko' && (
            <PlinkoGame
              user={user}
              onUserUpdated={onUserUpdated}
              onToast={onToast}
              onOpenUserModal={onOpenUserModal}
            />
          )}
          {activeGame === 'dice' && (
            <DiceGame
              user={user}
              onUserUpdated={onUserUpdated}
              onToast={onToast}
              onOpenUserModal={onOpenUserModal}
            />
          )}
          {activeGame === 'limbo' && (
            <LimboGame
              user={user}
              onUserUpdated={onUserUpdated}
              onToast={onToast}
              onOpenUserModal={onOpenUserModal}
            />
          )}
          {activeGame === 'keno' && (
            <KenoGame
              user={user}
              onUserUpdated={onUserUpdated}
              onToast={onToast}
              onOpenUserModal={onOpenUserModal}
            />
          )}
          {activeGame === 'tower' && (
            <TowerGame
              user={user}
              initialSession={sessions.tower}
              onUserUpdated={onUserUpdated}
              onToast={onToast}
              onOpenUserModal={onOpenUserModal}
            />
          )}
          {activeGame === 'wheel' && (
            <WheelGame
              user={user}
              onUserUpdated={onUserUpdated}
              onToast={onToast}
              onOpenUserModal={onOpenUserModal}
            />
          )}
        </div>
      )}

      {/* Live Originals Recent Bets Feed */}
      <div className="surface-card rounded-xl p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-xs font-bold uppercase tracking-[0.12em] text-fg2">
            Live Originals Bets Feed
          </h2>
          <span className="font-mono text-[11px] text-subtle">
            Real-time provably-fair ledger
          </span>
        </div>

        {recentBets.length === 0 ? (
          <div className="rounded-xl border border-dashed border-fg/10 py-8 text-center text-xs text-subtle">
            Play any Original above to populate the live feed.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-fg/[0.06] text-[10px] font-semibold uppercase tracking-wider text-subtle">
                  <th className="py-2 pr-3">Game</th>
                  <th className="py-2 px-2">Player</th>
                  <th className="py-2 px-2 text-right">Bet</th>
                  <th className="py-2 px-2 text-right">Multiplier</th>
                  <th className="py-2 pl-2 text-right">Payout</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-fg/[0.04]">
                {recentBets.slice(0, 15).map((b) => (
                  <tr key={b.id} className="hover:bg-fg/[0.02]">
                    <td className="py-2 pr-3">
                      <span className="rounded bg-fg/[0.07] px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-fg">
                        {b.game}
                      </span>
                      <span className="ml-2 font-mono text-[10px] text-subtle">
                        {formatTimeShort(b.createdAt)}
                      </span>
                    </td>
                    <td className="py-2 px-2">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: b.avatarColor }}
                        />
                        <span className="font-semibold text-fg">
                          {b.username}
                        </span>
                      </div>
                    </td>
                    <td className="py-2 px-2 text-right font-mono text-fg2 tabular-nums">
                      {formatUsd(b.stakeCents)}
                    </td>
                    <td className="py-2 px-2 text-right font-mono font-bold tabular-nums">
                      <span
                        className={
                          b.multiplier >= 2
                            ? 'text-accent'
                            : b.multiplier > 0
                            ? 'text-fg'
                            : 'text-subtle'
                        }
                      >
                        {b.multiplier.toFixed(2)}x
                      </span>
                    </td>
                    <td
                      className={`py-2 pl-2 text-right font-mono font-bold tabular-nums ${
                        b.payoutCents >= b.stakeCents
                          ? 'text-accent'
                          : 'text-subtle'
                      }`}
                    >
                      {b.payoutCents > 0 ? `+${formatUsd(b.payoutCents)}` : '$0.00'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
