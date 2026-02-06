/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'SF Pro Text',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
      },
      colors: {
        overlay: {
          bg: 'rgba(28, 28, 32, 0.72)',
          border: 'rgba(255, 255, 255, 0.12)',
          text: 'rgba(255, 255, 255, 0.95)',
          'text-muted': 'rgba(255, 255, 255, 0.65)',
          accent: 'rgba(129, 140, 248, 0.9)',
          'accent-soft': 'rgba(129, 140, 248, 0.25)',
        },
      },
      backdropBlur: {
        glass: '20px',
      },
      borderRadius: {
        panel: '15px',
      },
      boxShadow: {
        panel: '0 8px 32px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.06)',
      },
      animation: {
        'fade-slide': 'fadeSlide 0.35s ease-out forwards',
      },
      keyframes: {
        fadeSlide: {
          '0%': { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
