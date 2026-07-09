/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['Outfit', 'sans-serif'],
        serif: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        sans: ['Manrope', 'sans-serif'],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)'
      },
      colors: {
        ayana: {
          /* ── Backgrounds ─────────────────────── */
          bg:        '#F8F5EF',        /* warm linen — body / page background */
          'bg-dark':  '#061A14',       /* midnight emerald — hero / dark sections */
          surface:   '#FFFFFF',
          alt:       '#F0EBE1',

          /* ── Brand greens ────────────────────── */
          primary:        '#0A5940',   /* deep forest emerald */
          'primary-hover':'#0D7050',   /* brighter on hover */
          'primary-light':'#E6F4EE',   /* tinted bg for icon wells */

          /* ── Saffron accent ──────────────────── */
          accent:        '#E8590C',    /* vivid Indian saffron-orange */
          'accent-hover':'#FF6B1A',
          'accent-light':'#FEF0E7',

          /* ── Gold highlight ──────────────────── */
          gold:      '#D4960A',
          'gold-light':'#FDF3D0',

          /* ── Text ────────────────────────────── */
          text:      '#1A1F1C',        /* near-black, warm */
          secondary: '#4A5450',        /* warm gray */
          muted:     '#8A948F',

          /* ── Borders / lines ─────────────────── */
          line:      '#E2DDD4',

          /* ── WhatsApp brand ──────────────────── */
          whatsapp:  '#25D366',
        },
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))'
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))'
        },
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
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))'
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))'
        }
      },
      keyframes: {
        'accordion-down': {
          from: {
            height: '0'
          },
          to: {
            height: 'var(--radix-accordion-content-height)'
          }
        },
        'accordion-up': {
          from: {
            height: 'var(--radix-accordion-content-height)'
          },
          to: {
            height: '0'
          }
        }
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out'
      }
    }
  },
  plugins: [require("tailwindcss-animate")],
};