/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        base: "#000000",
        panel: "#0D0F14",
        panel2: "#161920",
        border: "#262B36",
        amber: "#F5B942",
        cyan: "#5EEAD4",
        alert: "#E64C4C",
        ok: "#4ADE80",
        ink: "#E5E9F0",
        muted: "#7A8AA6",
      },
      fontFamily: {
        display: ["'Space Grotesk'", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
      },
    },
  },
  plugins: [],
}
