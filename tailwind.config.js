/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        spotify: {
          green: "#1DB954",
          greenHover: "#1ed760",
          greenActive: "#169c46",
          black: "#121212",
          card: "#181818",
          cardHover: "#282828",
          elevated: "#242424",
          highlight: "#2a2a2a",
          border: "#282828",
          subdued: "#a7a7a7",
          subtext: "#b3b3b3",
          lightGray: "#727272",
        }
      },
      fontFamily: {
        sans: ['CircularSp', 'CircularSp-Arab', 'CircularSp-Hebr', 'CircularSp-Cyrl', 'Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-subtle': 'bounceSubtle 0.8s ease-in-out infinite alternate',
      },
      keyframes: {
        bounceSubtle: {
          '0%': { transform: 'scale(1)' },
          '100%': { transform: 'scale(1.05)' },
        }
      }
    },
  },
  plugins: [],
}
