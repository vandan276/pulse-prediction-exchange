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
      <div className="surface-card min-w-0 rounded-xl p-4 sm:p-5 lg:col-span-5">
        <div className="mb-4 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gold/15 text-gold">
            <Trophy className="h-4.5 w-4.5" />
          </div>
          <div>
            <h2 className="font-display text-sm font-bold text-fg">
              Top Predictors
            </h2>
            <p className="text-[11px] text-muted">
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
                    ? 'border-accent/40 bg-accent/[0.08]'
                    : 'border-fg/[0.05] bg-raised'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg font-mono text-xs font-black ${
                      idx === 0
                        ? 'bg-gold text-[#1A1300]'
                        : idx === 1
                        ? 'bg-muted text-inverse'
                        : idx === 2
                        ? 'bg-amber-700 text-fg'
                        : 'bg-fg/[0.06] text-muted'
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <div
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold text-onaccent"
                    style={{ backgroundColor: player.avatarColor }}
                  >
                    {player.username.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-xs font-bold text-fg">
                        {player.username}
                      </span>
                      {isMe && (
                        <span className="rounded bg-accent px-1.5 py-0.2 text-[9px] font-black text-onaccent">
                          YOU
                        </span>
                      )}
                      {player.isBot && <Bot className="h-3 w-3 text-subtle" />}
                    </div>
                    <div className="font-mono text-[10px] text-subtle tabular-nums">
                      {player.totalWins}/{player.totalBets} wins ({player.winRate}%)
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div
                    className={`font-mono text-xs font-extrabold tabular-nums ${
                      player.netProfitCents >= 0 ? 'text-accent' : 'text-danger'
                    }`}
                  >
                    {formatUsd(player.netProfitCents, { showSign: true })}
                  </div>
                  <div className="font-mono text-[10px] text-subtle tabular-nums">
                    Won {formatUsd(player.totalWonCents)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Global Settled Rounds Feed */}
      <div className="surface-card rounded-xl p-5 lg:col-span-7">
        <div className="mb-4 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-fg/[0.06] text-accent">
            <History className="h-4.5 w-4.5" />
          </div>
          <div>
            <h2 className="font-display text-sm font-bold text-fg">
              Global Settlements &amp; Winners Feed
            </h2>
            <p className="text-[11px] text-muted">
              All markets &amp; timeframes with exact 10% Master Vault fee &amp; equal splits
            </p>
          </div>
        </div>

        <div className="space-y-2.5 max-h-[680px] overflow-y-auto pr-1">
          {globalRounds.map((r) => (
            <div
              key={r.roundId}
              className="rounded-xl border border-fg/[0.06] bg-raised p-3.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-fg text-xs">{r.symbol}</span>
                  <span className="rounded bg-fg/10 px-1.5 py-0.5 font-mono text-[10px] text-fg2">
                    {r.timeframe}
                  </span>
                  <span className="font-mono text-[11px] text-subtle">
                    #{r.roundNumber}
                  </span>
                  <span
                    className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 font-mono text-[10px] font-bold ${
                      r.outcome === 'UP'
                        ? 'bg-accent/15 text-accent'
                        : r.outcome === 'DOWN'
                        ? 'bg-danger/15 text-danger'
                        : 'bg-fg/10 text-fg2'
                    }`}
                  >
                    {r.outcome === 'UP' && <ArrowUpRight className="h-3 w-3" />}
                    {r.outcome === 'DOWN' && <ArrowDownRight className="h-3 w-3" />}
                    {r.outcome} WON
                  </span>
                </div>

                <span className="font-mono text-[11px] text-subtle">
                  {formatTimeShort(r.settledAt)}
                </span>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] tabular-nums">
                <span className="text-muted">
                  Pool: <strong className="text-fg">{formatUsd(r.totalPoolCents)}</strong>
                </span>
                <span className="text-gold">
                  10% Vault: <strong>{formatUsd(r.masterFeeCents)}</strong>
                </span>
                <span className="text-accent">
                  Equal:{' '}
                  <strong>
                    {formatUsd(r.payoutPerWinnerCents)} × {r.winnerCount}
                  </strong>
                </span>
              </div>

              {r.winners.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <Crown className="h-3 w-3 text-gold" />
                  {r.winners.map((w) => (
                    <span
                      key={w.betId}
                      className="rounded-full border border-accent/20 bg-accent/[0.07] px-2 py-0.5 text-[10px] text-fg"
                    >
                      {w.username}{' '}
                      <strong className="font-mono text-accent">
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
