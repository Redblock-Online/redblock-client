import type { Config } from 'tailwindcss'

export default {
  content: [
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx,html}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        rb: {
          red: '#ff0000',
          bg: '#ffffff',
          surface: '#f8f8f8',
          panel: '#f3f4f6',
          border: '#e5e7eb',
          text: '#111827',
          muted: '#6b7280',
        },
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px) rotate(0deg)' },
          '50%': { transform: 'translateY(-10px) rotate(5deg)' },
        },
      },
      animation: {
        float: 'float 4s ease-in-out infinite',
      },
      boxShadow: {
        'red-3': '3px 3px 0 #ff0000',
      },
      fontFamily: {
        mono: ['"Courier New"', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
} satisfies Config
