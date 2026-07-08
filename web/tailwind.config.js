/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        vento: {
          navy: "#0F172A",
          cyan: "#22D3EE",
          light: "#F1F5F9",
        },
      },
    },
  },
  plugins: [],
};
