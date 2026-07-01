export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}"
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f6f9fd',
          100: '#eaf0fa',
          200: '#cddbfa',
          300: '#a9c4ef',
          400: '#5887d9',
          500: '#2660d3',    
          600: '#1b4d9f',
          700: '#173b76',
          800: '#102349',
          900: '#0a1a34'
        },
        secondary: {
          50: '#f3f5f9',
          100: '#ebeef3',
          200: '#e0e2e7',
          300: '#ced0d7',
          400: '#aeb4be',
          500: '#7b848e',   
          600: '#5d6670',
          700: '#484e57',
          800: '#383c41',
          900: '#22232a'
        },
        sapphire: {
          50: '#f6f9fd',
          100: '#eaf0fa',
          200: '#cddbfa',
          300: '#a9c4ef',
          400: '#5887d9',
          500: '#2660d3',    
          600: '#1b4d9f',
          700: '#173b76',
          800: '#102349',
          900: '#0a1a34'
        },
        platinum: {
          50: '#f3f5f9',
          100: '#ebeef3',
          200: '#e0e2e7',
          300: '#ced0d7',
          400: '#aeb4be',
          500: '#7b848e',    
          600: '#5d6670',
          700: '#484e57',
          800: '#383c41',
          900: '#22232a'
        },
      },
      fontFamily: {
        sans: ['Inter', 'Montserrat', 'sans-serif'],
      },
      boxShadow: {
        luxe: '0 4px 32px 0 rgba(38,96,211,0.12)',
        'glass': '0 8px 32px 0 rgba(38, 96, 211, 0.15)',
        'glass-lg': '0 25px 50px -12px rgba(38, 96, 211, 0.25)',
        'glass-xl': '0 35px 60px -12px rgba(38, 96, 211, 0.35)',
      },
      borderRadius: {
        xl: '1.5rem',
        '2xl': '2rem',
        '3xl': '3rem',
      },
      backdropBlur: {
        xs: '2px',
        sm: '4px',
        md: '8px',
        lg: '12px',
        xl: '16px',
        '2xl': '24px',
        '3xl': '32px',
      },
      backgroundColor: {
        'glass': 'rgba(255, 255, 255, 0.25)',
        'glass-dark': 'rgba(255, 255, 255, 0.1)',
        'glass-light': 'rgba(255, 255, 255, 0.4)',
      },
      borderColor: {
        'glass': 'rgba(255, 255, 255, 0.18)',
        'glass-dark': 'rgba(255, 255, 255, 0.1)',
      },
    },
  },
  plugins: [],
}
