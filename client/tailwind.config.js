/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#fff4f0',
          100: '#ffe4d9',
          200: '#ffc9b3',
          300: '#ffa587',
          400: '#fb7e53',
          500: '#f2622f',
          600: '#e04c18',
          700: '#b93b12',
        },
        ink: {
          DEFAULT: '#1c1c1c',
          soft: '#3d3d3d',
          muted: '#8a8a8a',
          faint: '#b5b5b5',
        },
        canvas: {
          DEFAULT: '#f1f1f1',
          deep: '#e7e7e7',
        },
        success: {
          50: '#eefbf992',
          100: '#dcfce7',
          500: '#22c55e',
          600: '#16a34a',
        },
        warning: {
          50: '#fffbeb',
          100: '#fef3c7',
          500: '#f59e0b',
          600: '#d97706',
        },
        danger: {
          50: '#fef2f2',
          100: '#fee2e2',
          500: '#ef4444',
          600: '#dc2626',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Poppins', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        '4xl': '2rem',
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(16 24 40 / 0.04), 0 1px 3px 0 rgb(16 24 40 / 0.06)',
        panel: '0 4px 24px -8px rgb(16 24 40 / 0.12)',
        elevated: '0 8px 32px -12px rgb(16 24 40 / 0.22)',
      },
      keyframes: {
        'sparkle-pulse': {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(0.88)', opacity: '0.65' },
        },
        'ring-pulse': {
          '0%, 100%': { transform: 'scale(1)', opacity: '0.45' },
          '50%': { transform: 'scale(1.06)', opacity: '0.18' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'sparkle-pulse': 'sparkle-pulse 1.8s ease-in-out infinite',
        'ring-pulse': 'ring-pulse 2.4s ease-in-out infinite',
        'fade-up': 'fade-up 0.25s ease-out',
      },
    },
  },
  plugins: [],
}
