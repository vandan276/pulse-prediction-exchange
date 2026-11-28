import React, { useMemo, useState } from 'react';
import { Flame, Search, Users } from 'lucide-react';
import { GlobalStats, MarketCategory, MarketTicker } from '../types';
import { formatPrice } from '../utils/format';

interface MarketRailProps {
  tickers: MarketTicker[];
  selectedSymbol: string;
  onSelectSymbol: (symbol: string) => void;
  globalStats: GlobalStats | null;
}

const MiniSparkline: React.FC<{ data?: number[]; positive: boolean }> = ({
  data,
  positive,
}) => {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 52;
  const h = 20;
  const pts = data
    .map((val, idx) => {
      const x = (idx / (data.length - 1)) * w;
      const y = h - 2 - ((val - min) / range) * (h - 4);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      <polyline
        fill="none"
        stroke={positive ? '#00C853' : '#FF4E4E'}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={pts}
        opacity="0.9"
      />
    </svg>
  );
};

export const MarketRail: React.FC<MarketRailProps> = ({
  tickers,
  selectedSymbol,
  onSelectSymbol,
  globalStats,
}) => {
  const [filter, setFilter] = useState<'all' | MarketCategory>('all');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tickers.filter((t) => {
      if (filter !== 'all' && t.category !== filter) return false;
      if (
        q &&
        !t.symbol.toLowerCase().includes(q) &&
        !t.name.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [tickers, filter, query]);

  return (
    <>
      {/* Mobile / Tablet Compact Horizontal Ticker Strip (< xl) */}
      <div className="2xl:hidden border-b border-line/60 bg-sidebar px-3 sm:px-5 py-2.5">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-fg/[0.07] bg-fg/[0.02] p-0.5">
            {(['all', 'crypto', 'commodity'] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setFilter(cat)}
                className={`rounded-md px-2.5 py-1 text-[11px] font-semibold capitalize transition ${
                  filter === cat
                    ? 'bg-fg text-inverse'
                    : 'text-muted hover:text-fg'
                }`}
              >
                {cat === 'commodity' ? 'Commodities' : cat}
              </button>
            ))}
          </div>
          <span className="font-mono text-[11px] text-muted">
            Active Pools:{' '}
            <strong className="text-fg">
              ${Math.round((globalStats?.totalActivePoolCents ?? 0) / 100).toLocaleString()}
            </strong>
          </span>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {filtered.map((t) => {
            const active = t.symbol === selectedSymbol;
            const up = t.changePercent >= 0;
            const players = globalStats?.byMarket?.[t.symbol] ?? 0;
            return (
              <button
                key={t.symbol}
                onClick={() => onSelectSymbol(t.symbol)}
                className={`flex min-w-[152px] shrink-0 flex-col rounded-xl border px-3 py-2 text-left transition ${
                  active
                    ? 'border-accent/50 bg-accent/[0.08]'
                    : 'border-fg/[0.06] bg-surface hover:border-fg/15'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-fg">{t.symbol}</span>
                  <span className="font-mono text-[10px] text-muted flex items-center gap-0.5">
                    <Users className="h-2.5 w-2.5 text-accent" />
                    {players}
                  </span>
                </div>
                <div className="mt-1 flex items-baseline justify-between gap-2">
                  <span className="font-mono text-xs font-bold text-fg tabular-nums">
                    ${formatPrice(t.price, t.decimals)}
                  </span>
                  <span
                    className={`font-mono text-[10px] font-semibold tabular-nums ${
                      up ? 'text-accent' : 'text-danger'
                    }`}
                  >
                    {up ? '+' : ''}
                    {t.changePercent.toFixed(2)}%
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Desktop Pro Watchlist Rail (xl+) */}
      <aside className="hidden 2xl:flex 2xl:w-[264px] shrink-0 flex-col surface-card rounded-xl overflow-hidden h-[calc(100vh-112px)] sticky top-[100px]">
        <div className="p-3 border-b border-fg/[0.06] space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="font-display text-xs font-bold uppercase tracking-[0.12em] text-fg2">
              Markets
            </span>
            <span className="flex items-center gap-1 font-mono text-[10px] text-muted">
              <Flame className="h-3 w-3 text-gold" />$
              {Math.round((globalStats?.totalActivePoolCents ?? 0) / 100).toLocaleString()} live
            </span>
          </div>

          {/* Segmented Category Pill */}
          <div className="grid grid-cols-3 gap-1 rounded-lg bg-raised p-1 border border-fg/[0.06]">
            <button
              onClick={() => setFilter('all')}
              className={`rounded-md py-1 text-[11px] font-semibold transition ${
                filter === 'all'
                  ? 'bg-fg text-inverse'
                  : 'text-muted hover:text-fg'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('crypto')}
              className={`rounded-md py-1 text-[11px] font-semibold transition ${
                filter === 'crypto'
                  ? 'bg-accent text-onaccent'
                  : 'text-muted hover:text-fg'
              }`}
            >
              Crypto
            </button>
            <button
              onClick={() => setFilter('commodity')}
              className={`rounded-md py-1 text-[11px] font-semibold transition ${
                filter === 'commodity'
                  ? 'bg-gold text-[#1A1300]'
                  : 'text-muted hover:text-fg'
              }`}
            >
              Cmdty
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-subtle" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter pairs..."
              className="w-full rounded-lg border border-fg/[0.06] bg-raised py-1.5 pl-8 pr-2.5 text-xs text-fg placeholder-subtle outline-none focus:border-fg/20"
            />
          </div>
        </div>

        {/* Market Rows */}
        <div className="flex-1 overflow-y-auto divide-y divide-fg/[0.04]">
          {filtered.map((t) => {
            const active = t.symbol === selectedSymbol;
            const up = t.changePercent >= 0;
            const players = globalStats?.byMarket?.[t.symbol] ?? 0;

            return (
              <button
                key={t.symbol}
                onClick={() => onSelectSymbol(t.symbol)}
                className={`relative flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left transition-all ${
                  active
                    ? 'bg-fg/[0.055]'
                    : 'hover:bg-fg/[0.025]'
                }`}
              >
                {active && (
                  <span
                    className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full"
                    style={{
                      backgroundColor:
                        t.category === 'commodity' ? '#FFC800' : '#00C853',
                    }}
                  />
                )}

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{ backgroundColor: t.accent }}
                    />
                    <span className="text-xs font-bold text-fg truncate">
                      {t.symbol}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-subtle">
                    <span className="truncate max-w-[72px]">{t.name}</span>
                    <span className="inline-flex items-center gap-0.5 font-mono text-muted">
                      <Users className="h-2.5 w-2.5 text-accent" />
                      {players}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <MiniSparkline data={t.sparkline} positive={up} />
                  <div className="text-right min-w-[68px]">
                    <div className="font-mono text-xs font-bold text-fg tabular-nums">
                      ${formatPrice(t.price, t.decimals)}
                    </div>
                    <div
                      className={`font-mono text-[10px] font-semibold tabular-nums ${
                        up ? 'text-accent' : 'text-danger'
                      }`}
                    >
                      {up ? '+' : ''}
                      {t.changePercent.toFixed(2)}%
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </aside>
    </>
  );
};
