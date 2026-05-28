/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          blue:   "#0b3ea8",
          orange: "#fc6b04",
          green:  "#16a34a",
        },
      },
    },
  },
  plugins: [],
};
