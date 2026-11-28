import React from 'react';
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Clock,
  Landmark,
  Lock,
  ShieldCheck,
  Users,
} from 'lucide-react';
import {
  ActiveRoundState,
  Direction,
  StakeTier,
  TimeframeOption,
  UserProfile,
} from '../types';
import { formatCountdown, formatUsd } from '../utils/format';

interface BetTicketPanelProps {
  openRound: ActiveRoundState;
  timeframe: TimeframeOption;
  tiers: StakeTier[];
  selectedTierCents: number;
  onSelectTier: (tierCents: number) => void;
  user: UserProfile | null;
  nowMs: number;
  placing: boolean;
  onPlaceBet: (direction: Direction) => void;
  onOpenUserModal: () => void;
}

export const BetTicketPanel: React.FC<BetTicketPanelProps> = ({
  openRound,
  timeframe,
  tiers,
  selectedTierCents,
  onSelectTier,
  user,
  nowMs,
  placing,
  onPlaceBet,
  onOpenUserModal,
}) => {
  const cutoffMsRemaining = Math.max(0, openRound.entryCloseTime - nowMs);
  const lockMsRemaining = Math.max(0, openRound.lockTime - nowMs);
  const isEntryOpen = nowMs < openRound.entryCloseTime;
  const cutoffSec = Math.round((openRound.entryCutoffMs || 15000) / 1000);

  const openWindowTotalMs = Math.max(
    1000,
    timeframe.durationMs - (openRound.entryCutoffMs || 15000)
  );
  const openPctLeft = Math.max(
    0,
    Math.min(100, (cutoffMsRemaining / openWindowTotalMs) * 100)
  );

  const myBet = user
    ? openRound.players.find((p) => p.userId === user.id)
    : null;

  const nextTotalIfJoin = openRound.totalPoolCents + selectedTierCents;
  const nextFeeIfJoin = Math.round(nextTotalIfJoin * 0.1);
  const nextDistIfJoin = nextTotalIfJoin - nextFeeIfJoin;
  const projUpPayout = Math.floor(nextDistIfJoin / (openRound.upCount + 1));
  const projDownPayout = Math.floor(nextDistIfJoin / (openRound.downCount + 1));
  const upMult = selectedTierCents > 0 ? projUpPayout / selectedTierCents : 0;
  const dnMult = selectedTierCents > 0 ? projDownPayout / selectedTierCents : 0;

  const totalPlayers = openRound.playerCount;
  const upPct =
    totalPlayers > 0 ? Math.round((openRound.upCount / totalPlayers) * 100) : 50;
  const dnPct = totalPlayers > 0 ? 100 - upPct : 50;

  const insufficientBalance =
    user != null && user.balanceCents < selectedTierCents;

  return (
    <div className="surface-card rounded-2xl p-4 relative overflow-hidden">
      {/* Subtle top glow matching phase */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[2px]"
        style={{
          background: isEntryOpen
            ? 'linear-gradient(90deg, transparent, #00E599, transparent)'
            : 'linear-gradient(90deg, transparent, #F5B731, transparent)',
        }}
      />

      {/* Header: Next Candle Round + Cutoff Timer */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                isEntryOpen
                  ? 'bg-[#00E599]/15 text-[#00E599] ring-1 ring-[#00E599]/30'
                  : 'bg-[#F5B731]/15 text-[#F5B731] ring-1 ring-[#F5B731]/35'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  isEntryOpen ? 'bg-[#00E599] animate-pulse' : 'bg-[#F5B731]'
                }`}
              />
              {isEntryOpen ? 'Entries Open' : 'Anti-Snipe Sealed'}
            </span>
            <span className="font-mono text-[11px] font-semibold text-zinc-400">
              #{openRound.roundNumber}
            </span>
          </div>
          <h3 className="mt-1.5 font-display text-sm font-bold text-white">
            Next {timeframe.label} Candle
          </h3>
        </div>

        <div className="rounded-xl border border-white/[0.08] bg-[#05070A] px-2.5 py-1.5 text-right">
          <div className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">
            {isEntryOpen ? 'Entry Cutoff' : 'Candle Opens'}
          </div>
          <div
            className={`flex items-center justify-end gap-1 font-mono text-sm font-extrabold tabular-nums ${
              isEntryOpen
                ? cutoffMsRemaining < 10_000
                  ? 'text-[#F5B731]'
                  : 'text-white'
                : 'text-[#F5B731]'
            }`}
          >
            {isEntryOpen ? (
              <Clock className="h-3.5 w-3.5 text-[#00E599]" />
            ) : (
              <Lock className="h-3.5 w-3.5 text-[#F5B731]" />
            )}
            {formatCountdown(isEntryOpen ? cutoffMsRemaining : lockMsRemaining)}
          </div>
        </div>
      </div>

      {/* Anti-Snipe Cutoff Countdown Progress */}
      <div className="mt-2.5">
        <div className="mb-1 flex items-center justify-between text-[10px] text-zinc-400">
          <span className="flex items-center gap-1">
            <ShieldCheck className="h-3 w-3 text-[#00E599]" />
            Anti-Snipe Shield ({cutoffSec}s pre-lock)
          </span>
          <span className="font-mono text-zinc-300 tabular-nums">
            Opens in {formatCountdown(lockMsRemaining)}
          </span>
        </div>
        <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.07]">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              isEntryOpen ? 'bg-[#00E599]' : 'bg-[#F5B731]'
            }`}
            style={{ width: isEntryOpen ? `${openPctLeft}%` : '100%' }}
          />
        </div>
      </div>

      {/* Fixed Stake Tier Pills */}
      <div className="mt-3.5">
        <div className="mb-1.5 flex items-center justify-between text-[11px]">
          <span className="font-medium text-zinc-400">Equal-Split Room Stake</span>
          <span className="flex items-center gap-1 font-mono text-zinc-300 tabular-nums">
            <Users className="h-3 w-3 text-[#00E599]" />
            {openRound.playerCount} queued
          </span>
        </div>
        <div className="grid grid-cols-3 gap-1.5 rounded-xl border border-white/[0.06] bg-[#05070A] p-1">
          {tiers.map((tier) => {
            const active = tier.amountCents === selectedTierCents;
            return (
              <button
                key={tier.id}
                onClick={() => onSelectTier(tier.amountCents)}
                className={`rounded-lg py-1.5 font-mono text-xs font-bold transition-all tabular-nums ${
                  active
                    ? 'bg-white text-[#040507] shadow-sm'
                    : 'text-zinc-400 hover:bg-white/[0.05] hover:text-white'
                }`}
              >
                {tier.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Bull vs Bear Tug-of-War Bar */}
      <div className="mt-3.5 rounded-xl border border-white/[0.06] bg-[#05070A] p-3">
        <div className="mb-1.5 flex items-center justify-between font-mono text-[11px] font-bold tabular-nums">
          <span className="text-[#00E599]">
            UP {openRound.upCount} ({upPct}%)
          </span>
          <span className="text-zinc-500 text-[10px]">POOL SPLIT</span>
          <span className="text-[#FF3B69]">
            ({dnPct}%) {openRound.downCount} DN
          </span>
        </div>
        <div className="flex h-2 w-full overflow-hidden rounded-full bg-white/[0.06] gap-[2px]">
          <div
            className="h-full rounded-l-full bg-[#00E599] shadow-[0_0_12px_rgba(0,229,153,0.45)] transition-all duration-300"
            style={{ width: `${upPct}%` }}
          />
          <div
            className="h-full rounded-r-full bg-[#FF3B69] shadow-[0_0_12px_rgba(255,59,105,0.45)] transition-all duration-300"
            style={{ width: `${dnPct}%` }}
          />
        </div>

        <div className="mt-2.5 space-y-1 text-[11px]">
          <div className="flex items-center justify-between">
            <span className="text-zinc-400">Queued Pool</span>
            <span className="font-mono font-bold text-white tabular-nums">
              {formatUsd(openRound.totalPoolCents)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1 text-[#F5B731]/90">
              <Landmark className="h-3 w-3" />
              Master Vault (10%)
            </span>
            <span className="font-mono font-semibold text-[#F5B731] tabular-nums">
              -{formatUsd(openRound.masterFeeCents)}
            </span>
          </div>
          <div className="flex items-center justify-between border-t border-white/[0.06] pt-1">
            <span className="font-semibold text-[#00E599]">90% Equal Split</span>
            <span className="font-mono font-bold text-[#00E599] tabular-nums">
              {formatUsd(openRound.distributablePoolCents)}
            </span>
          </div>
        </div>
      </div>

      {/* Execution Area */}
      {myBet ? (
        <div
          className={`mt-3.5 rounded-xl border p-3.5 ${
            myBet.direction === 'UP'
              ? 'border-[#00E599]/45 bg-[#00E599]/[0.09]'
              : 'border-[#FF3B69]/45 bg-[#FF3B69]/[0.09]'
          }`}
        >
          <div className="flex items-start gap-2.5">
            <CheckCircle2
              className={`h-5 w-5 shrink-0 mt-0.5 ${
                myBet.direction === 'UP' ? 'text-[#00E599]' : 'text-[#FF3B69]'
              }`}
            />
            <div>
              <div className="font-display text-xs font-bold uppercase tracking-wide text-white">
                Position Locked — {myBet.direction} ({formatUsd(myBet.stakeCents)})
              </div>
              <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-300">
                Strike price locks when Round #{openRound.roundNumber} begins in{' '}
                <strong className="font-mono text-white">
                  {formatCountdown(lockMsRemaining)}
                </strong>
                .
              </p>
            </div>
          </div>
        </div>
      ) : !isEntryOpen ? (
        /* HARD ANTI-SNIPE SEALED STATE */
        <div className="mt-3.5 rounded-xl border border-[#F5B731]/35 bg-[#F5B731]/[0.07] p-4 text-center">
          <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-[#F5B731]/15 text-[#F5B731] ring-1 ring-[#F5B731]/35">
            <Lock className="h-4 w-4" />
          </div>
          <div className="mt-2 font-display text-xs font-bold uppercase tracking-wider text-[#F5B731]">
            Entries Sealed — Anti-Snipe Lock
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-zinc-300">
            Betting closes{' '}
            <strong className="text-white">{cutoffSec}s before</strong> each
            candle opens so no one can snipe at the last second. Round #
            {openRound.roundNumber} locks in{' '}
            <strong className="font-mono text-[#F5B731]">
              {formatCountdown(lockMsRemaining)}
            </strong>
            .
          </p>
        </div>
      ) : !user ? (
        <button
          onClick={onOpenUserModal}
          className="mt-3.5 w-full rounded-xl bg-[#00E599] py-3 font-display text-sm font-bold text-[#040507] shadow-[0_0_24px_rgba(0,229,153,0.3)] transition hover:brightness-110"
        >
          Connect Wallet to Predict
        </button>
      ) : (
        <div className="mt-3.5 space-y-2">
          <div className="grid grid-cols-2 gap-2.5">
            <button
              disabled={placing || insufficientBalance}
              onClick={() => onPlaceBet('UP')}
              className="btn-glow group relative flex flex-col items-center justify-center overflow-hidden rounded-xl bg-gradient-to-b from-[#00F0A0] to-[#00C480] px-3 py-3.5 text-[#040507] shadow-[0_10px_28px_-8px_rgba(0,229,153,0.55)] ring-1 ring-white/25 transition hover:brightness-110 active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <div className="flex items-center gap-1 font-display text-sm font-bold tracking-tight">
                <ArrowUp className="h-4 w-4 stroke-[3]" />
                HIGHER
              </div>
              <div className="mt-0.5 font-mono text-[11px] font-bold text-[#040507]/80 tabular-nums">
                {formatUsd(projUpPayout)} · {upMult.toFixed(2)}x
              </div>
            </button>

            <button
              disabled={placing || insufficientBalance}
              onClick={() => onPlaceBet('DOWN')}
              className="btn-glow group relative flex flex-col items-center justify-center overflow-hidden rounded-xl bg-gradient-to-b from-[#FF4774] to-[#E11D48] px-3 py-3.5 text-white shadow-[0_10px_28px_-8px_rgba(255,59,105,0.5)] ring-1 ring-white/20 transition hover:brightness-110 active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <div className="flex items-center gap-1 font-display text-sm font-bold tracking-tight">
                <ArrowDown className="h-4 w-4 stroke-[3]" />
                LOWER
              </div>
              <div className="mt-0.5 font-mono text-[11px] font-bold text-white/90 tabular-nums">
                {formatUsd(projDownPayout)} · {dnMult.toFixed(2)}x
              </div>
            </button>
          </div>

          {insufficientBalance && (
            <p className="text-center text-[11px] font-medium text-[#F5B731]">
              Insufficient balance — tap <strong>+500</strong> in the top bar.
            </p>
          )}
        </div>
      )}
    </div>
  );
};
