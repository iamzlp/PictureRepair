/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      colors: {
        "archive-ink": "#080a0e",
        "archive-panel": "#151a21",
        "archive-paper": "#faf3e7",
        "archive-mist": "#b9b2a8",
        "archive-copper": "#b88358",
        "archive-rose": "#917a86",
      },
      boxShadow: {
        "soft-panel": "0 24px 70px rgba(0, 0, 0, 0.24)",
        "soft-glow": "0 28px 80px rgba(184, 131, 88, 0.12)",
      },
    },
  },
  plugins: [],
};
