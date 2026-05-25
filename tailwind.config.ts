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
        // Cheesy retro lotto palette
        cream: "#fff4c4",
        parchment: "#fde68a",
        cherry: "#dc2626",
        cherryDark: "#7f1d1d",
        banana: "#fcd34d",
        sunshine: "#fbbf24",
        royal: "#1e40af",
        lime: "#84cc16",
        hot: "#ec4899",
        ink: "#1a0a02",
        // Status colors used by the number grid + balls
        avail: "#fff4c4",
        pending: "#f59e0b",
        reserved: "#dc2626",
        mine: "#16a34a",
        gold: "#fbbf24",
      },
      backgroundImage: {
        "stripes": "repeating-linear-gradient(45deg, #dc2626 0 22px, #fcd34d 22px 44px)",
        "stripes-soft": "repeating-linear-gradient(45deg, rgba(220,38,38,0.15) 0 14px, rgba(252,211,77,0.15) 14px 28px)",
        "checker": "repeating-conic-gradient(#fcd34d 0% 25%, #fff4c4 0% 50%)",
      },
      boxShadow: {
        hard: "4px 4px 0 0 #1a0a02",
        hardSm: "2px 2px 0 0 #1a0a02",
        hardLg: "6px 6px 0 0 #1a0a02",
      },
      animation: {
        "pulse-gold": "pulse-gold 1.2s ease-in-out infinite",
        shake: "shake 0.4s ease-in-out infinite",
        "marquee-bulbs": "marquee-bulbs 1s steps(2) infinite",
        "wiggle": "wiggle 0.6s ease-in-out infinite",
        "spin-slow": "spin 12s linear infinite",
        "blink": "blink 0.9s steps(2) infinite",
      },
      keyframes: {
        "pulse-gold": {
          "0%,100%": { boxShadow: "0 0 0 0 rgba(251,191,36,0.85)" },
          "50%": { boxShadow: "0 0 30px 10px rgba(251,191,36,0.0)" },
        },
        shake: {
          "0%,100%": { transform: "translate(0,0)" },
          "25%": { transform: "translate(-1px,1px)" },
          "75%": { transform: "translate(1px,-1px)" },
        },
        "marquee-bulbs": {
          "0%": { filter: "brightness(1)" },
          "100%": { filter: "brightness(1.6)" },
        },
        wiggle: {
          "0%,100%": { transform: "rotate(-2deg)" },
          "50%": { transform: "rotate(2deg)" },
        },
        blink: {
          "0%": { opacity: "1" },
          "100%": { opacity: "0.35" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
