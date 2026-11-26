import React from 'react';
import { ToastItem } from '../types';

interface ToastStackProps {
  toasts: ToastItem[];
}

export const ToastStack: React.FC<ToastStackProps> = ({ toasts }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2">
      {toasts.map((t) => {
        const accent =
          t.tone === 'emerald'
            ? 'toast-emerald border-[#00E599]/45 bg-[#06130E]/95 text-emerald-100'
            : t.tone === 'rose'
            ? 'toast-rose border-[#FF3B69]/45 bg-[#19070D]/95 text-rose-100'
            : t.tone === 'amber'
            ? 'toast-amber border-[#F5B731]/45 bg-[#171206]/95 text-amber-100'
            : 'toast-sky border-sky-400/45 bg-[#07111C]/95 text-sky-100';

        return (
          <div
            key={t.id}
            className={`animate-toast pointer-events-auto rounded-xl border px-4 py-3 shadow-2xl backdrop-blur-xl ${accent}`}
          >
            <div className="font-display text-xs font-bold">{t.title}</div>
            {t.subtitle && (
              <div className="mt-0.5 text-[11px] opacity-80">{t.subtitle}</div>
            )}
          </div>
        );
      })}
    </div>
  );
};
