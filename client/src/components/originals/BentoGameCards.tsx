import React from 'react';
import { OriginalGameId } from '../../types';

export interface BentoGameMeta {
  id: Exclude<OriginalGameId, 'lobby'>;
  name: string;
  badge: string;
  tagline: string;
  maxMult: string;
  lightBg: string;
  lightBorder: string;
  darkBg: string;
  darkBorder: string;
  accent: string;
}

export const BENTO_GAMES: BentoGameMeta[] = [
  {
    id: 'blackjack',
    name: 'Blackjack',
    badge: '99.5% RTP',
    tagline: 'Classic 21 with Hit, Stand, Double & Split',
    maxMult: '2.50x',
    lightBg: '#EBFDF3',
    lightBorder: '#86EFAC',
    darkBg: 'rgba(0,200,83, 0.10)',
    darkBorder: 'rgba(52, 211, 153, 0.35)',
    accent: '#00C853',
  },
  {
    id: 'crash',
    name: 'Crash',
    badge: 'LIVE MULTIPLAYER',
    tagline: 'Ride the exponential curve & cash out in time',
    maxMult: '10,000x',
    lightBg: '#EFF6FF',
    lightBorder: '#93C5FD',
    darkBg: 'rgba(37, 99, 235, 0.12)',
    darkBorder: 'rgba(96, 165, 250, 0.35)',
    accent: '#2563EB',
  },
  {
    id: 'mines',
    name: 'Mines',
    badge: '5×5 GRID',
    tagline: 'Reveal emerald gems while dodging hidden bombs',
    maxMult: '5.1Mx',
    lightBg: '#FFF1F2',
    lightBorder: '#FDA4AF',
    darkBg: 'rgba(255, 59, 92, 0.10)',
    darkBorder: 'rgba(251, 113, 133, 0.35)',
    accent: '#FF3B5C',
  },
  {
    id: 'plinko',
    name: 'Plinko',
    badge: 'PHYSICS',
    tagline: 'Drop balls through 8–16 peg rows into high buckets',
    maxMult: '1,000x',
    lightBg: '#F5F3FF',
    lightBorder: '#C4B5FD',
    darkBg: 'rgba(124, 58, 237, 0.12)',
    darkBorder: 'rgba(167, 139, 250, 0.35)',
    accent: '#7C3AED',
  },
  {
    id: 'pump',
    name: 'Pump',
    badge: 'VIRAL',
    tagline: 'Inflate step by step — bail out before pop',
    maxMult: '3.2Mx',
    lightBg: '#FDF2F8',
    lightBorder: '#F9A8D4',
    darkBg: 'rgba(236, 72, 153, 0.11)',
    darkBorder: 'rgba(244, 114, 182, 0.35)',
    accent: '#EC4899',
  },
  {
    id: 'dice',
    name: 'Dice',
    badge: 'INSTANT',
    tagline: 'Set custom Roll Over / Roll Under odds',
    maxMult: '49.50x',
    lightBg: '#F0F9FF',
    lightBorder: '#7DD3FC',
    darkBg: 'rgba(14, 165, 233, 0.11)',
    darkBorder: 'rgba(56, 189, 248, 0.35)',
    accent: '#0284C7',
  },
  {
    id: 'limbo',
    name: 'Limbo',
    badge: 'HIGH ROLLER',
    tagline: 'Pick any target multiplier up to 1,000,000x',
    maxMult: '1,000,000x',
    lightBg: '#FFFBEB',
    lightBorder: '#FCD34D',
    darkBg: 'rgba(245, 158, 11, 0.11)',
    darkBorder: 'rgba(251, 191, 36, 0.35)',
    accent: '#D97706',
  },
  {
    id: 'keno',
    name: 'Keno',
    badge: '40 TILES',
    tagline: 'Pick up to 10 numbers & match the live draw',
    maxMult: '1,000x',
    lightBg: '#F0FDFA',
    lightBorder: '#5EEAD4',
    darkBg: 'rgba(20, 184, 166, 0.11)',
    darkBorder: 'rgba(45, 212, 191, 0.35)',
    accent: '#0D9488',
  },
  {
    id: 'tower',
    name: 'Dragon Tower',
    badge: '9 FLOORS',
    tagline: 'Ascend 9 floors across Easy to Expert risk',
    maxMult: '19,486x',
    lightBg: '#FFF7ED',
    lightBorder: '#FDBA74',
    darkBg: 'rgba(249, 115, 22, 0.11)',
    darkBorder: 'rgba(251, 146, 60, 0.35)',
    accent: '#EA580C',
  },
  {
    id: 'wheel',
    name: 'Wheel',
    badge: 'SPIN',
    tagline: 'Spin 10–50 customizable risk segments',
    maxMult: '49.50x',
    lightBg: '#FAF5FF',
    lightBorder: '#D8B4FE',
    darkBg: 'rgba(168, 85, 247, 0.11)',
    darkBorder: 'rgba(192, 132, 252, 0.35)',
    accent: '#9333EA',
  },
];

/** Clean Silicon Valley vector illustrations matching Option 3 Apex Pro Fintech */
export const BentoArtwork: React.FC<{ id: BentoGameMeta['id']; className?: string }> = ({
  id,
  className = 'h-16 w-16',
}) => {
  switch (id) {
    case 'blackjack':
      return (
        <svg viewBox="0 0 80 72" fill="none" className={className}>
          <rect x="10" y="12" width="34" height="48" rx="6" fill="#FFFFFF" stroke="#0A0B0E" strokeWidth="2" transform="rotate(-10 27 36)" />
          <text x="15" y="27" fill="#00C853" fontSize="11" fontWeight="800" fontFamily="Inter,sans-serif" transform="rotate(-10 27 36)">K</text>
          <rect x="34" y="10" width="34" height="48" rx="6" fill="#FFFFFF" stroke="#0A0B0E" strokeWidth="2" transform="rotate(8 51 34)" />
          <text x="39" y="25" fill="#0A0B0E" fontSize="11" fontWeight="800" fontFamily="Inter,sans-serif" transform="rotate(8 51 34)">A</text>
          <path d="M51 28 C46 34 43 38 46 41 C48 43 50 41 51 40 C52 41 54 43 56 41 C59 38 56 34 51 28 Z M50 40 L48.5 45 L53.5 45 L52 40 Z" fill="#0A0B0E" transform="rotate(8 51 34)" />
        </svg>
      );
    case 'crash':
      return (
        <svg viewBox="0 0 80 72" fill="none" className={className}>
          <path d="M8 60 Q 38 58 62 18" stroke="#2563EB" strokeWidth="2.8" strokeLinecap="round" />
          <path d="M62 18 L66 10 L57 14 Z" fill="#2563EB" />
          <path d="M54 24 C57 15 65 11 69 11 C69 15 65 23 56 26 Z" fill="#2563EB" stroke="#1E3A8A" strokeWidth="1.4" />
          <circle cx="62" cy="18" r="2.2" fill="#FFFFFF" />
          <path d="M51 29 L46 34" stroke="#60A5FA" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      );
    case 'mines':
      return (
        <svg viewBox="0 0 80 72" fill="none" className={className}>
          <rect x="10" y="6" width="60" height="60" rx="8" fill="#FFFFFF" stroke="#FDA4AF" strokeWidth="2" />
          <line x1="30" y1="6" x2="30" y2="66" stroke="#FECDD3" strokeWidth="1.5" />
          <line x1="50" y1="6" x2="50" y2="66" stroke="#FECDD3" strokeWidth="1.5" />
          <line x1="10" y1="26" x2="70" y2="26" stroke="#FECDD3" strokeWidth="1.5" />
          <line x1="10" y1="46" x2="70" y2="46" stroke="#FECDD3" strokeWidth="1.5" />
          <polygon points="40,10 46,16 40,22 34,16" fill="#00C853" stroke="#059669" strokeWidth="1" />
          <polygon points="20,30 26,36 20,42 14,36" fill="#00C853" stroke="#059669" strokeWidth="1" />
          <polygon points="40,30 46,36 40,42 34,36" fill="#00C853" stroke="#059669" strokeWidth="1" />
          <polygon points="60,50 66,56 60,62 54,56" fill="#00C853" stroke="#059669" strokeWidth="1" />
        </svg>
      );
    case 'plinko':
      return (
        <svg viewBox="0 0 80 72" fill="none" className={className}>
          <path d="M40 8 L68 58 L12 58 Z" stroke="#6D28D9" strokeWidth="1.5" strokeLinejoin="round" fill="#FFFFFF" fillOpacity="0.65" />
          {[
            [40, 20],
            [33, 30], [47, 30],
            [26, 40], [40, 40], [54, 40],
            [20, 50], [33, 50], [47, 50], [60, 50],
          ].map(([cx, cy], i) => (
            <circle key={i} cx={cx} cy={cy} r="2.2" fill="#0A0B0E" />
          ))}
          <circle cx="54" cy="24" r="4.2" fill="#00C853" stroke="#065F46" strokeWidth="1.2" />
          <circle cx="24" cy="62" r="4" fill="#2563EB" />
          <circle cx="40" cy="62" r="4" fill="#00C853" />
          <circle cx="56" cy="62" r="4" fill="#2563EB" />
        </svg>
      );
    case 'pump':
      return (
        <svg viewBox="0 0 80 72" fill="none" className={className}>
          <ellipse cx="40" cy="30" rx="18" ry="21" fill="#EC4899" fillOpacity="0.2" stroke="#EC4899" strokeWidth="2.4" />
          <path d="M35 20 Q 32 25 33 32" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M36 52 L44 52 L42 56 L38 56 Z" fill="#EC4899" />
          <path d="M40 56 Q 43 62 38 66" stroke="#DB2777" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case 'dice':
      return (
        <svg viewBox="0 0 80 72" fill="none" className={className}>
          <rect x="16" y="14" width="44" height="44" rx="10" fill="#FFFFFF" stroke="#0284C7" strokeWidth="2.4" />
          <circle cx="29" cy="27" r="3.4" fill="#0284C7" />
          <circle cx="47" cy="27" r="3.4" fill="#0284C7" />
          <circle cx="38" cy="36" r="3.4" fill="#00C853" />
          <circle cx="29" cy="45" r="3.4" fill="#0284C7" />
          <circle cx="47" cy="45" r="3.4" fill="#0284C7" />
        </svg>
      );
    case 'limbo':
      return (
        <svg viewBox="0 0 80 72" fill="none" className={className}>
          <path d="M45 10 L22 39 L38 39 L34 62 L58 32 L42 32 Z" fill="#F59E0B" fillOpacity="0.25" stroke="#D97706" strokeWidth="2.4" strokeLinejoin="round" />
        </svg>
      );
    case 'keno':
      return (
        <svg viewBox="0 0 80 72" fill="none" className={className}>
          {[0, 1, 2].map((r) =>
            [0, 1, 2].map((c) => {
              const hit = (r === 0 && c === 1) || (r === 1 && c === 2) || (r === 2 && c === 0);
              return (
                <rect
                  key={`${r}_${c}`}
                  x={15 + c * 18}
                  y={11 + r * 18}
                  width="14"
                  height="14"
                  rx="3.5"
                  fill={hit ? '#0D9488' : '#FFFFFF'}
                  stroke="#0D9488"
                  strokeWidth="1.6"
                />
              );
            })
          )}
        </svg>
      );
    case 'tower':
      return (
        <svg viewBox="0 0 80 72" fill="none" className={className}>
          <rect x="20" y="48" width="40" height="12" rx="3" fill="#EA580C" fillOpacity="0.2" stroke="#EA580C" strokeWidth="2" />
          <rect x="25" y="32" width="30" height="12" rx="3" fill="#EA580C" fillOpacity="0.35" stroke="#EA580C" strokeWidth="2" />
          <rect x="30" y="16" width="20" height="12" rx="3" fill="#EA580C" stroke="#C2410C" strokeWidth="2" />
          <circle cx="40" cy="22" r="2.5" fill="#FFFFFF" />
        </svg>
      );
    case 'wheel':
      return (
        <svg viewBox="0 0 80 72" fill="none" className={className}>
          <circle cx="40" cy="38" r="24" fill="#FFFFFF" stroke="#9333EA" strokeWidth="2.5" />
          <path d="M40 38 L40 14 A24 24 0 0 1 64 38 Z" fill="#9333EA" fillOpacity="0.25" />
          <path d="M40 38 L64 38 A24 24 0 0 1 40 62 Z" fill="#00C853" fillOpacity="0.25" />
          <path d="M40 38 L40 62 A24 24 0 0 1 16 38 Z" fill="#2563EB" fillOpacity="0.2" />
          <circle cx="40" cy="38" r="5" fill="#0A0B0E" />
          <polygon points="40,18 36,9 44,9" fill="#FF3B5C" />
        </svg>
      );
  }
};
