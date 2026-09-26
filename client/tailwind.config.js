const color = (name) => `rgb(var(--${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{ts,tsx,html}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Surfaces and text are CSS variables so light/dark themes don't need dark: variants everywhere.
        // See src/render/index.css
        canvas: color("canvas"),
        panel: color("panel"),
        surface: {
          DEFAULT: color("surface"),
          raised: color("surface-raised"),
          sunken: color("surface-sunken"),
        },
        line: color("line"),
        fg: {
          DEFAULT: color("fg"),
          muted: color("fg-muted"),
          subtle: color("fg-subtle"),
        },
        accent: {
          DEFAULT: color("accent"),
          strong: color("accent-strong"),
          fg: color("accent-fg"),
        },
        success: color("success"),
        warning: color("warning"),
        danger: color("danger"),
        info: color("info"),
      },
      fontFamily: {
        sans: ['"Inter Variable"', "Inter", "system-ui", "Segoe UI", "sans-serif"],
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem" }],
      },
      boxShadow: {
        card: "0 1px 2px rgb(0 0 0 / 0.04), 0 1px 1px rgb(0 0 0 / 0.02)",
        pop: "0 12px 32px -8px rgb(0 0 0 / 0.35), 0 2px 6px rgb(0 0 0 / 0.12)",
        glow: "0 0 0 1px rgb(var(--accent) / 0.4), 0 6px 20px -6px rgb(var(--accent) / 0.55)",
      },
      keyframes: {
        "fade-in": { from: { opacity: "0", transform: "translateY(4px)" }, to: { opacity: "1", transform: "none" } },
        "scale-in": { from: { opacity: "0", transform: "scale(0.97)" }, to: { opacity: "1", transform: "none" } },
        shimmer: { from: { backgroundPosition: "200% 0" }, to: { backgroundPosition: "-200% 0" } },
        stripes: { from: { backgroundPosition: "0 0" }, to: { backgroundPosition: "28px 0" } },
      },
      animation: {
        "fade-in": "fade-in 180ms ease-out",
        "scale-in": "scale-in 160ms ease-out",
        shimmer: "shimmer 1.6s linear infinite",
        stripes: "stripes 0.8s linear infinite",
      },
    },
  },
  plugins: [],
};
