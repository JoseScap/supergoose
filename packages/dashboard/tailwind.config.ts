import type { Config } from 'tailwindcss';

export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))'
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))'
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))'
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))'
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))'
        }
      },
      borderRadius: {
        xl: 'var(--radius)',
        '2xl': 'calc(var(--radius) + 0.25rem)',
        '3xl': 'calc(var(--radius) + 0.5rem)'
      },
      boxShadow: {
        glow: '0 0 0 1px hsl(var(--primary) / 0.25), 0 20px 60px -20px hsl(var(--primary) / 0.45)',
        panel: '0 24px 60px -32px rgba(0, 0, 0, 0.8)'
      },
      backgroundImage: {
        'brand-grid':
          'linear-gradient(to right, rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.04) 1px, transparent 1px)',
        'brand-radial':
          'radial-gradient(circle at top left, hsl(var(--primary) / 0.18), transparent 35%), radial-gradient(circle at top right, hsl(var(--primary) / 0.12), transparent 30%), radial-gradient(circle at bottom center, rgba(255,255,255,0.06), transparent 40%)'
      },
      fontFamily: {
        display: ['"Manrope"', '"Inter"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['"Inter"', 'ui-sans-serif', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
} satisfies Config;
