import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#0A0E1A',
        foreground: '#F5F5F5',
        card: '#131829',
        'card-hover': '#1A1F2E',
        border: '#2A2F3A',
        'primary-blue': '#2563EB',
        'primary-blue-light': '#3B82F6',
        'accent-teal': '#06B6D4',
        'accent-teal-light': '#14B8A6',
        'on-state': '#84CC16',
        'gold': '#D4A017',
        'purple': '#7C3AED',
        'red-warn': '#EF4444',
        'muted': '#8B8F99',
        'muted-light': '#A0A5AE',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      borderRadius: {
        lg: '12px',
        md: '8px',
        sm: '4px',
      },
      boxShadow: {
        glass: '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
        'glass-hover': '0 8px 32px 0 rgba(31, 38, 135, 0.5)',
      },
      backdropFilter: {
        glass: 'blur(4px) brightness(1.1)',
      },
    },
  },
  plugins: [],
};

export default config;
