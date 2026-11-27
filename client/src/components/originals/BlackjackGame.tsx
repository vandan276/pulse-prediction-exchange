import React, { useState } from 'react';
import {
  CopyPlus,
  Hand,
  Layers,
  PlusCircle,
  ShieldCheck,
  Spade,
} from 'lucide-react';
import { ToastItem, UserProfile } from '../../types';
import { formatUsd } from '../../utils/format';
import { StakeInput } from './BetControls';

interface Card {
  suit: 'spades' | 'hearts' | 'diamonds' | 'clubs';
  rank: string;
  value: number;
}

interface BlackjackHand {
  cards: Card[];
  stakeCents: number;
  doubled: boolean;
  status: 'ACTIVE' | 'STOOD' | 'BUSTED' | 'SETTLED';
  outcome: 'BLACKJACK' | 'WIN' | 'PUSH' | 'LOSE' | 'BUST' | null;
  payoutCents: number;
  total: number;
  isSoft: boolean;
  isBlackjack: boolean;
  isBust: boolean;
}

export interface BlackjackSession {
  sessionId: string;
  status: 'ACTIVE' | 'SETTLED';
  activeHandIndex: number;
  totalStakeCents: number;
  totalPayoutCents: number;
  dealerCards: Card[];
  dealerHoleHidden: boolean;
  dealerTotal: number;
  dealerIsSoft: boolean;
  hands: BlackjackHand[];
  canHit: boolean;
  canStand: boolean;
  canDouble: boolean;
  canSplit: boolean;
}

interface BlackjackGameProps {
  user: UserProfile | null;
  initialSession: BlackjackSession | null;
  onUserUpdated: (user: UserProfile) => void;
  onToast: (title: string, subtitle: string | undefined, tone: ToastItem['tone']) => void;
  onOpenUserModal: () => void;
}

const SUIT_SYMBOL: Record<Card['suit'], string> = {
  spades: '♠',
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
};

const PlayingCardView: React.FC<{ card?: Card; hidden?: boolean; index: number }> = ({
  card,
  hidden = false,
  index,
}) => {
  if (hidden || !card) {
    return (
      <div
        className="relative flex h-28 w-20 sm:h-32 sm:w-24 shrink-0 items-center justify-center rounded-xl border-2 border-[#059669]/50 bg-gradient-to-br from-[#064E3B] via-[#0F172A] to-[#022C22] shadow-lg transition-transform"
        style={{ marginLeft: index > 0 ? '-20px' : '0px' }}
      >
        <div className="flex h-[82%] w-[82%] items-center justify-center rounded-lg border border-[#00E599]/35 bg-[#00E599]/10">
          <Spade className="h-7 w-7 text-[#00E599]" />
        </div>
      </div>
    );
  }

  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
  const sym = SUIT_SYMBOL[card.suit];

  return (
    <div
      className="relative flex h-28 w-20 sm:h-32 sm:w-24 shrink-0 flex-col justify-between rounded-xl border border-slate-300 bg-white p-2.5 shadow-[0_10px_24px_-10px_rgba(15,23,42,0.35)] transition-transform hover:-translate-y-1"
      style={{
        marginLeft: index > 0 ? '-20px' : '0px',
        backgroundColor: '#FFFFFF',
      }}
    >
      <div
        className={`flex flex-col items-start leading-none font-mono font-bold ${
          isRed ? 'text-[#E11D48]' : 'text-[#0F172A]'
        }`}
        style={{ color: isRed ? '#E11D48' : '#0F172A' }}
      >
        <span className="text-base sm:text-lg">{card.rank}</span>
        <span className="text-sm">{sym}</span>
      </div>

      <div
        className="self-center text-3xl sm:text-4xl leading-none select-none"
        style={{ color: isRed ? '#E11D48' : '#0F172A' }}
      >
        {sym}
      </div>

      <div
        className="flex flex-col items-end leading-none font-mono font-bold rotate-180"
        style={{ color: isRed ? '#E11D48' : '#0F172A' }}
      >
        <span className="text-sm">{card.rank}</span>
      </div>
    </div>
  );
};

export const BlackjackGame: React.FC<BlackjackGameProps> = ({
  user,
  initialSession,
  onUserUpdated,
  onToast,
  onOpenUserModal,
}) => {
  const [stakeDollars, setStakeDollars] = useState('10');
  const [session, setSession] = useState<BlackjackSession | null>(initialSession);
  const [busy, setBusy] = useState(false);

  const isActive = session?.status === 'ACTIVE';

  const notifySettlement = (settled: BlackjackSession) => {
    const outcomes = settled.hands.map((h) => h.outcome).join(' / ');
    if (settled.totalPayoutCents > settled.totalStakeCents) {
      onToast(
        `BLACKJACK ${outcomes}!`,
        `Won ${formatUsd(settled.totalPayoutCents)} (Dealer ${settled.dealerTotal})`,
        'emerald'
      );
    } else if (settled.totalPayoutCents === settled.totalStakeCents && settled.totalStakeCents > 0) {
      onToast(
        'BLACKJACK PUSH',
        `Stake ${formatUsd(settled.totalPayoutCents)} returned (Dealer ${settled.dealerTotal})`,
        'sky'
      );
    } else {
      onToast(
        `Dealer Wins (${settled.dealerTotal})`,
        `Hand ended: ${outcomes}`,
        'rose'
      );
    }
  };

  const dealHand = async () => {
    if (!user) return onOpenUserModal();
    setBusy(true);
    try {
      const stakeCents = Math.round((parseFloat(stakeDollars) || 0) * 100);
      const res = await fetch('/api/originals/blackjack/deal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, stakeCents }),
      });
      const data = await res.json();
      if (!res.ok) {
        onToast('Blackjack', data.error || 'Could not deal hand', 'amber');
        return;
      }
      if (data.user) onUserUpdated(data.user);
      setSession(data.session);
      if (data.session?.status === 'SETTLED') {
        notifySettlement(data.session);
      }
    } finally {
      setBusy(false);
    }
  };

  const sendAction = async (action: 'hit' | 'stand' | 'double' | 'split') => {
    if (!user || !isActive || busy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/originals/blackjack/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, action }),
      });
      const data = await res.json();
      if (!res.ok) {
        onToast('Blackjack', data.error || 'Action unavailable', 'amber');
        return;
      }
      if (data.user) onUserUpdated(data.user);
      setSession(data.session);
      if (data.session?.status === 'SETTLED') {
        notifySettlement(data.session);
      }
    } finally {
      setBusy(false);
    }
  };

  const outcomeBadge = (outcome: BlackjackHand['outcome']) => {
    if (!outcome) return null;
    const styles =
      outcome === 'BLACKJACK'
        ? 'bg-[#F5B731] text-[#040507]'
        : outcome === 'WIN'
        ? 'bg-[#00E599] text-[#040507]'
        : outcome === 'PUSH'
        ? 'bg-sky-400 text-[#040507]'
        : 'bg-[#FF3B69] keep-white text-white';
    return (
      <span className={`rounded-full px-2.5 py-0.5 font-mono text-[10px] font-black uppercase ${styles}`}>
        {outcome}
      </span>
    );
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      {/* Left Bet & Action Controls */}
      <div className="surface-card order-2 lg:order-1 rounded-2xl p-4 lg:col-span-4 space-y-4">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 font-display text-sm font-bold text-white">
            <Spade className="h-4 w-4 text-[#00E599]" />
            BLACKJACK
          </span>
          <span className="rounded-full bg-[#00E599]/15 px-2 py-0.5 font-mono text-[10px] font-bold text-[#00E599]">
            99.5% RTP · 3:2
          </span>
        </div>

        <StakeInput
          stakeDollars={stakeDollars}
          onChange={setStakeDollars}
          balanceCents={user?.balanceCents ?? 0}
          disabled={isActive}
        />

        {/* 4 Classic Stake Originals Action Buttons */}
        <div className="grid grid-cols-2 gap-2">
          <button
            disabled={!session?.canHit || busy}
            onClick={() => sendAction('hit')}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] py-3 font-display text-xs font-bold text-white transition hover:border-[#00E599]/60 hover:bg-[#00E599]/10 disabled:cursor-not-allowed disabled:opacity-35"
          >
            <PlusCircle className="h-4 w-4 text-[#00E599]" />
            HIT
          </button>

          <button
            disabled={!session?.canStand || busy}
            onClick={() => sendAction('stand')}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] py-3 font-display text-xs font-bold text-white transition hover:border-[#FF3B69]/60 hover:bg-[#FF3B69]/10 disabled:cursor-not-allowed disabled:opacity-35"
          >
            <Hand className="h-4 w-4 text-[#FF3B69]" />
            STAND
          </button>

          <button
            disabled={!session?.canSplit || busy}
            onClick={() => sendAction('split')}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] py-3 font-display text-xs font-bold text-white transition hover:border-sky-400/60 hover:bg-sky-400/10 disabled:cursor-not-allowed disabled:opacity-35"
          >
            <Layers className="h-4 w-4 text-sky-400" />
            SPLIT
          </button>

          <button
            disabled={!session?.canDouble || busy}
            onClick={() => sendAction('double')}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] py-3 font-display text-xs font-bold text-white transition hover:border-[#F5B731]/60 hover:bg-[#F5B731]/10 disabled:cursor-not-allowed disabled:opacity-35"
          >
            <CopyPlus className="h-4 w-4 text-[#F5B731]" />
            DOUBLE
          </button>
        </div>

        <button
          disabled={isActive || busy}
          onClick={dealHand}
          className="w-full rounded-xl bg-gradient-to-b from-[#00F0A0] to-[#00C480] py-3.5 font-display text-sm font-black text-[#040507] shadow-[0_0_26px_rgba(0,229,153,0.38)] transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isActive ? 'HAND IN PROGRESS' : session ? 'DEAL NEW HAND' : 'DEAL CARDS'}
        </button>

        <div className="rounded-xl border border-white/[0.06] bg-[#05070A] p-3 text-[11px] text-zinc-400 space-y-1">
          <div className="flex items-center gap-1.5 font-semibold text-zinc-300">
            <ShieldCheck className="h-3.5 w-3.5 text-[#00E599]" />
            House Table Rules
          </div>
          <p>• Blackjack pays <strong className="text-white">3 to 2</strong> (2.5×)</p>
          <p>• Dealer stands on all <strong className="text-white">17s</strong></p>
          <p>• Double on any 2 cards · Split matching pairs</p>
        </div>
      </div>

      {/* Right Luxury Card Table Stage */}
      <div className="surface-card order-1 lg:order-2 relative flex min-h-[340px] sm:min-h-[460px] flex-col justify-between overflow-hidden rounded-2xl p-4 sm:p-6 lg:col-span-8">
        {/* Dealer Zone */}
        <div className="flex flex-col items-center">
          <div className="mb-3 flex items-center gap-2">
            <span className="font-display text-xs font-bold uppercase tracking-[0.15em] text-zinc-500">
              Dealer
            </span>
            {session && (
              <span className="rounded-full border border-white/10 bg-[#05070A] px-2.5 py-0.5 font-mono text-xs font-bold text-white tabular-nums">
                {session.dealerTotal}
                {session.dealerIsSoft && session.dealerTotal < 21 ? ' (Soft)' : ''}
              </span>
            )}
          </div>

          <div className="flex min-h-[128px] items-center justify-center">
            {session ? (
              <div className="flex items-center">
                {session.dealerCards.map((c, idx) => (
                  <PlayingCardView key={`${c.rank}_${c.suit}_${idx}`} card={c} index={idx} />
                ))}
                {session.dealerHoleHidden && (
                  <PlayingCardView hidden index={session.dealerCards.length} />
                )}
              </div>
            ) : (
              <div className="flex items-center opacity-70">
                <PlayingCardView hidden index={0} />
                <PlayingCardView hidden index={1} />
              </div>
            )}
          </div>
        </div>

        {/* Center Table Ribbon */}
        <div className="my-4 flex flex-col items-center">
          <div className="rounded-full border border-[#00E599]/25 bg-[#00E599]/[0.07] px-5 py-1.5 font-mono text-[11px] font-bold tracking-[0.18em] text-[#00E599] uppercase">
            BLACKJACK PAYS 3 TO 2 · DEALER STANDS ON 17
          </div>
        </div>

        {/* Player Hands Zone (supports 1 hand or 2 Split Hands!) */}
        <div className="flex flex-wrap items-end justify-center gap-8">
          {session ? (
            session.hands.map((hand, hIdx) => {
              const isFocused =
                session.status === 'ACTIVE' && session.activeHandIndex === hIdx;
              return (
                <div
                  key={hIdx}
                  className={`flex flex-col items-center rounded-2xl border p-4 transition-all ${
                    isFocused
                      ? 'border-[#00E599] bg-[#00E599]/[0.06] shadow-[0_0_24px_rgba(0,229,153,0.16)]'
                      : 'border-white/[0.06] bg-[#05070A]'
                  }`}
                >
                  <div className="flex items-center">
                    {hand.cards.map((c, cIdx) => (
                      <PlayingCardView
                        key={`${c.rank}_${c.suit}_${cIdx}`}
                        card={c}
                        index={cIdx}
                      />
                    ))}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                    <span className="rounded-full border border-white/10 bg-[#05070A] px-2.5 py-0.5 font-mono text-xs font-extrabold text-white tabular-nums">
                      {hand.total}
                      {hand.isSoft && hand.total < 21 ? ` / ${hand.total - 10}` : ''}
                    </span>
                    <span className="font-mono text-xs font-semibold text-zinc-400 tabular-nums">
                      {formatUsd(hand.stakeCents)}
                      {hand.doubled ? ' (2×)' : ''}
                    </span>
                    {outcomeBadge(hand.outcome)}
                    {hand.payoutCents > 0 && (
                      <span className="font-mono text-xs font-bold text-[#00E599] tabular-nums">
                        +{formatUsd(hand.payoutCents)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center text-xs text-zinc-500 py-6">
              Set your bet on the left and click <strong className="text-white">DEAL CARDS</strong> to start.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
