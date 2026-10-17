import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          navy: '#0f172a',
          'navy-dark': '#091124',
          'navy-light': '#1e293b',
          blue: '#0284c7',
          'blue-hover': '#0369a1',
          'blue-light': '#e0f2fe',
          sky: '#38bdf8',
        },
        cta: {
          orange: '#f97316',
          'orange-hover': '#ea580c',
          'orange-light': '#ffedd5',
        },
        ota: {
          bg: '#f8fafc',
          surface: '#ffffff',
          border: '#e2e8f0',
          'border-medium': '#cbd5e1',
          subtle: '#f1f5f9',
          muted: '#64748b',
          text: '#0f172a',
        },
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 3px 0 rgba(15, 23, 42, 0.08), 0 1px 2px -1px rgba(15, 23, 42, 0.08)',
        modal: '0 8px 30px rgba(0, 0, 0, 0.25)',
      },
    },
  },
  plugins: [],
};

export default config;
