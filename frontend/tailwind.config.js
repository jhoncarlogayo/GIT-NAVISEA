/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        navy: {
          50:  '#f0f4ff',
          100: '#e0eaff',
          600: '#1e3a5f',
          700: '#162d4a',
          800: '#0f1f35',
          900: '#0a1628',
        },
      },
      fontFamily: {
        sans: ['Segoe UI', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
