/** @type {import('tailwindcss').Config} */
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['"Bricolage Grotesque"', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        base: token('base'),
        surface: token('surface'),
        raised: token('raised'),
        overlay: token('overlay'),
        line: token('line'),
        fg: token('fg'),
        fg2: token('fg2'),
        muted: token('muted'),
        subtle: token('subtle'),
        inverse: token('inverse'),
        accent: token('accent'),
        accentdeep: token('accentdeep'),
        gold: token('gold'),
        danger: token('danger'),
        dangerdeep: token('dangerdeep'),
        info: token('info'),
        onaccent: token('onaccent'),
        sidebar: token('sidebar'),
      },
    },
  },
  plugins: [],
};
