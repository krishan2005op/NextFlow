import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/store/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          purple: "#7C3AED",
        },
        canvas: {
          bg: "#0F0F0F",
          node: "#1A1A1A",
          border: "#2A2A2A",
        },
      },
      keyframes: {
        "pulse-glow": {
          "0%, 100%": {
            boxShadow: "0 0 0 0 rgba(124, 58, 237, 0.55)",
          },
          "50%": {
            boxShadow: "0 0 24px 6px rgba(124, 58, 237, 0.75)",
          },
        },
      },
      animation: {
        "pulse-glow": "pulse-glow 1.5s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
