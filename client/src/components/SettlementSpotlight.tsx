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
      className={`rounded-2xl border p-4 transition-all ${
        userWon
          ? 'border-[#00E599]/50 bg-gradient-to-r from-[#00E599]/[0.12] via-[#090B0F] to-[#090B0F] shadow-[0_0_32px_rgba(0,229,153,0.12)]'
          : 'surface-card'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 font-display text-xs font-bold text-white">
            <Crown className="h-4 w-4 text-[#F5B731]" />
            Last Settled #{round.roundNumber}
          </span>

          <span
            className={`inline-flex items-center gap-0.5 rounded-full px-2.5 py-0.5 font-mono text-[11px] font-bold ${
              isUp
                ? 'bg-[#00E599]/15 text-[#00E599]'
                : isDown
                ? 'bg-[#FF3B69]/15 text-[#FF3B69]'
                : 'bg-white/10 text-zinc-300'
            }`}
          >
            {isUp && <ArrowUpRight className="h-3 w-3" />}
            {isDown && <ArrowDownRight className="h-3 w-3" />}
            {isRefund && <RefreshCcw className="h-3 w-3" />}
            {isRefund ? 'REFUNDED' : `${round.outcome} WON`}
          </span>

          {userWon && (
            <span className="rounded-full bg-[#00E599] px-2.5 py-0.5 font-mono text-[11px] font-black text-[#040507]">
              YOU WON +{formatUsd(round.payoutPerWinnerCents)}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 font-mono text-[11px] text-zinc-400 tabular-nums">
          <span>
            ${formatPrice(round.lockPrice, decimals)} →{' '}
            <strong className={isUp ? 'text-[#00E599]' : isDown ? 'text-[#FF3B69]' : 'text-white'}>
              ${formatPrice(round.closePrice, decimals)}
            </strong>
          </span>
          {!isRefund && (
            <>
              <span className="text-zinc-700">|</span>
              <span className="flex items-center gap-1 text-[#F5B731]">
                <Landmark className="h-3 w-3" />
                10% Vault: {formatUsd(round.masterFeeCents)}
              </span>
              <span className="text-zinc-700">|</span>
              <span className="text-[#00E599] font-bold">
                {formatUsd(round.payoutPerWinnerCents)} × {round.winnerCount} winners
              </span>
            </>
          )}
          <span className="hidden sm:inline text-zinc-600">
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
                    ? 'border-[#00E599] bg-[#00E599]/20 text-white font-bold'
                    : 'border-white/[0.08] bg-[#05070A] text-zinc-200'
                }`}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: w.avatarColor }}
                />
                <span>{w.username}</span>
                <span className="font-mono font-bold text-[#00E599] tabular-nums">
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
