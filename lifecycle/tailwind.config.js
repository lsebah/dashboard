/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,ts,jsx,tsx}', './lib/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Charte CMF (bleu marine de l'extranet vizibility)
        cmf: {
          navy: '#0f2748',
          blue: '#1d4ed8',
          slate: '#64748b',
        },
        situation: {
          positive: '#22c55e',
          neutre: '#94a3b8',
          proche: '#f59e0b',
          sous: '#ef4444',
        },
      },
    },
  },
  plugins: [],
}
