/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      colors: {
        moto: {
          50: '#FFF4EB',
          100: '#FFE4CC',
          400: '#FF9A3D',
          500: '#FF6B00',
          600: '#E55A00',
          700: '#C44A00',
        },
        navy: {
          800: '#1A1A2E',
          900: '#0F0F14',
          950: '#0A0A0F',
        },
        go: {
          500: '#00C853',
          600: '#00A844',
        },
      },
      fontFamily: {
        sans: ['Outfit', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
