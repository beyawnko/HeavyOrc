
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
    'text-xs', 'text-sm', 'text-base', 'text-lg', 'text-xl',
    'font-medium', 'font-semibold',
    'text-gray-500', 'text-neutral-600', 'text-gray-700',

    // Spacing
    'p-1', 'p-2', 'p-3', 'p-4', 'px-2', 'px-3', 'px-4', 'py-1', 'py-2',

    // Borders & Rounded corners
    'rounded', 'rounded-md', 'rounded-lg', 'rounded-2xl',
    'border', 'border-gray-200', 'border-neutral-200',

    // Backgrounds
    'bg-white', 'bg-gray-50', 'bg-gray-100', 'bg-neutral-50',
    'hover:bg-gray-100', 'hover:bg-neutral-100',

    // Dark mode
    'dark:bg-neutral-900', 'dark:text-neutral-100',
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
