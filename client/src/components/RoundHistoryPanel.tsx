import React, { useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  History,
  Receipt,
} from 'lucide-react';
import { SettledRound, UserBetRecord } from '../types';
import { formatPrice, formatTimeShort, formatUsd } from '../utils/format';

interface RoundHistoryPanelProps {
  recentRounds: SettledRound[];
  userBets: UserBetRecord[];
  decimals: number;
  userId?: string;
}

export const RoundHistoryPanel: React.FC<RoundHistoryPanelProps> = ({
  recentRounds,
  userBets,
  decimals,
  userId,
}) => {
  const [tab, setTab] = useState<'rounds' | 'my_bets'>('rounds');
  const [expandedRoundId, setExpandedRoundId] = useState<string | null>(null);

  return (
    <div className="surface-card rounded-xl p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1 rounded-xl border border-fg/[0.06] bg-raised p-1">
          <button
            onClick={() => setTab('rounds')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
              tab === 'rounds'
                ? 'bg-fg text-inverse'
                : 'text-muted hover:text-fg'
            }`}
          >
            <History className="h-3.5 w-3.5" />
            Settled Rounds ({recentRounds.length})
          </button>
          <button
            onClick={() => setTab('my_bets')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
              tab === 'my_bets'
                ? 'bg-fg text-inverse'
                : 'text-muted hover:text-fg'
            }`}
          >
            <Receipt className="h-3.5 w-3.5" />
            My Positions ({userBets.length})
          </button>
        </div>

        <span className="hidden sm:inline text-[11px] text-subtle">
          Expand any round to audit all players, equal payouts &amp; 10% vault TX
        </span>
      </div>

      {tab === 'rounds' ? (
        recentRounds.length === 0 ? (
          <div className="rounded-xl border border-dashed border-fg/10 py-10 text-center text-xs text-subtle">
            No settled rounds yet for this timeframe. Watch the live candle settle above.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-fg/[0.06] text-[10px] font-semibold uppercase tracking-wider text-subtle">
                  <th className="py-2 pr-3">Round</th>
                  <th className="py-2 px-2">Outcome</th>
                  <th className="py-2 px-2">Strike → Close</th>
                  <th className="py-2 px-2 text-right">Players</th>
                  <th className="py-2 px-2 text-right">Pool</th>
                  <th className="py-2 px-2 text-right text-gold">10% Vault</th>
                  <th className="py-2 px-2 text-right text-accent">Equal / Winner</th>
                  <th className="py-2 pl-2 text-right" />
                </tr>
              </thead>
              <tbody className="divide-y divide-fg/[0.04]">
                {recentRounds.map((r) => {
                  const expanded = expandedRoundId === r.roundId;
                  return (
                    <React.Fragment key={r.roundId}>
                      <tr
                        onClick={() =>
                          setExpandedRoundId(expanded ? null : r.roundId)
                        }
                        className="cursor-pointer transition hover:bg-fg/[0.025]"
                      >
                        <td className="py-2.5 pr-3 font-mono font-bold text-fg">
                          #{r.roundNumber}
                          <div className="text-[10px] font-normal text-subtle">
                            {formatTimeShort(r.settledAt)}
                          </div>
                        </td>
                        <td className="py-2.5 px-2">
                          <span
                            className={`inline-flex items-center gap-0.5 rounded-md px-2 py-0.5 font-mono text-[10px] font-bold ${
                              r.outcome === 'UP'
                                ? 'bg-accent/15 text-accent'
                                : r.outcome === 'DOWN'
                                ? 'bg-danger/15 text-danger'
                                : 'bg-fg/10 text-fg2'
                            }`}
                          >
                            {r.outcome === 'UP' && <ArrowUpRight className="h-3 w-3" />}
                            {r.outcome === 'DOWN' && <ArrowDownRight className="h-3 w-3" />}
                            {r.outcome}
                          </span>
                        </td>
                        <td className="py-2.5 px-2 font-mono text-[11px] text-muted tabular-nums">
                          ${formatPrice(r.lockPrice, decimals)} →{' '}
                          <strong className="text-fg">
                            ${formatPrice(r.closePrice, decimals)}
                          </strong>
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono text-fg2 tabular-nums">
                          {r.playerCount}{' '}
                          <span className="text-[10px] text-subtle">
                            ({r.winnerCount}W)
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono font-semibold text-fg tabular-nums">
                          {formatUsd(r.totalPoolCents)}
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono font-semibold text-gold tabular-nums">
                          {formatUsd(r.masterFeeCents)}
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono font-bold text-accent tabular-nums">
                          {r.winnerCount > 0
                            ? formatUsd(r.payoutPerWinnerCents)
                            : 'Refunded'}
                        </td>
                        <td className="py-2.5 pl-2 text-right text-subtle">
                          {expanded ? (
                            <ChevronUp className="ml-auto h-4 w-4" />
                          ) : (
                            <ChevronDown className="ml-auto h-4 w-4" />
                          )}
                        </td>
                      </tr>

                      {expanded && (
                        <tr>
                          <td colSpan={8} className="bg-raised p-3">
                            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted">
                              <span>
                                Master Vault TX:{' '}
                                <strong className="font-mono text-gold">
                                  {r.txRef}
                                </strong>
                              </span>
                              <span>
                                90% Pool:{' '}
                                <strong className="font-mono text-accent">
                                  {formatUsd(r.distributablePoolCents)}
                                </strong>{' '}
                                ÷ {r.winnerCount} winners ={' '}
                                <strong className="font-mono text-fg">
                                  {formatUsd(r.payoutPerWinnerCents)}
                                </strong>{' '}
                                ea
                              </span>
                            </div>
                            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 md:grid-cols-3">
                              {r.players.map((p) => {
                                const isMe = userId != null && p.userId === userId;
                                return (
                                  <div
                                    key={p.betId}
                                    className={`flex items-center justify-between rounded-lg border px-2.5 py-1.5 text-[11px] ${
                                      p.status === 'WON'
                                        ? 'border-accent/30 bg-accent/[0.07]'
                                        : 'border-fg/[0.05] bg-fg/[0.02]'
                                    }`}
                                  >
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <span
                                        className="h-2 w-2 shrink-0 rounded-full"
                                        style={{ backgroundColor: p.avatarColor }}
                                      />
                                      <span className="truncate font-semibold text-fg">
                                        {p.username}
                                        {isMe ? ' (YOU)' : ''}
                                      </span>
                                      <span
                                        className={`font-mono text-[10px] font-bold ${
                                          p.direction === 'UP'
                                            ? 'text-accent'
                                            : 'text-danger'
                                        }`}
                                      >
                                        {p.direction}
                                      </span>
                                    </div>
                                    <span
                                      className={`font-mono font-bold tabular-nums ${
                                        p.status === 'WON'
                                          ? 'text-accent'
                                          : p.status === 'REFUNDED'
                                          ? 'text-sky-300'
                                          : 'text-subtle'
                                      }`}
                                    >
                                      {p.status === 'WON'
                                        ? `+${formatUsd(p.payoutCents ?? 0)}`
                                        : p.status === 'REFUNDED'
                                        ? 'REFUND'
                                        : `-${formatUsd(p.stakeCents)}`}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      ) : userBets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-fg/10 py-10 text-center text-xs text-subtle">
          No predictions placed yet. Use the ticket on the right to enter the next candle.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-fg/[0.06] text-[10px] font-semibold uppercase tracking-wider text-subtle">
                <th className="py-2 pr-3">Instrument</th>
                <th className="py-2 px-2">Side</th>
                <th className="py-2 px-2 text-right">Stake</th>
                <th className="py-2 px-2 text-right">Status</th>
                <th className="py-2 pl-2 text-right">Payout</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-fg/[0.04]">
              {userBets.map((b) => (
                <tr key={b.betId} className="hover:bg-fg/[0.02]">
                  <td className="py-2.5 pr-3">
                    <div className="font-bold text-fg">
                      {b.symbol}{' '}
                      <span className="rounded bg-fg/10 px-1.5 py-0.5 font-mono text-[10px] text-fg2">
                        {b.timeframe}
                      </span>{' '}
                      <span className="font-mono text-subtle">
                        #{b.roundNumber}
                      </span>
                    </div>
                    <div className="text-[10px] text-subtle">
                      {formatTimeShort(b.createdAt)}
                    </div>
                  </td>
                  <td className="py-2.5 px-2">
                    <span
                      className={`rounded px-2 py-0.5 font-mono text-[10px] font-bold ${
                        b.direction === 'UP'
                          ? 'bg-accent/15 text-accent'
                          : 'bg-danger/15 text-danger'
                      }`}
                    >
                      {b.direction}
                    </span>
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono text-fg tabular-nums">
                    {formatUsd(b.stakeCents)}
                  </td>
                  <td className="py-2.5 px-2 text-right">
                    <span
                      className={`rounded px-2 py-0.5 font-mono text-[10px] font-bold uppercase ${
                        b.status === 'WON'
                          ? 'bg-accent/20 text-accent'
                          : b.status === 'LOST'
                          ? 'bg-danger/15 text-danger'
                          : b.status === 'REFUNDED'
                          ? 'bg-sky-500/15 text-sky-300'
                          : 'bg-gold/15 text-gold'
                      }`}
                    >
                      {b.status}
                    </span>
                  </td>
                  <td
                    className={`py-2.5 pl-2 text-right font-mono font-bold tabular-nums ${
                      b.status === 'WON'
                        ? 'text-accent'
                        : b.status === 'REFUNDED'
                        ? 'text-sky-300'
                        : b.status === 'LOST'
                        ? 'text-subtle'
                        : 'text-fg2'
                    }`}
                  >
                    {b.status === 'PENDING'
                      ? 'Active'
                      : b.payoutCents > 0
                      ? `+${formatUsd(b.payoutCents)}`
                      : '$0.00'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
