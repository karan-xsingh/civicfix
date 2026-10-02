/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        asphalt: { DEFAULT: '#24272B', 2: '#32363B' },
        concrete: '#EDEAE3',
        panel: '#F7F5F0',
        ink: '#1B1B1B',
        inksoft: '#5B5B57',
        line: '#D8D4C8',
        signal: { yellow: '#F5B700', orange: '#D8571F', blue: '#3E6680', green: '#3A7D5D' }
      },
      fontFamily: {
        display: ['Oswald', 'sans-serif'],
        sans: ['"IBM Plex Sans"', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace']
      }
    }
  },
  plugins: []
};
