/**
 * Shared site CSS. brand.light is #F3F7FA (homepage uses tailwind.home.config.cjs).
 * Rebuild: npx tailwindcss@3.4.17 -c tailwind.config.cjs -i assets/tailwind-src.css -o assets/tailwind.css --minify
 */
module.exports = {
  content: [
    './*.html',
    './*.js',
    './scripts/**/*.mjs',
    './destinations/**/*.html',
    './forfaits/**/*.html',
    './quickform/**/*.html',
    './share/**/*.html',
  ],
  theme: {
    extend: {
      fontFamily: { sans: ['Poppins', 'sans-serif'] },
      colors: {
        brand: {
          blue: '#025091',
          orange: '#F26522',
          dark: '#1F2937',
          light: '#F3F7FA',
        },
      },
    },
  },
  plugins: [],
};
