/**
 * Tailwind CSS design system.
 *
 * Loaded from `styles/globals.css` via `@config "../tailwind.config.js"`.
 * Values here mirror the `@theme` tokens in globals.css; keep them in sync.
 *
 * @type {import('tailwindcss').Config}
 */
const config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Deep Islamic Green — primary brand color
        primary: {
          DEFAULT: "#1a5c3a",
          50: "#e8f5e9", // Primary Light
          100: "#d3e9d6",
          200: "#a7d3ad",
          300: "#77b983",
          400: "#4d9c5f",
          500: "#2f7f47",
          600: "#216b3d",
          700: "#1a5c3a",
          800: "#14462c",
          900: "#0e3320",
          950: "#072113",
        },
        // Islamic Gold — accent color
        gold: {
          DEFAULT: "#c9a84c",
          50: "#faf6ea",
          100: "#f4ecd4",
          200: "#e9d9a8",
          300: "#ddc57b",
          400: "#d3b763",
          500: "#c9a84c",
          600: "#a8872f",
          700: "#866a24",
          800: "#654e1b",
          900: "#453613",
        },
      },
      fontFamily: {
        sans: [
          "var(--font-inter)",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Arial",
          "sans-serif",
        ],
        arabic: [
          "var(--font-noto-arabic)",
          "var(--font-inter)",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
      },
      container: {
        center: true,
        padding: {
          DEFAULT: "1.25rem",
          md: "2rem",
        },
        // Cap the container at 1280px (Tailwind's 2xl breakpoint).
        screens: {
          "2xl": "1280px",
        },
      },
    },
  },
  plugins: [],
};

module.exports = config;
