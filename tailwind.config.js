/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Instrument Serif"', "Georgia", "serif"],
        body: ['"Outfit"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "monospace"],
      },
      colors: {
        ink: {
          50: "#f6f5f0",
          100: "#ebe9df",
          200: "#d4d0c0",
          300: "#b8b19c",
          400: "#9a9078",
          500: "#7d725c",
          600: "#635a49",
          700: "#4d453a",
          800: "#3a3430",
          900: "#2a2521",
          950: "#1a1714",
        },
      },
    },
  },
  plugins: [],
};
