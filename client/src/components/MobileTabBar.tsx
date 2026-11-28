import React from 'react';
import { CandlestickChart, Gamepad2, Landmark, Plus, Trophy } from 'lucide-react';
import { AppTab } from '../types';

interface MobileTabBarProps {
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  onOpenCasino: () => void;
  onOpenWallet: () => void;
}

export const MobileTabBar: React.FC<MobileTabBarProps> = ({
  activeTab,
  onTabChange,
  onOpenCasino,
  onOpenWallet,
}) => {
  const item = (
    active: boolean,
    onClick: () => void,
    Icon: React.ComponentType<{ className?: string }>,
    label: string
  ) => (
    <button
      onClick={onClick}
      className={`flex flex-1 flex-col items-center justify-center gap-1 text-[10px] font-semibold transition ${
        active ? 'text-fg' : 'text-muted hover:text-fg'
      }`}
    >
      <Icon className={`h-5 w-5 ${active ? 'text-accent' : ''}`} />
      <span>{label}</span>
    </button>
  );

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-stretch border-t border-line bg-surface/95 backdrop-blur-xl md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {item(activeTab === 'arena', () => onTabChange('arena'), CandlestickChart, 'Markets')}
      {item(activeTab === 'originals', onOpenCasino, Gamepad2, 'Originals')}
      <div className="flex flex-1 items-center justify-center">
        <button
          onClick={onOpenWallet}
          className="btn-glow flex h-10 items-center gap-1 rounded-full bg-accent px-3.5 text-[11px] font-bold text-onaccent transition active:scale-95"
        >
          <Plus className="h-3.5 w-3.5 stroke-[3]" />
          <span>USDT</span>
        </button>
      </div>
      {item(activeTab === 'master_wallet', () => onTabChange('master_wallet'), Landmark, 'Vault')}
      {item(activeTab === 'leaderboard', () => onTabChange('leaderboard'), Trophy, 'Ranks')}
    </nav>
  );
};
