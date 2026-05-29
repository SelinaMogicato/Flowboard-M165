/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{astro,html,js,jsx,ts,tsx,svelte}"],
  darkMode: "class",
  theme: {
    // Responsive Breakpoints - Mobile First Approach
    screens: {
      xs: "475px", // Extra small devices
      sm: "640px", // Small devices (tablets)
      md: "768px", // Medium devices (small laptops)
      lg: "1024px", // Large devices (desktops)
      xl: "1280px", // Extra large devices
      "2xl": "1536px", // 2X Extra large devices
    },
    extend: {
      spacing: {
        "container-mobile": "1rem", // 16px
        "container-tablet": "1.5rem", // 24px
        "container-desktop": "2rem", // 32px
      },
      colors: {
        // Primary brand colors from color palette
        "sunrise-red": "#DA291C", // Pantone 485 C
        "grey-dusk": "#3D3935", // Pantone Black 7 C
        "pale-dawn": "#E6E3DF", // Pantone Warm Gray 1 C
        "ice-white": "#FFFFFF", // Ice White
        peach: {
          50: "#fff7f2",
          100: "#fdeee6",
          200: "#f8d9cf",
          300: "#f2c2b6",
          400: "#e7a79f",
          500: "#c48d8a", // Peach Fog main
          600: "#a87476",
          700: "#8c5d62",
          800: "#6f4950",
          900: "#51363d",
        },
        "brand-gradient-start": "#9a8794",
        "brand-gradient-end": "#f5d7b3",

        ink: {
          100: "#ededf0",
          300: "#b7b7c2",
          500: "#6b6b7d",
          700: "#363647",
          800: "#262635",
          900: "#161622",
        },

        surface: {
          50: "#ffffff",
          100: "#fcfbfa",
          200: "#f6f4f2",
          300: "#efebe8",
        },
      },

      backgroundImage: {
        "peach-fog": "linear-gradient(180deg, #9a8794 0%, #f5d7b3 100%)",
      },

      boxShadow: {
        card: "0 12px 35px rgba(22, 22, 34, 0.12)",
      },

      borderRadius: {
        xl: "1rem",
        "2xl": "1.25rem",
        "3xl": "1.75rem",
      },
    },
  },
  plugins: [],
};
