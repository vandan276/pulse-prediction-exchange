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
    gradient: 'from-emerald-500/25 via-[#071510] to-[#080A0E]',
    accent: '#059669',
    icon: <Spade className="h-6 w-6 text-[#00E599]" />,
  },
  {
    id: 'crash',
    name: 'Crash',
    badge: 'LIVE MULTIPLAYER',
    tagline: 'Ride the rising rocket curve & cash out before detonation',
    maxMult: '10,000x',
    gradient: 'from-[#00E599]/25 via-[#071510] to-[#080A0E]',
    accent: '#00E599',
    icon: <Rocket className="h-6 w-6 text-[#00E599]" />,
  },
  {
    id: 'pump',
    name: 'Pump',
    badge: 'VIRAL HIT',
    tagline: 'Inflate the pressure balloon step by step — cash out before it pops',
    maxMult: '3,200,000x',
    gradient: 'from-[#FF3B69]/25 via-[#18090E] to-[#080A0E]',
    accent: '#FF3B69',
    icon: <Wind className="h-6 w-6 text-[#FF3B69]" />,
  },
  {
    id: 'mines',
    name: 'Mines',
    badge: 'CLASSIC 5×5',
    tagline: 'Uncover emerald gems on a 25-tile obsidian board while dodging bombs',
    maxMult: '5,148,297x',
    gradient: 'from-emerald-400/20 via-[#081512] to-[#080A0E]',
    accent: '#00E599',
    icon: <Diamond className="h-6 w-6 text-[#00E599]" />,
  },
  {
    id: 'plinko',
    name: 'Plinko',
    badge: '60FPS PHYSICS',
    tagline: 'Drop glowing balls through 8–16 peg rows into massive risk buckets',
    maxMult: '1,000x',
    gradient: 'from-[#F5B731]/25 via-[#171207] to-[#080A0E]',
    accent: '#F5B731',
    icon: <Sparkles className="h-6 w-6 text-[#F5B731]" />,
  },
  {
    id: 'dice',
    name: 'Dice',
    badge: 'INSTANT',
    tagline: 'Set custom Roll Over / Roll Under odds with precision slider control',
    maxMult: '49.50x',
    gradient: 'from-sky-400/25 via-[#07131B] to-[#080A0E]',
    accent: '#38BDF8',
    icon: <Dices className="h-6 w-6 text-sky-400" />,
  },
  {
    id: 'limbo',
    name: 'Limbo',
    badge: 'HIGH ROLLER',
    tagline: 'Pick any target multiplier up to 1,000,000x for instant hyper-bursts',
    maxMult: '1,000,000x',
    gradient: 'from-amber-400/25 via-[#181006] to-[#080A0E]',
    accent: '#F5B731',
    icon: <Zap className="h-6 w-6 text-[#F5B731]" />,
  },
  {
    id: 'keno',
    name: 'Keno',
    badge: '40 TILES',
    tagline: 'Select up to 10 lucky tiles and match the provably-fair 10-number draw',
    maxMult: '1,000x',
    gradient: 'from-teal-400/25 via-[#071514] to-[#080A0E]',
    accent: '#2DD4BF',
    icon: <Grid className="h-6 w-6 text-teal-400" />,
  },
  {
    id: 'tower',
    name: 'Dragon Tower',
    badge: '9 FLOORS',
    tagline: 'Ascend 9 volcanic tower levels across Easy, Medium, Hard & Expert',
    maxMult: '19,486x',
    gradient: 'from-orange-500/25 via-[#180C06] to-[#080A0E]',
    accent: '#F97316',
    icon: <Flame className="h-6 w-6 text-orange-400" />,
  },
  {
    id: 'wheel',
    name: 'Wheel',
    badge: 'NEON SPIN',
    tagline: 'Spin the customizable 10–50 segment wheel across Low, Med & High risk',
    maxMult: '49.50x',
    gradient: 'from-purple-500/25 via-[#130A1C] to-[#080A0E]',
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
}) => {
  const [activeGame, setActiveGame] = useState<OriginalGameId>('lobby');
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
    <div className="mx-auto max-w-[1680px] space-y-5 px-4 py-5 lg:px-6">
      {/* Top Originals Sub-Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveGame('lobby')}
            className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-bold transition ${
              activeGame === 'lobby'
                ? 'border-white bg-white text-[#040507]'
                : 'border-white/[0.08] bg-[#0B0E14] text-zinc-300 hover:border-white/20 hover:text-white'
            }`}
          >
            {activeGame !== 'lobby' ? (
              <ArrowLeft className="h-3.5 w-3.5" />
            ) : (
              <Gamepad2 className="h-3.5 w-3.5" />
            )}
            All Originals (10)
          </button>

          {GAMES.map((g) => (
            <button
              key={g.id}
              onClick={() => setActiveGame(g.id)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                activeGame === g.id
                  ? 'border-[#00E599] bg-[#00E599]/15 text-[#00E599]'
                  : 'border-white/[0.07] bg-[#090B0F] text-zinc-400 hover:border-white/20 hover:text-white'
              }`}
            >
              {g.name}
            </button>
          ))}
        </div>

        <button
          onClick={() => setFairnessOpen((o) => !o)}
          className="inline-flex items-center gap-1.5 rounded-full border border-[#00E599]/25 bg-[#00E599]/[0.07] px-3 py-1.5 text-xs font-bold text-[#00E599] transition hover:bg-[#00E599]/15"
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          Provably Fair
          {fairness && (
            <span className="font-mono text-[10px] text-zinc-300">
              #{fairness.nonce}
            </span>
          )}
        </button>
      </div>

      {/* Collapsible Provably Fair Inspector */}
      {fairnessOpen && fairness && (
        <form
          onSubmit={handleRotateSeed}
          className="surface-card rounded-2xl p-4 grid grid-cols-1 gap-3 md:grid-cols-12 items-end"
        >
          <div className="md:col-span-5">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500">
              Active Server Seed Hash (SHA-256)
            </label>
            <div className="mt-1 truncate rounded-xl border border-white/[0.07] bg-[#05070A] px-3 py-2 font-mono text-xs text-[#00E599]">
              {fairness.serverSeedHash}
            </div>
          </div>
          <div className="md:col-span-4">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500">
              Client Seed (Editable)
            </label>
            <input
              type="text"
              value={clientSeedInput}
              onChange={(e) => setClientSeedInput(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/15 bg-[#05070A] px-3 py-2 font-mono text-xs text-white outline-none focus:border-[#00E599]"
            />
          </div>
          <div className="md:col-span-1">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500">
              Nonce
            </label>
            <div className="mt-1 rounded-xl border border-white/[0.07] bg-[#05070A] px-3 py-2 font-mono text-xs font-bold text-white text-center">
              {fairness.nonce}
            </div>
          </div>
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={rotating}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-white py-2 text-xs font-bold text-[#040507] hover:bg-zinc-200 disabled:opacity-50"
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
          {/* Hero Banner */}
          <div className="surface-card relative overflow-hidden rounded-2xl p-6 sm:p-7">
            <div className="pointer-events-none absolute -right-12 -top-12 h-56 w-56 rounded-full bg-[#00E599]/10 blur-3xl" />
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-[#00E599]/30 bg-[#00E599]/10 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-widest text-[#00E599]">
                  <Sparkles className="h-3 w-3" />
                  PULSE ORIGINALS · 99% RTP · PROVABLY FAIR
                </div>
                <h1 className="mt-2.5 font-display text-2xl sm:text-3xl font-bold tracking-tight text-white">
                  Instant House-Edge Originals Arcade
                </h1>
                <p className="mt-1 max-w-2xl text-xs text-zinc-400">
                  Play Crash, Pump, Mines, Plinko, Dice, Limbo, Keno, Dragon Tower,
                  and Wheel using your shared PULSE wallet. Every outcome is
                  cryptographically verified via HMAC-SHA256 and audited live in the
                  Master Vault.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveGame('crash')}
                  className="rounded-xl bg-[#00E599] px-4 py-2.5 font-display text-xs font-black text-[#040507] shadow-[0_0_24px_rgba(0,229,153,0.35)] transition hover:brightness-110"
                >
                  Play Crash Live →
                </button>
                <button
                  onClick={() => setActiveGame('pump')}
                  className="rounded-xl border border-[#FF3B69]/40 bg-[#FF3B69]/15 px-4 py-2.5 font-display text-xs font-black text-[#FF3B69] transition hover:bg-[#FF3B69]/25"
                >
                  Play Pump →
                </button>
              </div>
            </div>
          </div>

          {/* 9-Game Flagship Card Grid */}
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {GAMES.map((g) => (
              <button
                key={g.id}
                onClick={() => setActiveGame(g.id)}
                className={`orig-card group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br ${g.gradient} p-5 text-left transition-all hover:-translate-y-1 hover:border-white/25 hover:shadow-2xl`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-[#05070A]/80 shadow-inner">
                    {g.icon}
                  </div>
                  <span
                    className="rounded-full px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider"
                    style={{
                      backgroundColor: `${g.accent}1F`,
                      color: g.accent,
                    }}
                  >
                    {g.badge}
                  </span>
                </div>

                <h3 className="mt-4 font-display text-lg font-bold text-white group-hover:text-[#00E599] transition-colors">
                  {g.name}
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                  {g.tagline}
                </p>

                <div className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-3 font-mono text-[11px]">
                  <span className="text-zinc-500">
                    Max Win <strong className="text-white">{g.maxMult}</strong>
                  </span>
                  <span className="font-bold text-[#00E599] group-hover:translate-x-0.5 transition-transform">
                    Play Now →
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
      <div className="surface-card rounded-2xl p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-xs font-bold uppercase tracking-[0.12em] text-zinc-300">
            Live Originals Bets Feed
          </h2>
          <span className="font-mono text-[11px] text-zinc-500">
            Real-time provably-fair ledger
          </span>
        </div>

        {recentBets.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 py-8 text-center text-xs text-zinc-500">
            Play any Original above to populate the live feed.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/[0.06] text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  <th className="py-2 pr-3">Game</th>
                  <th className="py-2 px-2">Player</th>
                  <th className="py-2 px-2 text-right">Bet</th>
                  <th className="py-2 px-2 text-right">Multiplier</th>
                  <th className="py-2 pl-2 text-right">Payout</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {recentBets.slice(0, 15).map((b) => (
                  <tr key={b.id} className="hover:bg-white/[0.02]">
                    <td className="py-2 pr-3">
                      <span className="rounded bg-white/[0.07] px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-white">
                        {b.game}
                      </span>
                      <span className="ml-2 font-mono text-[10px] text-zinc-500">
                        {formatTimeShort(b.createdAt)}
                      </span>
                    </td>
                    <td className="py-2 px-2">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: b.avatarColor }}
                        />
                        <span className="font-semibold text-zinc-200">
                          {b.username}
                        </span>
                      </div>
                    </td>
                    <td className="py-2 px-2 text-right font-mono text-zinc-300 tabular-nums">
                      {formatUsd(b.stakeCents)}
                    </td>
                    <td className="py-2 px-2 text-right font-mono font-bold tabular-nums">
                      <span
                        className={
                          b.multiplier >= 2
                            ? 'text-[#00E599]'
                            : b.multiplier > 0
                            ? 'text-zinc-200'
                            : 'text-zinc-600'
                        }
                      >
                        {b.multiplier.toFixed(2)}x
                      </span>
                    </td>
                    <td
                      className={`py-2 pl-2 text-right font-mono font-bold tabular-nums ${
                        b.payoutCents >= b.stakeCents
                          ? 'text-[#00E599]'
                          : 'text-zinc-500'
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
