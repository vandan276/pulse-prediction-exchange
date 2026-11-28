import React from 'react';
import {
  Bot,
  HelpCircle,
  Moon,
  Plus,
  Sun,
} from 'lucide-react';
import { AppTab, GlobalStats, MasterWalletSummary, UserProfile } from '../types';
import { formatUsd } from '../utils/format';

interface TopNavProps {
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  connected: boolean;
  globalStats: GlobalStats | null;
  masterWallet: MasterWalletSummary | null;
  user: UserProfile | null;
  onOpenAuthModal: (mode: 'login' | 'signup') => void;
  onOpenCashier: (tab: 'deposit' | 'withdraw') => void;
  onOpenLanding: () => void;
  onTopUp: () => void;
  onToggleBots: () => void;
  topUpBusy: boolean;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export const PulseMark: React.FC<{ size?: 'sm' | 'md' }> = ({ size = 'md' }) => (
  <div className="flex items-center gap-2.5">
    <div
      className={`flex shrink-0 items-center justify-center rounded-full bg-fg text-inverse ${
        size === 'sm' ? 'h-8 w-8' : 'h-9 w-9'
      }`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className={size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'}
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="22 12 18 12 15 20 9 4 6 12 2 12" />
      </svg>
    </div>
    <span className="font-display text-xl font-extrabold tracking-tight text-fg">
      PULSE
    </span>
  </div>
);

export const TopNav: React.FC<TopNavProps> = ({
  activeTab,
  onTabChange,
  connected,
  globalStats,
  user,
  onOpenAuthModal,
  onOpenCashier,
  onOpenLanding,
  onToggleBots,
  theme,
  onToggleTheme,
}) => {
  const botsOn = globalStats?.botsEnabled ?? true;

  const navTabs: Array<{ id: AppTab; label: string }> = [
    { id: 'arena', label: 'Markets' },
    { id: 'originals', label: '10 Originals' },
    { id: 'master_wallet', label: 'Vault' },
    { id: 'leaderboard', label: 'Leaderboard' },
  ];

  return (
    <header className="sticky top-0 z-40 h-16 border-b border-line bg-surface/95 backdrop-blur-xl">
      <div className="mx-auto flex h-full max-w-[1440px] items-center justify-between gap-3 px-3 sm:px-6">
        {/* Left: Crisp Black-Circle PULSE Brand -> Permanent Home / Landing Page (/) */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onOpenLanding}
            title="Home"
            className="flex items-center gap-2 transition hover:opacity-85"
          >
            <PulseMark />
          </button>

          <div
            title={connected ? 'Live market stream active' : 'Reconnecting...'}
            className="hidden xl:flex items-center gap-1.5 rounded-full border border-line bg-raised px-2.5 py-1 text-[11px] font-medium text-muted"
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                connected ? 'bg-accent animate-pulse' : 'bg-danger'
              }`}
            />
            <span className="font-mono font-semibold text-fg tabular-nums">
              {globalStats?.totalPlayingNow ?? 0}
            </span>
            <span>live</span>
          </div>
        </div>

        {/* Center: Minimalist Pill Tabs (Option 3 Signature) */}
        <nav className="hidden md:flex items-center gap-0.5 rounded-full border border-line bg-surface p-1 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <button
            onClick={onOpenLanding}
            className="rounded-full px-4 py-1.5 text-sm font-medium text-muted transition-all hover:text-fg"
          >
            Home
          </button>
          {navTabs.map((t) => {
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => onTabChange(t.id)}
                className={`rounded-full px-4 py-1.5 text-sm transition-all ${
                  active
                    ? 'bg-raised font-semibold text-fg shadow-[inset_0_0_0_1px_rgb(var(--line))]'
                    : 'font-medium text-muted hover:text-fg'
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </nav>

        {/* Right: Clean Fintech Controls */}
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <button
            onClick={onOpenLanding}
            title="How it works"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface text-muted transition hover:bg-raised hover:text-fg"
          >
            <HelpCircle className="h-4 w-4" />
          </button>

          <button
            onClick={onToggleTheme}
            title={theme === 'light' ? 'Switch to Carbon Dark Mode' : 'Switch to Alabaster Light Mode'}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface text-muted transition hover:bg-raised hover:text-fg"
          >
            {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4 text-gold" />}
          </button>

          <button
            onClick={onToggleBots}
            title="Toggle simulated traders in live pools"
            className={`hidden xl:flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition ${
              botsOn
                ? 'border-info/30 bg-info/10 text-info'
                : 'border-line bg-surface text-muted hover:text-fg'
            }`}
          >
            <Bot className="h-3.5 w-3.5" />
            <span>{botsOn ? 'Bots On' : 'Bots Off'}</span>
          </button>

          {user ? (
            <>
              <button
                onClick={() => onOpenCashier('deposit')}
                className="btn-glow flex h-9 items-center gap-1 rounded-full bg-accent px-3.5 sm:px-4 text-xs sm:text-sm font-semibold text-onaccent transition hover:brightness-105"
              >
                <Plus className="h-3.5 w-3.5 stroke-[2.8]" />
                <span className="hidden sm:inline">Deposit USDT</span>
                <span className="sm:hidden">Deposit</span>
              </button>

              <button
                onClick={() => onOpenAuthModal('login')}
                className="flex h-9 items-center gap-2 rounded-full border border-line bg-surface pl-3 pr-1.5 text-xs sm:text-sm font-semibold text-fg transition hover:bg-raised"
              >
                <span className="font-mono font-bold tabular-nums">
                  {formatUsd(user.balanceCents)}
                </span>
                <span
                  className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold text-white"
                  style={{ backgroundColor: user.avatarColor }}
                >
                  {user.username.slice(0, 1).toUpperCase()}
                </span>
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => onOpenAuthModal('login')}
                className="hidden sm:flex h-9 items-center rounded-full px-3 text-sm font-medium text-fg2 transition hover:bg-raised hover:text-fg"
              >
                Sign In
              </button>
              <button
                onClick={() => onOpenCashier('deposit')}
                className="btn-glow hidden sm:flex h-9 items-center gap-1 rounded-full bg-accent px-4 text-sm font-semibold text-onaccent transition hover:brightness-105"
              >
                <Plus className="h-3.5 w-3.5 stroke-[2.8]" />
                <span>Deposit USDT</span>
              </button>
              <button
                onClick={() => onOpenAuthModal('signup')}
                className="flex h-9 items-center rounded-full bg-fg px-4 text-xs sm:text-sm font-semibold text-inverse transition hover:opacity-90"
              >
                Sign Up
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
