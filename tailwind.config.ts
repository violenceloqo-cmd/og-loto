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
        // Bull-market coal palette
        abyss: "#08080a",
        deep: "#121116",
        haze: "rgba(255,255,255,0.05)",
        hazeStrong: "rgba(255,255,255,0.09)",
        // Accents — repurposed for the Bullotto / Ansem theme.
        // aqua = bull green (gains), iris = bronze horn, mint = lime "yours",
        // gold = trophy horn, coral = charging-red urgency.
        aqua: "#2fd576",
        iris: "#c08b4f",
        mint: "#a3e635",
        coral: "#ff4d3d",
        gold: "#f5b13d",
        // Text
        frost: "#f5f1e8",
        mist: "#928d83",
      },
      backgroundImage: {
        "accent-gradient": "linear-gradient(135deg, #2fd576 0%, #f5b13d 100%)",
        "accent-gradient-soft":
          "linear-gradient(135deg, rgba(47,213,118,0.16) 0%, rgba(245,177,61,0.16) 100%)",
        "gold-gradient": "linear-gradient(135deg, #ffe39a 0%, #f59e0b 100%)",
        "bull-gradient": "linear-gradient(135deg, #2fd576 0%, #16a34a 100%)",
      },
      boxShadow: {
        glass: "0 8px 32px rgba(0,0,0,0.45)",
        glassLg: "0 16px 48px rgba(0,0,0,0.55)",
        glowAqua: "0 0 24px rgba(47,213,118,0.32)",
        glowIris: "0 0 24px rgba(192,139,79,0.32)",
        glowGold: "0 0 28px rgba(245,177,61,0.45)",
        glowMint: "0 0 20px rgba(163,230,53,0.38)",
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
          "0%,100%": { boxShadow: "0 0 0 0 rgba(245,177,61,0.6)" },
          "50%": { boxShadow: "0 0 26px 8px rgba(245,177,61,0.0)" },
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
