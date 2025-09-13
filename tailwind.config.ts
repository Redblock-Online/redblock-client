import type { Config } from 'tailwindcss'

export default {
  content: [
    './index.html',
    './src/**/*.{ts,tsx,html}',
  ],
  theme: {
    extend: {
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

