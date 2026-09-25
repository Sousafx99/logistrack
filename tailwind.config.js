/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: {
          primary: 'var(--color-background-primary)',
          secondary: 'var(--color-background-secondary)',
          tertiary: 'var(--color-background-tertiary)',
        },
        border: {
          secondary: 'var(--color-border-secondary)',
          tertiary: 'var(--color-border-tertiary)',
        },
        text: {
          primary: 'var(--color-text-primary)',
          secondary: 'var(--color-text-secondary)',
          tertiary: 'var(--color-text-tertiary)',
        },
        primary: {
          DEFAULT: '#2563eb',
          light: '#3b82f6',
          dark: '#1d4ed8',
        },
        success: 'var(--color-background-success)',
        warning: 'var(--color-background-warning)',
        danger: 'var(--color-background-danger)',
        info: 'var(--color-background-info)',
      },
    },
  },
  plugins: [],
}
