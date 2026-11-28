import React, { useState } from 'react';
import {
  Check,
  Coins,
  Copy,
  Gem,
  Landmark,
  Layers,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import { MasterWalletSummary } from '../types';
import { formatTimeShort, formatUsd, shortenAddress } from '../utils/format';

interface MasterWalletViewProps {
  summary: MasterWalletSummary | null;
}

export const MasterWalletView: React.FC<MasterWalletViewProps> = ({
  summary,
}) => {
  const [copied, setCopied] = useState(false);

  if (!summary) {
    return (
      <div className="mx-auto max-w-[1680px] px-4 py-12 text-center text-sm text-subtle">
        Loading Master Vault treasury ledger...
      </div>
    );
  }

  const copyAddress = () => {
    navigator.clipboard?.writeText(summary.address).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const cryptoCat = summary.byCategory.find((c) => c.category === 'crypto');
  const commodityCat = summary.byCategory.find((c) => c.category === 'commodity');

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1680px] space-y-5 px-3 py-4 sm:px-4 sm:py-6 lg:px-6">
      {/* Liquid Gold Vault Hero */}
      <div className="surface-vault relative overflow-hidden rounded-xl p-4 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4 sm:gap-5">
          <div className="min-w-0 max-w-full">
            <div className="inline-flex max-w-full flex-wrap items-center gap-1.5 rounded-xl sm:rounded-full border border-gold/35 bg-gold/12 px-3 py-1 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-gold">
              <Landmark className="h-3.5 w-3.5 shrink-0" />
              <span>Master Treasury Vault · Predictions (10%) + Originals</span>
            </div>
            <h1 className="mt-3 font-mono text-3xl sm:text-5xl font-black tracking-tight text-fg tabular-nums">
              {formatUsd(summary.combinedTreasuryCents ?? summary.totalBalanceCents)}
            </h1>
            <p className="mt-2 max-w-2xl text-xs leading-relaxed text-fg2">
              Combines{' '}
              <strong className="text-gold">
                {formatUsd(summary.totalBalanceCents)}
              </strong>{' '}
              from Prediction Arena 10% pool deductions plus{' '}
              <strong className="text-accent">
                {formatUsd(summary.originals?.netHouseCents ?? 0, { showSign: true })}
              </strong>{' '}
              net house vault P/L across PULSE Originals (
              {summary.originals?.totalBetsCount ?? 0} bets,{' '}
              {formatUsd(summary.originals?.totalWageredCents ?? 0)} wagered).
            </p>
          </div>

          <div className="w-full sm:w-auto sm:min-w-[280px] rounded-xl border border-fg/10 bg-raised/90 p-3.5 sm:p-4">
            <div className="text-[10px] font-bold uppercase tracking-wider text-subtle">
              Master Treasury Address (Web3 Ready)
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-2">
              <code className="font-mono text-xs font-bold text-gold">
                {shortenAddress(summary.address)}
              </code>
              <button
                onClick={copyAddress}
                className="flex shrink-0 items-center gap-1 rounded-lg border border-fg/10 bg-fg/[0.05] px-2.5 py-1 text-[11px] font-semibold text-fg transition hover:bg-fg/10"
              >
                {copied ? (
                  <>
                    <Check className="h-3 w-3 text-accent" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    Copy
                  </>
                )}
              </button>
            </div>
            <div className="mt-1.5 font-mono text-[10px] text-subtle break-all sm:max-w-[300px]">
              {summary.address}
            </div>
          </div>
        </div>

        {/* Visual 90 / 10 Conservation Split Bar */}
        <div className="mt-5">
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-1 font-mono text-[10px] sm:text-[11px]">
            <span className="text-accent font-bold">
              90% WINNERS ({formatUsd(summary.totalDistributedCents)})
            </span>
            <span className="text-gold font-bold">
              10% VAULT ({formatUsd(summary.totalBalanceCents)})
            </span>
          </div>
          <div className="flex h-2 w-full overflow-hidden rounded-full bg-fg/[0.06] gap-[2px]">
            <div className="h-full w-[90%] rounded-l-full bg-accent" />
            <div className="h-full w-[10%] rounded-r-full bg-gold" />
          </div>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="surface-card rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-muted">
            <span>10% Fees Collected</span>
            <Landmark className="h-4 w-4 text-gold" />
          </div>
          <div className="mt-2 font-mono text-2xl font-extrabold text-gold tabular-nums">
            {formatUsd(summary.totalFeeCents)}
          </div>
          <div className="mt-1 text-[11px] text-subtle">
            + {formatUsd(summary.totalDustCents)} cent rounding dust
          </div>
        </div>

        <div className="surface-card rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-muted">
            <span>Total Pool Volume</span>
            <TrendingUp className="h-4 w-4 text-sky-400" />
          </div>
          <div className="mt-2 font-mono text-2xl font-extrabold text-fg tabular-nums">
            {formatUsd(summary.totalVolumeCents)}
          </div>
          <div className="mt-1 text-[11px] text-subtle">
            Across {summary.settledRoundsCount} settled candles
          </div>
        </div>

        <div className="surface-card rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-muted">
            <span>90% Paid to Winners</span>
            <ShieldCheck className="h-4 w-4 text-accent" />
          </div>
          <div className="mt-2 font-mono text-2xl font-extrabold text-accent tabular-nums">
            {formatUsd(summary.totalDistributedCents)}
          </div>
          <div className="mt-1 text-[11px] text-subtle">
            Zero-drift penny conservation
          </div>
        </div>

        <div className="surface-card rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-muted">
            <span>Asset Class Revenue</span>
            <Layers className="h-4 w-4 text-purple-400" />
          </div>
          <div className="mt-2 space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-fg2">
                <Coins className="h-3.5 w-3.5 text-accent" />
                Crypto ({cryptoCat?.roundsCount ?? 0} rds)
              </span>
              <span className="font-mono font-bold text-fg tabular-nums">
                {formatUsd(cryptoCat?.feeCents ?? 0)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-fg2">
                <Gem className="h-3.5 w-3.5 text-gold" />
                Commodities ({commodityCat?.roundsCount ?? 0} rds)
              </span>
              <span className="font-mono font-bold text-fg tabular-nums">
                {formatUsd(commodityCat?.feeCents ?? 0)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Revenue by Timeframe */}
      {summary.byTimeframe.length > 0 && (
        <div className="surface-card rounded-xl p-4">
          <h2 className="font-display text-xs font-bold uppercase tracking-[0.12em] text-muted">
            Vault Revenue by Timeframe
          </h2>
          <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-7">
            {summary.byTimeframe.map((tf) => (
              <div
                key={tf.timeframe}
                className="rounded-xl border border-fg/[0.06] bg-raised p-3"
              >
                <div className="font-mono text-xs font-bold text-fg uppercase">
                  {tf.timeframe}
                </div>
                <div className="mt-1 font-mono text-sm font-extrabold text-gold tabular-nums">
                  {formatUsd(tf.feeCents)}
                </div>
                <div className="mt-0.5 text-[10px] text-subtle">
                  {tf.roundsCount} rds · Vol {formatUsd(tf.volumeCents)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PULSE Originals House Vault Breakdown */}
      {summary.originals && summary.originals.totalBetsCount > 0 && (
        <div className="surface-card rounded-xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-sm font-bold text-fg">
                PULSE Originals House Vault (9 Stake-Style Games)
              </h2>
              <p className="text-xs text-muted">
                Server-authoritative provably-fair arcade volume &amp; net house P/L routed to Master Vault
              </p>
            </div>
            <div className="flex items-center gap-3 font-mono text-xs tabular-nums">
              <span className="text-muted">
                Wagered:{' '}
                <strong className="text-fg">
                  {formatUsd(summary.originals.totalWageredCents)}
                </strong>
              </span>
              <span className="text-muted">
                House P/L:{' '}
                <strong
                  className={
                    summary.originals.netHouseCents >= 0
                      ? 'text-accent'
                      : 'text-danger'
                  }
                >
                  {formatUsd(summary.originals.netHouseCents, { showSign: true })}
                </strong>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
            {summary.originals.byGame.map((g) => (
              <div
                key={g.game}
                className="rounded-xl border border-fg/[0.06] bg-raised p-3"
              >
                <div className="font-mono text-xs font-bold uppercase text-fg">
                  {g.game}
                </div>
                <div
                  className={`mt-1 font-mono text-sm font-extrabold tabular-nums ${
                    g.houseDeltaCents >= 0 ? 'text-accent' : 'text-danger'
                  }`}
                >
                  {formatUsd(g.houseDeltaCents, { showSign: true })}
                </div>
                <div className="mt-0.5 text-[10px] text-subtle">
                  {g.betsCount} bets · Vol {formatUsd(g.wageredCents)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Auditable 10% Ledger */}
      <div className="surface-card rounded-xl p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-sm font-bold text-fg">
              Master Vault 10% Fee Audit Ledger
            </h2>
            <p className="text-xs text-muted">
              Real-time immutable record verifying Total Pool = 10% Vault Fee + 90% Equal Winner Payouts.
            </p>
          </div>
          <span className="rounded-full border border-gold/30 bg-gold/10 px-3 py-1 font-mono text-xs font-bold text-gold">
            {summary.ledger.length} settlements
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-fg/[0.06] text-[10px] font-semibold uppercase tracking-wider text-subtle">
                <th className="py-2 pr-3">TX Ref / Time</th>
                <th className="py-2 px-2">Instrument</th>
                <th className="py-2 px-2 text-right">Total Pool</th>
                <th className="py-2 px-2 text-right text-gold">10% Vault Credit</th>
                <th className="py-2 px-2 text-right text-accent">90% Distributed</th>
                <th className="py-2 pl-2 text-right">Equal Payout</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-fg/[0.04]">
              {summary.ledger.map((row) => (
                <tr key={row.id} className="hover:bg-fg/[0.02]">
                  <td className="py-2.5 pr-3">
                    <div className="font-mono font-bold text-gold">{row.txRef}</div>
                    <div className="text-[10px] text-subtle">
                      {formatTimeShort(row.createdAt)} · #{row.roundNumber}
                    </div>
                  </td>
                  <td className="py-2.5 px-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-fg">{row.symbol}</span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                          row.category === 'commodity'
                            ? 'bg-gold/15 text-gold'
                            : 'bg-accent/15 text-accent'
                        }`}
                      >
                        {row.category}
                      </span>
                      <span className="rounded bg-fg/10 px-1.5 py-0.5 font-mono text-[10px] text-fg2">
                        {row.timeframe}
                      </span>
                    </div>
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono font-semibold text-fg tabular-nums">
                    {formatUsd(row.totalPoolCents)}
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono font-extrabold text-gold tabular-nums">
                    +{formatUsd(row.totalMasterCreditCents)}
                    {row.dustCents > 0 && (
                      <div className="text-[9px] font-normal text-gold/70">
                        incl. {formatUsd(row.dustCents)} dust
                      </div>
                    )}
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono font-semibold text-accent tabular-nums">
                    {formatUsd(row.distributableCents)}
                  </td>
                  <td className="py-2.5 pl-2 text-right font-mono text-fg tabular-nums">
                    {formatUsd(row.payoutPerWinnerCents)} × {row.winnerCount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
