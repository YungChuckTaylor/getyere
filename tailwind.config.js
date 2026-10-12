/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts}', './public/**/*.js'],
  theme: {
    extend: {
      fontFamily: { sans: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'] },
      colors: {
        ink: { 50:'#f4f6fb',100:'#e8ecf6',200:'#cdd5e8',300:'#a3b2d2',400:'#7389b5',500:'#536b9a',600:'#41547f',700:'#364468',800:'#2f3a56',900:'#1a2033',950:'#0e1220' },
        ember: { 400:'#fb923c',500:'#f97316',600:'#ea580c' }
      },
      boxShadow: {
        glow: '0 0 40px -8px rgba(99,102,241,0.45)',
        card: '0 1px 2px rgba(15,23,42,.04), 0 8px 24px -8px rgba(15,23,42,.12)'
      }
    }
  },
  plugins: []
};
