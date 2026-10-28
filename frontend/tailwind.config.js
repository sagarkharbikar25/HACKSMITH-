/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#0E0E0B",        // Dark Grey from screenshot (#0E0E0B)
        card: "#151511",      // Elevated Dark Grey card surface
        raised: "#1D1D18",    // Raised surfaces (drawer, modal, hero)
        ink: "#F4F6F0",       // Crisp off-white text
        muted: "#9E9E92",     // Secondary muted text
        line: "rgba(244, 246, 240, 0.10)", // Subtle border
        primary: "#AFE607",   // Signature Lime Green (#AFE607)
        success: "#AFE607",   // Lime Green for clean approval
        ai: "#AFE607",        // Lime Green AI chip
        signal: "#AFE607",    // Signature Lime Green (#AFE607)
        critical: "#FF5C6E",  // Critical
        high: "#FFB020",      // High
        medium: "#AFE607",    // Medium
        low: "#9E9E92",       // Low
      },
      fontFamily: {
        display: ['"Inter Tight Variable"', '"Inter Variable"', 'system-ui', 'sans-serif'],
        sans: ['"Inter Variable"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono Variable"', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        card: "16px",
        control: "12px",
      },
      transitionTimingFunction: {
        out: "cubic-bezier(0.22, 1, 0.36, 1)",
        inout: "cubic-bezier(0.65, 0, 0.35, 1)",
      }
    },
  },
  plugins: [],
}
