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
    <div className="surface-card rounded-2xl p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1 rounded-xl border border-white/[0.06] bg-[#05070A] p-1">
          <button
            onClick={() => setTab('rounds')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
              tab === 'rounds'
                ? 'bg-white text-[#040507]'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <History className="h-3.5 w-3.5" />
            Settled Rounds ({recentRounds.length})
          </button>
          <button
            onClick={() => setTab('my_bets')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
              tab === 'my_bets'
                ? 'bg-white text-[#040507]'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Receipt className="h-3.5 w-3.5" />
            My Positions ({userBets.length})
          </button>
        </div>

        <span className="hidden sm:inline text-[11px] text-zinc-500">
          Expand any round to audit all players, equal payouts &amp; 10% vault TX
        </span>
      </div>

      {tab === 'rounds' ? (
        recentRounds.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 py-10 text-center text-xs text-zinc-500">
            No settled rounds yet for this timeframe. Watch the live candle settle above.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/[0.06] text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  <th className="py-2 pr-3">Round</th>
                  <th className="py-2 px-2">Outcome</th>
                  <th className="py-2 px-2">Strike → Close</th>
                  <th className="py-2 px-2 text-right">Players</th>
                  <th className="py-2 px-2 text-right">Pool</th>
                  <th className="py-2 px-2 text-right text-[#F5B731]">10% Vault</th>
                  <th className="py-2 px-2 text-right text-[#00E599]">Equal / Winner</th>
                  <th className="py-2 pl-2 text-right" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {recentRounds.map((r) => {
                  const expanded = expandedRoundId === r.roundId;
                  return (
                    <React.Fragment key={r.roundId}>
                      <tr
                        onClick={() =>
                          setExpandedRoundId(expanded ? null : r.roundId)
                        }
                        className="cursor-pointer transition hover:bg-white/[0.025]"
                      >
                        <td className="py-2.5 pr-3 font-mono font-bold text-white">
                          #{r.roundNumber}
                          <div className="text-[10px] font-normal text-zinc-500">
                            {formatTimeShort(r.settledAt)}
                          </div>
                        </td>
                        <td className="py-2.5 px-2">
                          <span
                            className={`inline-flex items-center gap-0.5 rounded-md px-2 py-0.5 font-mono text-[10px] font-bold ${
                              r.outcome === 'UP'
                                ? 'bg-[#00E599]/15 text-[#00E599]'
                                : r.outcome === 'DOWN'
                                ? 'bg-[#FF3B69]/15 text-[#FF3B69]'
                                : 'bg-white/10 text-zinc-300'
                            }`}
                          >
                            {r.outcome === 'UP' && <ArrowUpRight className="h-3 w-3" />}
                            {r.outcome === 'DOWN' && <ArrowDownRight className="h-3 w-3" />}
                            {r.outcome}
                          </span>
                        </td>
                        <td className="py-2.5 px-2 font-mono text-[11px] text-zinc-400 tabular-nums">
                          ${formatPrice(r.lockPrice, decimals)} →{' '}
                          <strong className="text-white">
                            ${formatPrice(r.closePrice, decimals)}
                          </strong>
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono text-zinc-300 tabular-nums">
                          {r.playerCount}{' '}
                          <span className="text-[10px] text-zinc-500">
                            ({r.winnerCount}W)
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono font-semibold text-white tabular-nums">
                          {formatUsd(r.totalPoolCents)}
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono font-semibold text-[#F5B731] tabular-nums">
                          {formatUsd(r.masterFeeCents)}
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono font-bold text-[#00E599] tabular-nums">
                          {r.winnerCount > 0
                            ? formatUsd(r.payoutPerWinnerCents)
                            : 'Refunded'}
                        </td>
                        <td className="py-2.5 pl-2 text-right text-zinc-500">
                          {expanded ? (
                            <ChevronUp className="ml-auto h-4 w-4" />
                          ) : (
                            <ChevronDown className="ml-auto h-4 w-4" />
                          )}
                        </td>
                      </tr>

                      {expanded && (
                        <tr>
                          <td colSpan={8} className="bg-[#05070A] p-3">
                            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-400">
                              <span>
                                Master Vault TX:{' '}
                                <strong className="font-mono text-[#F5B731]">
                                  {r.txRef}
                                </strong>
                              </span>
                              <span>
                                90% Pool:{' '}
                                <strong className="font-mono text-[#00E599]">
                                  {formatUsd(r.distributablePoolCents)}
                                </strong>{' '}
                                ÷ {r.winnerCount} winners ={' '}
                                <strong className="font-mono text-white">
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
                                        ? 'border-[#00E599]/30 bg-[#00E599]/[0.07]'
                                        : 'border-white/[0.05] bg-white/[0.02]'
                                    }`}
                                  >
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <span
                                        className="h-2 w-2 shrink-0 rounded-full"
                                        style={{ backgroundColor: p.avatarColor }}
                                      />
                                      <span className="truncate font-semibold text-white">
                                        {p.username}
                                        {isMe ? ' (YOU)' : ''}
                                      </span>
                                      <span
                                        className={`font-mono text-[10px] font-bold ${
                                          p.direction === 'UP'
                                            ? 'text-[#00E599]'
                                            : 'text-[#FF3B69]'
                                        }`}
                                      >
                                        {p.direction}
                                      </span>
                                    </div>
                                    <span
                                      className={`font-mono font-bold tabular-nums ${
                                        p.status === 'WON'
                                          ? 'text-[#00E599]'
                                          : p.status === 'REFUNDED'
                                          ? 'text-sky-300'
                                          : 'text-zinc-600'
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
        <div className="rounded-xl border border-dashed border-white/10 py-10 text-center text-xs text-zinc-500">
          No predictions placed yet. Use the ticket on the right to enter the next candle.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/[0.06] text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                <th className="py-2 pr-3">Instrument</th>
                <th className="py-2 px-2">Side</th>
                <th className="py-2 px-2 text-right">Stake</th>
                <th className="py-2 px-2 text-right">Status</th>
                <th className="py-2 pl-2 text-right">Payout</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {userBets.map((b) => (
                <tr key={b.betId} className="hover:bg-white/[0.02]">
                  <td className="py-2.5 pr-3">
                    <div className="font-bold text-white">
                      {b.symbol}{' '}
                      <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px] text-zinc-300">
                        {b.timeframe}
                      </span>{' '}
                      <span className="font-mono text-zinc-500">
                        #{b.roundNumber}
                      </span>
                    </div>
                    <div className="text-[10px] text-zinc-500">
                      {formatTimeShort(b.createdAt)}
                    </div>
                  </td>
                  <td className="py-2.5 px-2">
                    <span
                      className={`rounded px-2 py-0.5 font-mono text-[10px] font-bold ${
                        b.direction === 'UP'
                          ? 'bg-[#00E599]/15 text-[#00E599]'
                          : 'bg-[#FF3B69]/15 text-[#FF3B69]'
                      }`}
                    >
                      {b.direction}
                    </span>
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono text-zinc-200 tabular-nums">
                    {formatUsd(b.stakeCents)}
                  </td>
                  <td className="py-2.5 px-2 text-right">
                    <span
                      className={`rounded px-2 py-0.5 font-mono text-[10px] font-bold uppercase ${
                        b.status === 'WON'
                          ? 'bg-[#00E599]/20 text-[#00E599]'
                          : b.status === 'LOST'
                          ? 'bg-[#FF3B69]/15 text-[#FF3B69]'
                          : b.status === 'REFUNDED'
                          ? 'bg-sky-500/15 text-sky-300'
                          : 'bg-[#F5B731]/15 text-[#F5B731]'
                      }`}
                    >
                      {b.status}
                    </span>
                  </td>
                  <td
                    className={`py-2.5 pl-2 text-right font-mono font-bold tabular-nums ${
                      b.status === 'WON'
                        ? 'text-[#00E599]'
                        : b.status === 'REFUNDED'
                        ? 'text-sky-300'
                        : b.status === 'LOST'
                        ? 'text-zinc-600'
                        : 'text-zinc-300'
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
