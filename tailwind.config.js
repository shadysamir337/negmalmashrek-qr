/** @type {import('tailwindcss').Config} */
export default {
    content: ['./index.html', './src/**/*.{js,jsx}'],
    theme: {
        screens: {
            xs: '380px',
            sm: '640px',
            md: '768px',
            lg: '1024px',
            xl: '1280px',
            '2xl': '1536px',
        },
        extend: {
            colors: {
                brand: {
                    50: '#eef2ff',
                    100: '#e0e7ff',
                    200: '#c7d2fe',
                    300: '#a5b4fc',
                    400: '#818cf8',
                    500: '#6366f1',
                    600: '#4f46e5',
                    700: '#4338ca',
                    800: '#3730a3',
                    900: '#312e81',
                },
            },
            fontSize: {
                'fluid-xs': 'clamp(0.7rem, 0.65rem + 0.2vw, 0.78rem)',
                'fluid-sm': 'clamp(0.8rem, 0.75rem + 0.25vw, 0.9rem)',
                'fluid-base': 'clamp(0.9rem, 0.85rem + 0.3vw, 1rem)',
                'fluid-lg': 'clamp(1.05rem, 0.95rem + 0.5vw, 1.2rem)',
                'fluid-xl': 'clamp(1.2rem, 1rem + 0.8vw, 1.45rem)',
                'fluid-2xl': 'clamp(1.4rem, 1.1rem + 1.2vw, 1.85rem)',
                'fluid-3xl': 'clamp(1.6rem, 1.2rem + 1.8vw, 2.4rem)',
            },
            boxShadow: {
                'soft': '0 1px 2px rgba(15,23,42,.04), 0 4px 12px -2px rgba(15,23,42,.06)',
                'soft-lg': '0 4px 6px -2px rgba(15,23,42,.05), 0 12px 28px -8px rgba(15,23,42,.10)',
                'glow': '0 0 0 1px rgba(99,102,241,.15), 0 8px 24px -6px rgba(99,102,241,.35)',
            },
            keyframes: {
                'fade-in': {
                    '0%': { opacity: 0, transform: 'translateY(8px)' },
                    '100%': { opacity: 1, transform: 'translateY(0)' },
                },
                'slide-up': {
                    '0%': { opacity: 0, transform: 'translateY(20px)' },
                    '100%': { opacity: 1, transform: 'translateY(0)' },
                },
                'slide-down': {
                    '0%': { opacity: 0, transform: 'translateY(-12px)' },
                    '100%': { opacity: 1, transform: 'translateY(0)' },
                },
                'pulse-ring': {
                    '0%': { transform: 'scale(0.95)', opacity: 0.7 },
                    '50%': { transform: 'scale(1)', opacity: 1 },
                    '100%': { transform: 'scale(0.95)', opacity: 0.7 },
                },
                'shimmer': {
                    '0%': { backgroundPosition: '-200% 0' },
                    '100%': { backgroundPosition: '200% 0' },
                },
            },
            animation: {
                'fade-in': 'fade-in 0.25s ease-out',
                'slide-up': 'slide-up 0.3s ease-out',
                'slide-down': 'slide-down 0.25s ease-out',
                'pulse-ring': 'pulse-ring 2s ease-in-out infinite',
                'shimmer': 'shimmer 2s linear infinite',
            },
        },
    },
    plugins: [],
}
