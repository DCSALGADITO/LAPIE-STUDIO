/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        void: "#F5F5F7",
        panel: "rgba(255, 255, 255, 0.75)",
        elevated: "rgba(255, 255, 255, 1)",
        subtle: "rgba(0, 0, 0, 0.08)",
        glow: "rgba(0, 0, 0, 0.05)",
        ink: {
          primary: "#1D1D1F",
          secondary: "#424245",
          muted: "rgba(0, 0, 0, 0.5)",
        },
        forge: {
          violet: "#5E5CE6",
          "violet-light": "#BF5AF2",
          "violet-glow": "rgba(94, 92, 230, 0.15)",
          cyan: "#32ADE6",
          "cyan-light": "#64D2FF",
          "cyan-glow": "rgba(50, 173, 230, 0.15)",
          apple: "#007AFF",
        },
        status: {
          pending: "#FF9F0A",
          processing: "#007AFF",
          completed: "#34C759",
          failed: "#FF3B30",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "-apple-system", "BlinkMacSystemFont", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains)", "ui-monospace", "monospace"],
      },
      animation: {
        "pulse-glow": "pulse-glow 3s ease-in-out infinite",
        "shimmer": "shimmer 2.5s linear infinite",
        "fade-in": "fade-in 0.5s cubic-bezier(0.16, 1, 0.3, 1)",
        "slide-up": "slide-up 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
        "spin-slow": "spin 5s linear infinite",
        "float": "float 4s ease-in-out infinite",
      },
      keyframes: {
        "pulse-glow": {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.8", transform: "scale(1.02)" },
        },
        "shimmer": {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "fade-in": {
          from: { opacity: "0", filter: "blur(8px)" },
          to: { opacity: "1", filter: "blur(0)" },
        },
        "slide-up": {
          from: { transform: "translateY(24px)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
        "float": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        }
      },
      boxShadow: {
        "glow-violet": "0 8px 32px rgba(191, 90, 242, 0.25)",
        "glow-cyan": "0 8px 32px rgba(100, 210, 255, 0.2)",
        "panel": "0 12px 48px rgba(0, 0, 0, 0.6)",
        "apple": "0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1)",
      },
      backgroundImage: {
        "gradient-forge": "linear-gradient(135deg, #BF5AF2, #32ADE6)",
        "gradient-forge-soft": "linear-gradient(135deg, rgba(191,90,242,0.15), rgba(50,173,230,0.15))",
        "shimmer-gradient": "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.1) 50%, transparent 100%)",
      },
    },
  },
  plugins: [],
};
