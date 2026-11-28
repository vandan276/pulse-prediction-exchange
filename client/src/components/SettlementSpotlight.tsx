import React from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Crown,
  Landmark,
  RefreshCcw,
} from 'lucide-react';
import { SettledRound } from '../types';
import { formatPrice, formatTimeShort, formatUsd } from '../utils/format';

interface SettlementSpotlightProps {
  round: SettledRound | null;
  decimals: number;
  userId?: string;
}

export const SettlementSpotlight: React.FC<SettlementSpotlightProps> = ({
  round,
  decimals,
  userId,
}) => {
  if (!round) return null;

  const isUp = round.outcome === 'UP';
  const isDown = round.outcome === 'DOWN';
  const isRefund = round.outcome === 'DRAW' || round.outcome === 'NO_WINNERS';
  const userWon =
    userId != null && round.winners.some((w) => w.userId === userId);

  return (
    <div
      className={`rounded-xl border p-4 transition-all ${
        userWon
          ? 'border-accent/50 bg-gradient-to-r from-accent/[0.12] via-surface to-surface shadow-[0_0_32px_rgba(0,200,83,0.12)]'
          : 'surface-card'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 font-display text-xs font-bold text-fg">
            <Crown className="h-4 w-4 text-gold" />
            Last Settled #{round.roundNumber}
          </span>

          <span
            className={`inline-flex items-center gap-0.5 rounded-full px-2.5 py-0.5 font-mono text-[11px] font-bold ${
              isUp
                ? 'bg-accent/15 text-accent'
                : isDown
                ? 'bg-danger/15 text-danger'
                : 'bg-fg/10 text-fg2'
            }`}
          >
            {isUp && <ArrowUpRight className="h-3 w-3" />}
            {isDown && <ArrowDownRight className="h-3 w-3" />}
            {isRefund && <RefreshCcw className="h-3 w-3" />}
            {isRefund ? 'REFUNDED' : `${round.outcome} WON`}
          </span>

          {userWon && (
            <span className="rounded-full bg-accent px-2.5 py-0.5 font-mono text-[11px] font-black text-onaccent">
              YOU WON +{formatUsd(round.payoutPerWinnerCents)}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 font-mono text-[11px] text-muted tabular-nums">
          <span>
            ${formatPrice(round.lockPrice, decimals)} →{' '}
            <strong className={isUp ? 'text-accent' : isDown ? 'text-danger' : 'text-fg'}>
              ${formatPrice(round.closePrice, decimals)}
            </strong>
          </span>
          {!isRefund && (
            <>
              <span className="text-subtle">|</span>
              <span className="flex items-center gap-1 text-gold">
                <Landmark className="h-3 w-3" />
                10% Vault: {formatUsd(round.masterFeeCents)}
              </span>
              <span className="text-subtle">|</span>
              <span className="text-accent font-bold">
                {formatUsd(round.payoutPerWinnerCents)} × {round.winnerCount} winners
              </span>
            </>
          )}
          <span className="hidden sm:inline text-subtle">
            {formatTimeShort(round.settledAt)}
          </span>
        </div>
      </div>

      {round.winners.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {round.winners.map((w) => {
            const isMe = userId != null && w.userId === userId;
            return (
              <div
                key={w.betId}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] ${
                  isMe
                    ? 'border-accent bg-accent/20 text-fg font-bold'
                    : 'border-fg/[0.08] bg-raised text-fg'
                }`}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: w.avatarColor }}
                />
                <span>{w.username}</span>
                <span className="font-mono font-bold text-accent tabular-nums">
                  +{formatUsd(w.payoutCents ?? round.payoutPerWinnerCents)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
