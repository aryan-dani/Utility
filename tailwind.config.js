/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        background: 'rgb(var(--background) / <alpha-value>)',
        'background-subtle': 'rgb(var(--background-subtle) / <alpha-value>)',
        foreground: 'rgb(var(--foreground) / <alpha-value>)',
        'foreground-subtle': 'rgb(var(--foreground-subtle) / <alpha-value>)',

        card: 'rgb(var(--card) / <alpha-value>)',
        'card-hover': 'rgb(var(--card-hover) / <alpha-value>)',

        surface: 'rgb(var(--surface) / <alpha-value>)',
        'surface-hover': 'rgb(var(--surface-hover) / <alpha-value>)',

        border: 'rgb(var(--border) / <alpha-value>)',
        'border-strong': 'rgb(var(--border-strong) / <alpha-value>)',

        muted: 'rgb(var(--muted) / <alpha-value>)',
        'muted-hover': 'rgb(var(--muted-hover) / <alpha-value>)',

        primary: 'rgb(var(--primary) / <alpha-value>)',
        'primary-hover': 'rgb(var(--primary-hover) / <alpha-value>)',
        'primary-foreground': 'rgb(var(--primary-foreground) / <alpha-value>)',

        destructive: 'rgb(var(--destructive) / <alpha-value>)',
        'destructive-foreground': 'rgb(var(--destructive-foreground) / <alpha-value>)',
        accent: 'rgb(var(--accent) / <alpha-value>)',
        'accent-hover': 'rgb(var(--accent-hover) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Inter', 'Geist', 'system-ui', 'sans-serif'],
        mono: ['Geist Mono', 'JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        DEFAULT: 'var(--radius)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        '2xl': 'var(--radius-2xl)',
        '3xl': 'var(--radius-3xl)',
      },
      borderWidth: {
        DEFAULT: '2px',
        0: '0px',
        1: '1px',
        2: '2px',
        3: '3px',
        4: '4px',
        6: '6px',
        8: '8px',
      },
      boxShadow: {
        DEFAULT: '4px 4px 0px 0px rgb(var(--foreground))',
        sm: '2px 2px 0px 0px rgb(var(--foreground))',
        md: '4px 4px 0px 0px rgb(var(--foreground))',
        lg: '6px 6px 0px 0px rgb(var(--foreground))',
        xl: '8px 8px 0px 0px rgb(var(--foreground))',
        '2xl': '12px 12px 0px 0px rgb(var(--foreground))',
        '3xs': '1px 1px 0px 0px rgb(var(--foreground))',
        'xs': '2px 2px 0px 0px rgb(var(--foreground))',
        'card': '4px 4px 0px 0px rgb(var(--foreground))',
        'card-hover': '6px 6px 0px 0px rgb(var(--foreground))',
        'popover': '4px 4px 0px 0px rgb(var(--foreground))',
        'glow': '0 0 0px 0px transparent',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out forwards',
        'slide-up': 'slideUp 0.25s ease-out forwards',
        'slide-down': 'slideDown 0.2s ease-out forwards',
        'scale-in': 'scaleIn 0.15s ease-out forwards',
        'shimmer': 'shimmer 1.5s infinite',
        'spin-slow': 'spin 2s linear infinite',
        'pulse-subtle': 'pulseSubtle 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        pulseSubtle: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.85', transform: 'scale(1.015)' },
        },
      },
      transitionTimingFunction: {
        'spring': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
};
