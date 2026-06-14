/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        background: 'rgb(var(--background))',
        'background-subtle': 'rgb(var(--background-subtle))',
        foreground: 'rgb(var(--foreground) / <alpha-value>)',
        'foreground-subtle': 'rgb(var(--foreground-subtle) / <alpha-value>)',

        card: 'rgb(var(--card))',
        'card-hover': 'rgb(var(--card-hover))',

        surface: 'rgb(var(--surface))',
        'surface-hover': 'rgb(var(--surface-hover))',

        border: 'rgb(var(--border))',
        'border-strong': 'rgb(var(--border-strong))',

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
        DEFAULT: '1px',
        0: '0px',
        1: '1px',
        2: '2px',
        3: '3px',
        4: '4px',
        6: '6px',
        8: '8px',
      },
      boxShadow: {
        DEFAULT: '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.05)',
        sm: '0 1px 2px 0 rgba(0, 0, 0, 0.03)',
        md: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05)',
        lg: '0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -4px rgba(0, 0, 0, 0.05)',
        xl: '0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
        '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
        '3xs': '0 1px 1px 0 rgba(0, 0, 0, 0.02)',
        'xs': '0 1px 2px 0 rgba(0, 0, 0, 0.03)',
        'card': '0 4px 12px -2px rgba(0, 0, 0, 0.03)',
        'card-hover': '0 12px 24px -4px rgba(0, 0, 0, 0.06)',
        'popover': '0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 16px -6px rgba(0, 0, 0, 0.08)',
        'glow': '0 0 16px 2px rgba(var(--foreground), 0.08)',
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
