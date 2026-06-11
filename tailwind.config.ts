import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-display)", "ui-sans-serif", "system-ui"],
        body: ["var(--font-body)", "ui-sans-serif", "system-ui"],
      },
      colors: {
        // Dark glass palette
        abyss: "#070a14",
        deep: "#0d1126",
        haze: "rgba(255,255,255,0.06)",
        hazeStrong: "rgba(255,255,255,0.10)",
        // Accents
        aqua: "#22d3ee",
        iris: "#8b5cf6",
        mint: "#34d399",
        coral: "#fb7185",
        gold: "#fbbf24",
        // Text
        frost: "#e7ecf5",
        mist: "#8b93a7",
      },
      backgroundImage: {
        "accent-gradient": "linear-gradient(135deg, #22d3ee 0%, #8b5cf6 100%)",
        "accent-gradient-soft":
          "linear-gradient(135deg, rgba(34,211,238,0.16) 0%, rgba(139,92,246,0.16) 100%)",
        "gold-gradient": "linear-gradient(135deg, #fde68a 0%, #f59e0b 100%)",
      },
      boxShadow: {
        glass: "0 8px 32px rgba(0,0,0,0.35)",
        glassLg: "0 16px 48px rgba(0,0,0,0.45)",
        glowAqua: "0 0 24px rgba(34,211,238,0.30)",
        glowIris: "0 0 24px rgba(139,92,246,0.30)",
        glowGold: "0 0 28px rgba(251,191,36,0.40)",
        glowMint: "0 0 20px rgba(52,211,153,0.35)",
      },
      animation: {
        "pulse-gold": "pulse-gold 1.6s ease-in-out infinite",
        float: "float 6s ease-in-out infinite",
        "float-slow": "float 9s ease-in-out infinite",
        shimmer: "shimmer 2.4s linear infinite",
        "fade-up": "fade-up 0.6s cubic-bezier(0.22,1,0.36,1) both",
      },
      keyframes: {
        "pulse-gold": {
          "0%,100%": { boxShadow: "0 0 0 0 rgba(251,191,36,0.55)" },
          "50%": { boxShadow: "0 0 26px 8px rgba(251,191,36,0.0)" },
        },
        float: {
          "0%,100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "200% 50%" },
          "100%": { backgroundPosition: "-200% 50%" },
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(14px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
