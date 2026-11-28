import React from 'react';
import { ToastItem } from '../types';

interface ToastStackProps {
  toasts: ToastItem[];
}

export const ToastStack: React.FC<ToastStackProps> = ({ toasts }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-20 left-3 right-3 sm:left-auto sm:right-4 lg:bottom-4 z-[60] flex sm:w-full sm:max-w-sm flex-col gap-2">
      {toasts.map((t) => {
        const accent =
          t.tone === 'emerald'
            ? 'toast-emerald'
            : t.tone === 'rose'
            ? 'toast-rose'
            : t.tone === 'amber'
            ? 'toast-amber'
            : 'toast-sky';
        const bar =
          t.tone === 'emerald'
            ? 'bg-accent'
            : t.tone === 'rose'
            ? 'bg-danger'
            : t.tone === 'amber'
            ? 'bg-gold'
            : 'bg-info';

        return (
          <div
            key={t.id}
            className={`animate-toast pointer-events-auto relative overflow-hidden rounded-lg border pl-4 pr-4 py-3 shadow-2xl ${accent}`}
          >
            <span className={`absolute left-0 top-0 h-full w-1 ${bar}`} />
            <div className="font-display text-sm font-semibold">{t.title}</div>
            {t.subtitle && (
              <div className="mt-0.5 text-xs text-muted">{t.subtitle}</div>
            )}
          </div>
        );
      })}
    </div>
  );
};
