import React from 'react';
import {
  Bot,
  Gamepad2,
  Landmark,
  Moon,
  Plus,
  Sun,
  Trophy,
  User,
  Users,
  Wallet,
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
  onOpenUserModal: () => void;
  onOpenCashier: (tab: 'deposit' | 'withdraw') => void;
  onTopUp: () => void;
  onToggleBots: () => void;
  topUpBusy: boolean;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export const TopNav: React.FC<TopNavProps> = ({
  activeTab,
  onTabChange,
  connected,
  globalStats,
  masterWallet,
  user,
  onOpenUserModal,
  onOpenCashier,
  onToggleBots,
  theme,
  onToggleTheme,
}) => {
  const botsOn = globalStats?.botsEnabled ?? true;

  return (
    <header className="sticky top-0 z-40 h-14 border-b border-white/[0.065] bg-[#040507]/85 backdrop-blur-2xl">
      <div className="mx-auto flex h-full max-w-[1680px] items-center justify-between gap-3 px-4 lg:px-5">
        {/* Left: Brand Identity + Live Global Playing Telemetry */}
        <div className="flex items-center gap-3.5 shrink-0">
          <button
            onClick={() => onTabChange('arena')}
            className="flex items-center gap-2.5 group"
          >
            <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-[#00E599] shadow-[0_0_24px_rgba(0,229,153,0.35)]">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="h-4.5 w-4.5 text-[#040507]"
                stroke="currentColor"
                strokeWidth="2.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="22 12 18 12 15 20 9 4 6 12 2 12" />
              </svg>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-display text-base font-bold tracking-[-0.03em] text-white">
                PULSE
              </span>
              <span className="rounded bg-white/[0.07] px-1.5 py-0.5 font-mono text-[9px] font-bold tracking-widest text-[#00E599]">
                EXCHANGE
              </span>
            </div>
          </button>

          <div className="hidden sm:block h-4 w-px bg-white/[0.08]" />

          {/* Live Global Players Playing Now */}
          <div className="flex items-center gap-2 rounded-full border border-[#00E599]/20 bg-[#00E599]/[0.06] px-3 py-1">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00E599] opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#00E599]" />
            </span>
            <Users className="h-3.5 w-3.5 text-[#00E599]" />
            <span className="font-mono text-xs font-bold text-white tabular-nums">
              {globalStats ? globalStats.totalPlayingNow : 0}
            </span>
            <span className="hidden md:inline text-[11px] font-medium text-zinc-400">
              Playing
            </span>
            <span
              title={connected ? 'WebSocket live' : 'Reconnecting...'}
              className={`ml-0.5 h-1.5 w-1.5 rounded-full ${
                connected ? 'bg-[#00E599]' : 'bg-[#FF3B69]'
              }`}
            />
          </div>
        </div>

        {/* Center: Clean Segmented Navigation */}
        <nav className="flex items-center gap-0.5 rounded-full border border-white/[0.07] bg-white/[0.025] p-1 shrink-0">
          <button
            onClick={() => onTabChange('arena')}
            className={`rounded-full px-3.5 py-1 text-xs font-semibold transition-all ${
              activeTab === 'arena'
                ? 'bg-white text-[#040507] shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Arena
          </button>

          <button
            onClick={() => onTabChange('originals')}
            className={`flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-semibold transition-all ${
              activeTab === 'originals'
                ? 'bg-[#00E599] text-[#040507] shadow-[0_0_20px_rgba(0,229,153,0.3)]'
                : 'text-zinc-400 hover:text-[#00E599]'
            }`}
          >
            <Gamepad2 className="h-3.5 w-3.5" />
            <span>Originals</span>
            <span
              className={`rounded-full px-1.5 py-0.2 font-mono text-[10px] font-black ${
                activeTab === 'originals'
                  ? 'bg-black/15 text-[#040507]'
                  : 'bg-[#00E599]/15 text-[#00E599]'
              }`}
            >
              10
            </span>
          </button>

          <button
            onClick={() => onTabChange('master_wallet')}
            className={`flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-semibold transition-all ${
              activeTab === 'master_wallet'
                ? 'bg-[#F5B731] text-[#040507] shadow-[0_0_20px_rgba(245,183,49,0.28)]'
                : 'text-zinc-400 hover:text-[#F5B731]'
            }`}
          >
            <Landmark className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Master Vault</span>
            <span
              className={`rounded-full px-1.5 py-0.5 font-mono text-[10px] font-bold tabular-nums ${
                activeTab === 'master_wallet'
                  ? 'bg-black/15 text-[#040507]'
                  : 'bg-[#F5B731]/15 text-[#F5B731]'
              }`}
            >
              {formatUsd(
                masterWallet?.combinedTreasuryCents ??
                  masterWallet?.totalBalanceCents ??
                  0
              )}
            </span>
          </button>

          <button
            onClick={() => onTabChange('leaderboard')}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-all ${
              activeTab === 'leaderboard'
                ? 'bg-white text-[#040507] shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Trophy className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Leaderboard</span>
          </button>
        </nav>

        {/* Right: Theme Toggle + Demo Bot Toggle + Luxury Wallet Pill */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onToggleTheme}
            title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-zinc-400 transition hover:text-white"
          >
            {theme === 'light' ? (
              <Moon className="h-3.5 w-3.5" />
            ) : (
              <Sun className="h-3.5 w-3.5 text-[#F5B731]" />
            )}
          </button>

          <button
            onClick={onToggleBots}
            title="Toggle simulated traders populating live pools"
            className={`hidden md:flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all ${
              botsOn
                ? 'border-sky-400/30 bg-sky-400/10 text-sky-300 hover:bg-sky-400/15'
                : 'border-white/10 bg-white/[0.03] text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Bot className="h-3.5 w-3.5" />
            <span className="font-mono">{botsOn ? 'BOTS ON' : 'BOTS OFF'}</span>
          </button>

          {user ? (
            <div className="flex items-center gap-1 rounded-full border border-white/[0.1] bg-[#0D1017] p-1 pl-3 shadow-inner">
              <Wallet className="h-3.5 w-3.5 text-[#00E599] mr-1" />
              <span className="font-mono text-xs font-bold text-white tabular-nums pr-1">
                {formatUsd(user.balanceCents)}
              </span>
              <button
                onClick={() => onOpenCashier('deposit')}
                title="Open Deposit & Withdrawal Gateway"
                className="flex h-6 items-center gap-1 rounded-full bg-[#00E599] px-2.5 font-display text-[11px] font-extrabold text-[#040507] transition hover:brightness-110"
              >
                <Plus className="h-3 w-3 stroke-[3]" />
                Deposit
              </button>
              <button
                onClick={() => onOpenCashier('withdraw')}
                title="Withdraw funds"
                className="hidden sm:flex h-6 items-center rounded-full bg-white/[0.06] px-2 font-display text-[11px] font-bold text-zinc-300 transition hover:bg-white/[0.12] hover:text-white"
              >
                Withdraw
              </button>
              <button
                onClick={onOpenUserModal}
                className="flex h-6 items-center gap-1.5 rounded-full bg-white/[0.06] pl-1.5 pr-2.5 text-[11px] font-semibold text-zinc-200 transition hover:bg-white/[0.12]"
              >
                <span
                  className="h-2.5 w-2.5 rounded-full ring-2 ring-black/40"
                  style={{ backgroundColor: user.avatarColor }}
                />
                <span className="max-w-[82px] truncate">{user.username}</span>
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenUserModal}
              className="flex items-center gap-1.5 rounded-full bg-[#00E599] px-4 py-1.5 text-xs font-bold text-[#040507] shadow-[0_0_20px_rgba(0,229,153,0.3)] transition hover:brightness-110"
            >
              <User className="h-3.5 w-3.5" />
              Connect
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
