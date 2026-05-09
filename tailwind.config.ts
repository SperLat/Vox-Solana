import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}", "./lib/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#101014",
        paper: "#f6f3ed",
        clay: "#b95d3d",
        sage: "#6f8068",
        vox: "#2f64d6",
        vinyl: "#1d1b20"
      },
      boxShadow: {
        soft: "0 18px 60px rgba(16, 16, 20, 0.12)",
        line: "0 0 0 1px rgba(16, 16, 20, 0.08)"
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
        serif: ["var(--font-newsreader)", "Newsreader", "Georgia", "serif"]
      }
    }
  },
  plugins: []
};

export default config;
