/** @type {import('tailwindcss').Config} */
const withAlpha = (variableName) =>
  `color-mix(in srgb, var(${variableName}) calc(<alpha-value> * 100%), transparent)`;
const withRgbAlpha = (variableName) => `rgb(var(${variableName}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      colors: {
        bg: withRgbAlpha('--color-bg'),
        bgSecondary: withRgbAlpha('--color-bg-secondary'),
        surface1: withRgbAlpha('--surface-1'),
        surface2: withRgbAlpha('--surface-2'),
        surface3: withRgbAlpha('--surface-3'),
        cardBorder: withRgbAlpha('--color-card-border'),
        subtle: withRgbAlpha('--border-subtle'),
        text: withRgbAlpha('--color-text'),
        textMuted: withRgbAlpha('--color-text-muted'),
        muted: withRgbAlpha('--color-text-muted'),
        mutedSurface: withRgbAlpha('--color-bg-secondary'),
        hover: withRgbAlpha('--color-hover'),
        rowHover: withRgbAlpha('--row-hover'),
        border: withRgbAlpha('--color-card-border'),
        input: withRgbAlpha('--color-card-border'),
        ring: withRgbAlpha('--color-primary'),
        background: withRgbAlpha('--color-bg'),
        foreground: withRgbAlpha('--color-text'),
        card: {
          DEFAULT: withRgbAlpha('--color-card'),
          foreground: withRgbAlpha('--color-text'),
        },
        popover: {
          DEFAULT: withRgbAlpha('--color-card'),
          foreground: withRgbAlpha('--color-text'),
        },
        primary: {
          DEFAULT: withRgbAlpha('--color-primary'),
          foreground: withAlpha('--primary-foreground'),
        },
        secondary: {
          DEFAULT: withRgbAlpha('--color-secondary'),
          foreground: withAlpha('--secondary-foreground'),
        },
        accent: {
          DEFAULT: withRgbAlpha('--color-hover'),
          foreground: withAlpha('--accent-foreground'),
        },
        destructive: {
          DEFAULT: withAlpha('--destructive'),
          foreground: withAlpha('--destructive-foreground'),
        },
        success: {
          DEFAULT: withAlpha('--success'),
        },
        warning: {
          DEFAULT: withAlpha('--warning'),
        },
        info: {
          DEFAULT: withAlpha('--info'),
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [],
};
