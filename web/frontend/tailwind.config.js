/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#8B6F47',
        secondary: '#C19A6B',
        beige: '#F5F5DC',
      },
    },
  },
  plugins: [],
}
