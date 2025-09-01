
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./**/*.{js,ts,jsx,tsx}",
  ],
  safelist: [
    // Layout & Display
    'hidden', 'block', 'flex', 'grid',

    // Typography
    'font-medium', 'font-semibold',
    'text-gray-500', 'text-neutral-600', 'text-gray-700',
    { pattern: /text-(xs|sm|base|lg|xl)/ },

    // Spacing
    { pattern: /p-[1-4]/ },
    { pattern: /px-[2-4]/ },
    { pattern: /py-[1-2]/ },

    // Borders & Rounded corners
    'border',
    { pattern: /rounded(-(md|lg|2xl))?/ },
    { pattern: /border(-(gray|neutral)-200)?/ },

    // Backgrounds
    { pattern: /bg-(white|gray-50|gray-100|neutral-50)/ },
    { pattern: /hover:bg-(gray|neutral)-100/ },

    // Dark mode
    { pattern: /dark:(bg-neutral-900|text-neutral-100)/ },
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '8px',
        lg: '12px',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
      },
    },
  },
  plugins: [],
}
