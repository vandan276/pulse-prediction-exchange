import React from 'react';
import {
  CheckCircle2,
  Clock,
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
    <div className="surface-card rounded-2xl p-5">
      {/* Probability Split — Apex Pro Fintech Signature */}
      <div>
        <div className="flex items-center justify-between text-xs font-medium text-muted">
          <span>Probability split</span>
          <span className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-fg tabular-nums">
            {isEntryOpen ? (
              <Clock className="h-3 w-3 text-accent" />
            ) : (
              <Lock className="h-3 w-3 text-gold" />
            )}
            {formatCountdown(isEntryOpen ? cutoffMsRemaining : lockMsRemaining)}
          </span>
        </div>

        <div className="mt-2 flex items-baseline justify-between font-display text-sm font-bold tabular-nums">
          <span className="text-accent">{upPct}% UP</span>
          <span className="text-danger">{dnPct}% DOWN</span>
        </div>

        <div className="mt-1.5 flex h-2 w-full overflow-hidden rounded-full bg-raised">
          <div
            className="h-full bg-accent transition-all duration-300"
            style={{ width: `${upPct}%` }}
          />
          <div
            className="h-full bg-danger transition-all duration-300"
            style={{ width: `${dnPct}%` }}
          />
        </div>

        <div className="mt-2 flex items-center justify-between text-[11px] text-muted">
          <span className="inline-flex items-center gap-1">
            <ShieldCheck className="h-3 w-3 text-accent" />
            Next {timeframe.label} #{openRound.roundNumber}
          </span>
          <span className="inline-flex items-center gap-1 font-mono tabular-nums">
            <Users className="h-3 w-3" />
            {openRound.playerCount} queued
          </span>
        </div>
      </div>

      {/* Rounded Stake Pills with Royal Cobalt Active Ring */}
      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between text-xs font-medium text-muted">
          <span>Stake</span>
          <span className="font-mono text-[11px]">
            Pool {formatUsd(openRound.totalPoolCents)}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {tiers.map((tier) => {
            const active = tier.amountCents === selectedTierCents;
            return (
              <button
                key={tier.id}
                onClick={() => onSelectTier(tier.amountCents)}
                className={`rounded-full border py-2 font-mono text-sm font-bold transition-all tabular-nums ${
                  active
                    ? 'border-info bg-info/10 text-info ring-1 ring-info/40'
                    : 'border-line bg-surface text-fg hover:bg-raised'
                }`}
              >
                {tier.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Clean Payout Model Breakdown */}
      <div className="mt-5 space-y-2 border-t border-line pt-4 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-muted">Payout Model</span>
          <span className="font-semibold text-fg">90% Equal Split</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted">Master Vault Fee</span>
          <span className="font-mono font-medium text-fg2 tabular-nums">
            10% ({formatUsd(openRound.masterFeeCents)})
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted">Est. Return (UP / DN)</span>
          <span className="font-mono font-bold text-accent tabular-nums">
            {formatUsd(projUpPayout)} / {formatUsd(projDownPayout)}
          </span>
        </div>
      </div>

      {/* Anti-Snipe Bar */}
      <div className="mt-3.5">
        <div className="h-1 w-full overflow-hidden rounded-full bg-raised">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              isEntryOpen ? 'bg-accent' : 'bg-gold'
            }`}
            style={{ width: isEntryOpen ? `${openPctLeft}%` : '100%' }}
          />
        </div>
        <div className="mt-1 flex items-center justify-between text-[10px] text-subtle">
          <span>{isEntryOpen ? `Anti-Snipe (${cutoffSec}s cutoff)` : 'Entries Sealed'}</span>
          <span className="font-mono tabular-nums">Opens {formatCountdown(lockMsRemaining)}</span>
        </div>
      </div>

      {/* Execution Area */}
      {myBet ? (
        <div
          className={`mt-4 rounded-xl border p-3.5 ${
            myBet.direction === 'UP'
              ? 'border-accent/40 bg-accent/10'
              : 'border-danger/40 bg-danger/10'
          }`}
        >
          <div className="flex items-start gap-2.5">
            <CheckCircle2
              className={`h-5 w-5 shrink-0 mt-0.5 ${
                myBet.direction === 'UP' ? 'text-accent' : 'text-danger'
              }`}
            />
            <div>
              <div className="font-display text-xs font-bold uppercase tracking-wide text-fg">
                Position Locked — {myBet.direction} ({formatUsd(myBet.stakeCents)})
              </div>
              <p className="mt-0.5 text-[11px] leading-relaxed text-fg2">
                Strike locks when Round #{openRound.roundNumber} begins in{' '}
                <strong className="font-mono text-fg">
                  {formatCountdown(lockMsRemaining)}
                </strong>
                .
              </p>
            </div>
          </div>
        </div>
      ) : !isEntryOpen ? (
        <div className="mt-4 rounded-xl border border-gold/35 bg-gold/10 p-4 text-center">
          <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-gold/15 text-gold">
            <Lock className="h-4 w-4" />
          </div>
          <div className="mt-2 font-display text-xs font-bold uppercase tracking-wider text-gold">
            Entries Sealed — Anti-Snipe Lock
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-fg2">
            Betting closes <strong className="text-fg">{cutoffSec}s before</strong> open. Round #
            {openRound.roundNumber} starts in{' '}
            <strong className="font-mono text-gold">
              {formatCountdown(lockMsRemaining)}
            </strong>
            .
          </p>
        </div>
      ) : !user ? (
        <div className="mt-4 space-y-2.5">
          <button
            onClick={onOpenUserModal}
            className="btn-glow w-full rounded-xl bg-accent py-3 font-display text-sm font-bold text-onaccent transition hover:brightness-105"
          >
            Predict UP · {upMult.toFixed(2)}x
          </button>
          <button
            onClick={onOpenUserModal}
            className="w-full rounded-xl bg-danger py-3 font-display text-sm font-bold text-white transition hover:brightness-105"
          >
            Predict DOWN · {dnMult.toFixed(2)}x
          </button>
          <p className="text-center text-[11px] text-muted">
            Sign in or create an account to lock your prediction.
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-2.5">
          <button
            disabled={placing || insufficientBalance}
            onClick={() => onPlaceBet('UP')}
            className="btn-glow flex w-full items-center justify-between rounded-xl bg-accent px-4 py-3 text-onaccent transition hover:brightness-105 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45"
          >
            <span className="font-display text-sm font-bold">Predict UP</span>
            <span className="font-mono text-xs font-bold tabular-nums opacity-95">
              {formatUsd(projUpPayout)} ({upMult.toFixed(2)}x)
            </span>
          </button>

          <button
            disabled={placing || insufficientBalance}
            onClick={() => onPlaceBet('DOWN')}
            className="flex w-full items-center justify-between rounded-xl bg-danger px-4 py-3 text-white shadow-[0_4px_14px_-4px_rgba(255,59,92,0.45)] transition hover:brightness-105 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45"
          >
            <span className="font-display text-sm font-bold">Predict DOWN</span>
            <span className="font-mono text-xs font-bold tabular-nums opacity-95">
              {formatUsd(projDownPayout)} ({dnMult.toFixed(2)}x)
            </span>
          </button>

          {insufficientBalance && (
            <p className="text-center text-[11px] font-medium text-gold">
              Insufficient balance — tap <strong>+ Deposit USDT</strong> above to fund your wallet.
            </p>
          )}
        </div>
      )}
    </div>
  );
};
