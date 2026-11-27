import React from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Bot,
  Crown,
  History,
  Trophy,
} from 'lucide-react';
import { SettledRound, UserProfile } from '../types';
import { formatTimeShort, formatUsd } from '../utils/format';

interface LeaderboardViewProps {
  leaderboard: UserProfile[];
  globalRounds: SettledRound[];
  currentUserId?: string;
}

export const LeaderboardView: React.FC<LeaderboardViewProps> = ({
  leaderboard,
  globalRounds,
  currentUserId,
}) => {
  return (
    <div className="mx-auto grid w-full min-w-0 max-w-[1680px] grid-cols-1 gap-5 px-3 py-4 sm:px-4 sm:py-6 lg:grid-cols-12 lg:px-6">
      {/* Top Traders Leaderboard */}
      <div className="surface-card min-w-0 rounded-2xl p-4 sm:p-5 lg:col-span-5">
        <div className="mb-4 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F5B731]/15 text-[#F5B731]">
            <Trophy className="h-4.5 w-4.5" />
          </div>
          <div>
            <h2 className="font-display text-sm font-bold text-white">
              Top Predictors
            </h2>
            <p className="text-[11px] text-zinc-400">
              Ranked by net P/L across Crypto &amp; Commodities
            </p>
          </div>
        </div>

        <div className="space-y-2">
          {leaderboard.map((player, idx) => {
            const isMe = currentUserId === player.id;
            return (
              <div
                key={player.id}
                className={`flex items-center justify-between rounded-xl border px-3 py-2.5 ${
                  isMe
                    ? 'border-[#00E599]/40 bg-[#00E599]/[0.08]'
                    : 'border-white/[0.05] bg-[#05070A]'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg font-mono text-xs font-black ${
                      idx === 0
                        ? 'bg-[#F5B731] text-[#040507]'
                        : idx === 1
                        ? 'bg-zinc-300 text-[#040507]'
                        : idx === 2
                        ? 'bg-amber-700 text-white'
                        : 'bg-white/[0.06] text-zinc-400'
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <div
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold text-[#040507]"
                    style={{ backgroundColor: player.avatarColor }}
                  >
                    {player.username.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-xs font-bold text-white">
                        {player.username}
                      </span>
                      {isMe && (
                        <span className="rounded bg-[#00E599] px-1.5 py-0.2 text-[9px] font-black text-[#040507]">
                          YOU
                        </span>
                      )}
                      {player.isBot && <Bot className="h-3 w-3 text-zinc-600" />}
                    </div>
                    <div className="font-mono text-[10px] text-zinc-500 tabular-nums">
                      {player.totalWins}/{player.totalBets} wins ({player.winRate}%)
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div
                    className={`font-mono text-xs font-extrabold tabular-nums ${
                      player.netProfitCents >= 0 ? 'text-[#00E599]' : 'text-[#FF3B69]'
                    }`}
                  >
                    {formatUsd(player.netProfitCents, { showSign: true })}
                  </div>
                  <div className="font-mono text-[10px] text-zinc-500 tabular-nums">
                    Won {formatUsd(player.totalWonCents)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Global Settled Rounds Feed */}
      <div className="surface-card rounded-2xl p-5 lg:col-span-7">
        <div className="mb-4 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.06] text-[#00E599]">
            <History className="h-4.5 w-4.5" />
          </div>
          <div>
            <h2 className="font-display text-sm font-bold text-white">
              Global Settlements &amp; Winners Feed
            </h2>
            <p className="text-[11px] text-zinc-400">
              All markets &amp; timeframes with exact 10% Master Vault fee &amp; equal splits
            </p>
          </div>
        </div>

        <div className="space-y-2.5 max-h-[680px] overflow-y-auto pr-1">
          {globalRounds.map((r) => (
            <div
              key={r.roundId}
              className="rounded-xl border border-white/[0.06] bg-[#05070A] p-3.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-white text-xs">{r.symbol}</span>
                  <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px] text-zinc-300">
                    {r.timeframe}
                  </span>
                  <span className="font-mono text-[11px] text-zinc-500">
                    #{r.roundNumber}
                  </span>
                  <span
                    className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 font-mono text-[10px] font-bold ${
                      r.outcome === 'UP'
                        ? 'bg-[#00E599]/15 text-[#00E599]'
                        : r.outcome === 'DOWN'
                        ? 'bg-[#FF3B69]/15 text-[#FF3B69]'
                        : 'bg-white/10 text-zinc-300'
                    }`}
                  >
                    {r.outcome === 'UP' && <ArrowUpRight className="h-3 w-3" />}
                    {r.outcome === 'DOWN' && <ArrowDownRight className="h-3 w-3" />}
                    {r.outcome} WON
                  </span>
                </div>

                <span className="font-mono text-[11px] text-zinc-500">
                  {formatTimeShort(r.settledAt)}
                </span>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] tabular-nums">
                <span className="text-zinc-400">
                  Pool: <strong className="text-white">{formatUsd(r.totalPoolCents)}</strong>
                </span>
                <span className="text-[#F5B731]">
                  10% Vault: <strong>{formatUsd(r.masterFeeCents)}</strong>
                </span>
                <span className="text-[#00E599]">
                  Equal:{' '}
                  <strong>
                    {formatUsd(r.payoutPerWinnerCents)} × {r.winnerCount}
                  </strong>
                </span>
              </div>

              {r.winners.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <Crown className="h-3 w-3 text-[#F5B731]" />
                  {r.winners.map((w) => (
                    <span
                      key={w.betId}
                      className="rounded-full border border-[#00E599]/20 bg-[#00E599]/[0.07] px-2 py-0.5 text-[10px] text-zinc-200"
                    >
                      {w.username}{' '}
                      <strong className="font-mono text-[#00E599]">
                        +{formatUsd(w.payoutCents ?? r.payoutPerWinnerCents)}
                      </strong>
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
