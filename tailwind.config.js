/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#EEF0FE', 100: '#D9DDFB', 200: '#B6BCF7', 300: '#8E97F1',
          400: '#6B76EC', 500: '#3B4FE0', 600: '#2E3DB8', 700: '#232C8C',
          800: '#1A2168', 900: '#13174A',
        },
        accent: {
          50: '#FEF6E8', 100: '#FBE8C2', 200: '#F7D089', 300: '#F5BD5B',
          400: '#F5A623', 500: '#D98C0A', 600: '#B0730A', 700: '#87580A',
        },
        ink: {
          50: '#F7F7F8', 100: '#EFEFF1', 200: '#DCE0E4', 300: '#C2C7CE',
          400: '#9BA1AB', 500: '#717880', 600: '#565C64', 700: '#3D4248',
          800: '#272B30', 900: '#171A1E',
        },
        success: '#2E7D32',
        warning: '#ED8936',
        danger: '#D32F2F',
      },
      fontFamily: {
        display: ['Inter', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        soft: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        float: '0 10px 30px rgba(0,0,0,0.10), 0 4px 12px rgba(0,0,0,0.06)',
      },
      keyframes: {
        slideDown: { '0%': { opacity: '0', transform: 'translateY(-8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        slideUp: { '0%': { opacity: '0', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        slideRight: { '0%': { opacity: '0', transform: 'translateX(-8px)' }, '100%': { opacity: '1', transform: 'translateX(0)' } },
        pulseDot: { '0%,100%': { opacity: '1' }, '50%': { opacity: '0.4' } },
        popIn: { '0%': { opacity: '0', transform: 'scale(0.8)' }, '100%': { opacity: '1', transform: 'scale(1)' } },
      },
      animation: {
        slideDown: 'slideDown 0.2s ease-out',
        slideUp: 'slideUp 0.2s ease-out',
        slideRight: 'slideRight 0.2s ease-out',
        pulseDot: 'pulseDot 1.4s ease-in-out infinite',
        popIn: 'popIn 0.15s ease-out',
      },
    },
  },
  plugins: [],
};
