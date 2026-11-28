import React, { useMemo } from 'react';
import { Flame } from 'lucide-react';
import { OriginalBetRecord, SettledRound } from '../types';
import { formatUsd } from '../utils/format';

interface LiveWinsTickerProps {
  originalsRecentBets: OriginalBetRecord[];
  globalRounds: SettledRound[];
  lastSettled?: SettledRound | null;
}

interface TickerEntry {
  key: string;
  badge: string;
  text: string;
  highlight: string;
  tone: 'emerald' | 'gold' | 'purple';
}

export const LiveWinsTicker: React.FC<LiveWinsTickerProps> = ({
  originalsRecentBets,
  globalRounds,
  lastSettled,
}) => {
  const entries = useMemo<TickerEntry[]>(() => {
    const items: TickerEntry[] = [];

    for (const bet of originalsRecentBets) {
      if (bet.payoutCents > 0) {
        const gameLabel = bet.game.charAt(0).toUpperCase() + bet.game.slice(1);
        items.push({
          key: `orig_${bet.id}`,
          badge: gameLabel.toUpperCase(),
          text: `${bet.username} won`,
          highlight: `${formatUsd(bet.payoutCents)} (${Number(bet.multiplier).toFixed(2)}x)`,
          tone: bet.multiplier >= 5 ? 'gold' : 'emerald',
        });
      }
      if (items.length >= 10) break;
    }

    const roundsPool: SettledRound[] = [];
    if (lastSettled) roundsPool.push(lastSettled);
    for (const r of globalRounds) {
      if (!roundsPool.some((x) => x.roundId === r.roundId)) {
        roundsPool.push(r);
      }
    }

    if (items.length < 6) {
      for (const r of roundsPool) {
        if (r.winnerCount > 0 && r.payoutPerWinnerCents > 0) {
          items.push({
            key: `rnd_${r.roundId}`,
            badge: `${r.symbol} ${r.timeframe}`,
            text: `#${r.roundNumber}: ${r.winnerCount} winners ·`,
            highlight: `${formatUsd(r.payoutPerWinnerCents)} each`,
            tone: 'purple',
          });
        }
        if (items.length >= 12) break;
      }
    }

    return items;
  }, [originalsRecentBets, globalRounds, lastSettled]);

  if (entries.length === 0) return null;

  const looped = [...entries, ...entries];

  return (
    <div className="live-wins-bar marquee-wrap relative z-30 h-[30px] w-full overflow-hidden flex items-center">
      <div className="marquee-track flex items-center gap-6 px-4 text-[11px]">
        {looped.map((item, idx) => (
          <div
            key={`${item.key}_${idx}`}
            className="flex shrink-0 items-center gap-1.5 whitespace-nowrap"
          >
            <Flame
              className={`h-3 w-3 shrink-0 ${
                item.tone === 'gold'
                  ? 'text-gold'
                  : item.tone === 'purple'
                  ? 'text-gold'
                  : 'text-accent'
              }`}
            />
            <span className="rounded bg-fg/[0.08] px-1.5 py-0.2 font-mono text-[9px] font-bold tracking-wide text-fg2">
              {item.badge}
            </span>
            <span className="font-medium text-fg2">{item.text}</span>
            <span
              className={`font-mono font-extrabold tabular-nums ${
                item.tone === 'gold'
                  ? 'text-gold'
                  : item.tone === 'purple'
                  ? 'text-accent'
                  : 'text-accent'
              }`}
            >
              {item.highlight}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
