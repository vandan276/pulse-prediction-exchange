import React, { useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Bot,
  Crown,
  Users,
} from 'lucide-react';
import { ActiveRoundState, RoundPlayer, SettledRound } from '../types';
import { formatUsd } from '../utils/format';

interface PlayersPanelProps {
  liveRound: ActiveRoundState;
  openRound: ActiveRoundState;
  lastSettled: SettledRound | null;
  currentPrice: number;
  userId?: string;
}

type RosterTab = 'live' | 'open' | 'winners';

export const PlayersPanel: React.FC<PlayersPanelProps> = ({
  liveRound,
  openRound,
  lastSettled,
  currentPrice,
  userId,
}) => {
  const [tab, setTab] = useState<RosterTab>('live');

  const isUpWinningLive =
    liveRound.lockPrice != null && currentPrice > liveRound.lockPrice;
  const isDownWinningLive =
    liveRound.lockPrice != null && currentPrice < liveRound.lockPrice;

  const renderRow = (p: RoundPlayer, mode: RosterTab) => {
    const isMe = userId != null && p.userId === userId;
    const isLeading =
      mode === 'live' &&
      ((p.direction === 'UP' && isUpWinningLive) ||
        (p.direction === 'DOWN' && isDownWinningLive));

    return (
      <div
        key={p.betId}
        className={`relative flex items-center justify-between gap-2 rounded-xl border px-3 py-2 transition ${
          isMe
            ? 'border-[#00E599]/40 bg-[#00E599]/[0.08]'
            : 'border-white/[0.045] bg-[#05070A]/80 hover:bg-white/[0.03]'
        }`}
      >
        {/* Colored direction edge bar */}
        <span
          className={`absolute left-0 top-2 bottom-2 w-[2.5px] rounded-r-full ${
            p.direction === 'UP' ? 'bg-[#00E599]' : 'bg-[#FF3B69]'
          }`}
        />

        <div className="flex min-w-0 items-center gap-2.5 pl-1">
          <div
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold text-[#040507]"
            style={{ backgroundColor: p.avatarColor }}
          >
            {p.username.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-xs font-semibold text-white">
                {p.username}
              </span>
              {isMe && (
                <span className="rounded bg-[#00E599] px-1.5 py-0.2 text-[9px] font-black uppercase text-[#040507]">
                  YOU
                </span>
              )}
              {p.isBot && <Bot className="h-3 w-3 shrink-0 text-zinc-600" />}
            </div>
            <div className="font-mono text-[10px] text-zinc-500 tabular-nums">
              {formatUsd(p.stakeCents)}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-mono text-[10px] font-bold ${
              p.direction === 'UP'
                ? 'bg-[#00E599]/15 text-[#00E599]'
                : 'bg-[#FF3B69]/15 text-[#FF3B69]'
            }`}
          >
            {p.direction === 'UP' ? (
              <ArrowUpRight className="h-3 w-3" />
            ) : (
              <ArrowDownRight className="h-3 w-3" />
            )}
            {p.direction}
          </span>

          {mode === 'live' && (
            <span
              className={`w-[54px] text-right font-mono text-[10px] font-bold uppercase ${
                isLeading ? 'text-[#00E599]' : 'text-zinc-600'
              }`}
            >
              {isLeading ? 'ITM' : 'PLAY'}
            </span>
          )}

          {mode === 'winners' && (
            <span className="font-mono text-xs font-bold text-[#00E599] tabular-nums">
              +{formatUsd(p.payoutCents ?? 0)}
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="surface-card flex flex-col rounded-2xl p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-display text-xs font-bold uppercase tracking-[0.1em] text-zinc-300">
          Live Arena Tape
        </span>
        <span className="font-mono text-[10px] text-zinc-500">
          {tab === 'live'
            ? `Round #${liveRound.roundNumber}`
            : tab === 'open'
            ? `Next #${openRound.roundNumber}`
            : lastSettled
            ? `Settled #${lastSettled.roundNumber}`
            : '—'}
        </span>
      </div>

      {/* Segmented Roster Tabs */}
      <div className="grid grid-cols-3 gap-1 rounded-xl border border-white/[0.06] bg-[#05070A] p-1">
        <button
          onClick={() => setTab('live')}
          className={`flex items-center justify-center gap-1 rounded-lg py-1.5 text-[11px] font-bold transition ${
            tab === 'live'
              ? 'bg-white text-[#040507]'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Users className="h-3 w-3" />
          Live ({liveRound.playerCount})
        </button>

        <button
          onClick={() => setTab('open')}
          className={`rounded-lg py-1.5 text-[11px] font-bold transition ${
            tab === 'open'
              ? 'bg-white text-[#040507]'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          Next ({openRound.playerCount})
        </button>

        <button
          onClick={() => setTab('winners')}
          className={`flex items-center justify-center gap-1 rounded-lg py-1.5 text-[11px] font-bold transition ${
            tab === 'winners'
              ? 'bg-[#F5B731] text-[#040507]'
              : 'text-zinc-400 hover:text-[#F5B731]'
          }`}
        >
          <Crown className="h-3 w-3" />
          Won ({lastSettled?.winnerCount ?? 0})
        </button>
      </div>

      {tab === 'winners' && lastSettled && (
        <div className="mt-2.5 rounded-xl border border-[#F5B731]/25 bg-[#F5B731]/[0.06] px-3 py-2 text-[11px]">
          <div className="flex items-center justify-between font-bold">
            <span className="text-[#F5B731]">
              #{lastSettled.roundNumber} · {lastSettled.outcome} WON
            </span>
            <span className="font-mono text-[#00E599] tabular-nums">
              {formatUsd(lastSettled.payoutPerWinnerCents)} ea
            </span>
          </div>
          <div className="mt-0.5 text-[10px] text-zinc-400">
            90% ({formatUsd(lastSettled.distributablePoolCents)}) split equally ·
            10% ({formatUsd(lastSettled.masterFeeCents)}) Master Vault
          </div>
        </div>
      )}

      <div className="mt-2.5 max-h-[340px] space-y-1.5 overflow-y-auto pr-0.5">
        {tab === 'live' &&
          (liveRound.players.length > 0 ? (
            liveRound.players.map((p) => renderRow(p, 'live'))
          ) : (
            <div className="rounded-xl border border-dashed border-white/10 py-8 text-center text-xs text-zinc-500">
              No active players in this live candle yet.
            </div>
          ))}

        {tab === 'open' &&
          (openRound.players.length > 0 ? (
            openRound.players.map((p) => renderRow(p, 'open'))
          ) : (
            <div className="rounded-xl border border-dashed border-white/10 py-8 text-center text-xs text-zinc-500">
              Be the first to enter Round #{openRound.roundNumber}.
            </div>
          ))}

        {tab === 'winners' &&
          (lastSettled && lastSettled.winners.length > 0 ? (
            lastSettled.winners.map((p) => renderRow(p, 'winners'))
          ) : (
            <div className="rounded-xl border border-dashed border-white/10 py-8 text-center text-xs text-zinc-500">
              Winners appear here the moment a candle settles.
            </div>
          ))}
      </div>
    </div>
  );
};
