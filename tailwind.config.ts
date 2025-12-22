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
        // Modern editor theme colors
        editor: {
          bg: '#1e1e1e',
          surface: '#252526',
          panel: '#2d2d30',
          border: '#3c3c3c',
          text: '#e4e4e4',
          muted: '#858585',
          accent: '#0078d4',
          accentHover: '#1a8cff',
        },
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translate3d(0, 0, 0) rotate(0deg)' },
          '50%': { transform: 'translate3d(0, -10px, 0) rotate(5deg)' },
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
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      fontSize: {
        'editor-xs': ['12px', { lineHeight: '16px' }],
        'editor-sm': ['13px', { lineHeight: '18px' }],
        'editor-base': ['14px', { lineHeight: '20px' }],
        'editor-lg': ['15px', { lineHeight: '22px' }],
      },
    },
  },
  plugins: [],
} satisfies Config
