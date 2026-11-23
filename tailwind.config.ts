import type { Config } from 'tailwindcss';

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ocean: {
          50: '#F6F9FB',
          100: '#E2EBF0',
          200: '#C9D9E2',
          300: '#A7C0CF',
          400: '#6E9BB3',
          500: '#2E7899',
          600: '#0E86A8',
          700: '#0B4F71',
          800: '#08425D',
          900: '#102030',
          950: '#09131D',
        },
        mist: '#F6F9FB',
        midnight: '#09131D',
        abyss: '#102030',
        seafog: '#E2EBF0',
        seamist: '#1E354A',
        brand: '#0B4F71',
        branddark: '#38BDF8',
        accent: '#0E86A8',
        accentdark: '#22D3EE',
        foam: '#EAF6FB',
        coral: '#F2735B',
        sand: '#F3E7D3',
      },
      fontFamily: {
        sans: [
          'Inter',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          '"PingFang SC"',
          '"Hiragino Sans GB"',
          '"Microsoft YaHei"',
          '"Noto Sans SC"',
          'sans-serif',
        ],
        display: [
          'Inter',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          '"PingFang SC"',
          '"Hiragino Sans GB"',
          '"Microsoft YaHei"',
          '"Noto Sans SC"',
          'sans-serif',
        ],
      },
      boxShadow: {
        drift: '0 24px 60px -28px rgba(4, 34, 47, 0.45)',
        glow: '0 0 0 1px rgba(234, 246, 251, 0.18), 0 18px 48px -24px rgba(11, 79, 113, 0.65)',
      },
      borderRadius: {
        '4xl': '2rem',
      },
      backgroundImage: {
        'ocean-depth': 'linear-gradient(160deg, #12658f 0%, #0B4F71 48%, #04222f 100%)',
      },
      transitionTimingFunction: {
        drift: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
} satisfies Config;