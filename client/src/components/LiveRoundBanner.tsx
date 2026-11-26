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
        <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          <span>Live Pool ({liveRound.playerCount} Players)</span>
          <Users className="h-3.5 w-3.5 text-zinc-400" />
        </div>
        <div className="mt-1 font-mono text-lg font-extrabold text-white tabular-nums">
          {formatUsd(liveRound.totalPoolCents)}
        </div>
        <div className="mt-0.5 font-mono text-[10px] text-zinc-400 tabular-nums">
          <span className="text-[#00E599]">{liveRound.upCount} UP</span> ·{' '}
          <span className="text-[#FF3B69]">{liveRound.downCount} DN</span> · Strike $
          {formatPrice(strike, decimals)}
        </div>
      </div>

      <div className="rounded-xl border border-[#F5B731]/25 bg-[#F5B731]/[0.05] px-3.5 py-3">
        <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-[#F5B731]">
          <span>Master Vault (10%)</span>
          <Landmark className="h-3.5 w-3.5 text-[#F5B731]" />
        </div>
        <div className="mt-1 font-mono text-lg font-extrabold text-[#F5B731] tabular-nums">
          {formatUsd(liveRound.masterFeeCents)}
        </div>
        <div className="mt-0.5 text-[10px] text-zinc-400">
          Auto-routed on settlement
        </div>
      </div>

      <div className="rounded-xl border border-[#00E599]/25 bg-[#00E599]/[0.05] px-3.5 py-3">
        <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-[#00E599]">
          <span>Winner Pool (90%)</span>
          <ShieldCheck className="h-3.5 w-3.5 text-[#00E599]" />
        </div>
        <div className="mt-1 font-mono text-lg font-extrabold text-[#00E599] tabular-nums">
          {formatUsd(liveRound.distributablePoolCents)}
        </div>
        <div className="mt-0.5 text-[10px] text-zinc-400">
          Distributed equally to winners
        </div>
      </div>

      <div className="surface-card rounded-xl px-3.5 py-3">
        <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          <span>Est. Equal Payout</span>
          <Trophy className="h-3.5 w-3.5 text-zinc-400" />
        </div>
        <div className="mt-1 space-y-0.5 font-mono text-xs font-bold tabular-nums">
          <div className="flex items-center justify-between">
            <span className="text-zinc-500">UP win</span>
            <span className="text-[#00E599]">
              {liveRound.upCount > 0 ? formatUsd(liveRound.estUpPayoutCents) : '—'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-zinc-500">DN win</span>
            <span className="text-[#FF3B69]">
              {liveRound.downCount > 0 ? formatUsd(liveRound.estDownPayoutCents) : '—'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
