/**
 * Homepage only. brand.light stays #F9FAFB, the value already in index.html.
 * Rebuild: npx tailwindcss@3.4.17 -c tailwind.home.config.cjs -i assets/tailwind-src.css -o assets/tailwind-home.css --minify
 */
module.exports = {
  content: [
    './index.html',
    './index-Jean-pc.html',
    './api.js',
    './embed.js',
    './config.js',
  ],
  theme: {
    extend: {
      fontFamily: { sans: ['Poppins', 'sans-serif'] },
      colors: {
        brand: {
          blue: '#025091',
          orange: '#F26522',
          dark: '#1F2937',
          light: '#F9FAFB',
        },
      },
    },
  },
  plugins: [],
};
