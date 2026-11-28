import React from 'react';
import { Landmark, ShieldCheck, Trophy, Users } from 'lucide-react';
import { ActiveRoundState } from '../types';
import { formatPrice, formatUsd } from '../utils/format';

interface LiveRoundBannerProps {
  liveRound: ActiveRoundState;
  currentPrice: number;
  decimals: number;
}

export const LiveRoundBanner: React.FC<LiveRoundBannerProps> = ({
  liveRound,
  currentPrice,
  decimals,
}) => {
  const strike = liveRound.lockPrice ?? currentPrice;

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
      <div className="surface-card rounded-xl px-3.5 py-3">
        <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-subtle">
          <span>Live Pool ({liveRound.playerCount} Players)</span>
          <Users className="h-3.5 w-3.5 text-muted" />
        </div>
        <div className="mt-1 font-mono text-lg font-extrabold text-fg tabular-nums">
          {formatUsd(liveRound.totalPoolCents)}
        </div>
        <div className="mt-0.5 font-mono text-[10px] text-muted tabular-nums">
          <span className="text-accent">{liveRound.upCount} UP</span> ·{' '}
          <span className="text-danger">{liveRound.downCount} DN</span> · Strike $
          {formatPrice(strike, decimals)}
        </div>
      </div>

      <div className="rounded-xl border border-gold/25 bg-gold/[0.05] px-3.5 py-3">
        <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-gold">
          <span>Master Vault (10%)</span>
          <Landmark className="h-3.5 w-3.5 text-gold" />
        </div>
        <div className="mt-1 font-mono text-lg font-extrabold text-gold tabular-nums">
          {formatUsd(liveRound.masterFeeCents)}
        </div>
        <div className="mt-0.5 text-[10px] text-muted">
          Auto-routed on settlement
        </div>
      </div>

      <div className="rounded-xl border border-accent/25 bg-accent/[0.05] px-3.5 py-3">
        <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-accent">
          <span>Winner Pool (90%)</span>
          <ShieldCheck className="h-3.5 w-3.5 text-accent" />
        </div>
        <div className="mt-1 font-mono text-lg font-extrabold text-accent tabular-nums">
          {formatUsd(liveRound.distributablePoolCents)}
        </div>
        <div className="mt-0.5 text-[10px] text-muted">
          Distributed equally to winners
        </div>
      </div>

      <div className="surface-card rounded-xl px-3.5 py-3">
        <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-subtle">
          <span>Est. Equal Payout</span>
          <Trophy className="h-3.5 w-3.5 text-muted" />
        </div>
        <div className="mt-1 space-y-0.5 font-mono text-xs font-bold tabular-nums">
          <div className="flex items-center justify-between">
            <span className="text-subtle">UP win</span>
            <span className="text-accent">
              {liveRound.upCount > 0 ? formatUsd(liveRound.estUpPayoutCents) : '—'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-subtle">DN win</span>
            <span className="text-danger">
              {liveRound.downCount > 0 ? formatUsd(liveRound.estDownPayoutCents) : '—'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
