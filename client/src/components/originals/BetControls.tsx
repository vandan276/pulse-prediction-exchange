import React from 'react';
import { formatUsd } from '../../utils/format';

interface StakeInputProps {
  stakeDollars: string;
  onChange: (val: string) => void;
  balanceCents: number;
  disabled?: boolean;
}

export const StakeInput: React.FC<StakeInputProps> = ({
  stakeDollars,
  onChange,
  balanceCents,
  disabled = false,
}) => {
  const numVal = Math.max(0, parseFloat(stakeDollars) || 0);
  const maxDollars = Math.floor(balanceCents) / 100;

  const setSafe = (v: number) => {
    const clamped = Math.max(1, Math.min(maxDollars || 1, v));
    onChange(clamped.toFixed(2).replace(/\.00$/, ''));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-semibold text-zinc-400">Bet Amount</span>
        <span className="font-mono text-zinc-500 tabular-nums">
          Bal {formatUsd(balanceCents)}
        </span>
      </div>

      <div className="flex items-center overflow-hidden rounded-xl border border-white/[0.09] bg-[#05070A] focus-within:border-[#00E599]/60">
        <span className="pl-3 font-mono text-sm font-bold text-[#00E599]">$</span>
        <input
          type="number"
          min="1"
          step="1"
          disabled={disabled}
          value={stakeDollars}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-transparent px-2 py-2.5 font-mono text-sm font-bold text-white outline-none tabular-nums disabled:opacity-50"
        />
        <div className="flex items-center gap-1 pr-1.5">
          <button
            type="button"
            disabled={disabled}
            onClick={() => setSafe(Math.max(1, numVal / 2))}
            className="rounded-lg bg-white/[0.06] px-2 py-1 font-mono text-[10px] font-bold text-zinc-300 transition hover:bg-white/[0.12] disabled:opacity-40"
          >
            ½
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => setSafe(numVal * 2)}
            className="rounded-lg bg-white/[0.06] px-2 py-1 font-mono text-[10px] font-bold text-zinc-300 transition hover:bg-white/[0.12] disabled:opacity-40"
          >
            2×
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => setSafe(maxDollars)}
            className="rounded-lg bg-white/[0.06] px-2 py-1 font-mono text-[10px] font-bold text-[#F5B731] transition hover:bg-white/[0.12] disabled:opacity-40"
          >
            MAX
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-1.5">
        {[5, 10, 25, 100].map((amt) => (
          <button
            key={amt}
            type="button"
            disabled={disabled}
            onClick={() => onChange(String(amt))}
            className="rounded-lg border border-white/[0.06] bg-white/[0.02] py-1 font-mono text-[11px] font-semibold text-zinc-300 transition hover:border-white/20 hover:text-white disabled:opacity-40"
          >
            ${amt}
          </button>
        ))}
      </div>
    </div>
  );
};
