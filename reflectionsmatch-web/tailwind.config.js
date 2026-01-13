/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                brand: '#2563EB',
            },
            keyframes: {
                'multi-color-pulse': {
                    '0%, 100%': { filter: 'drop-shadow(0 0 10px rgba(34, 211, 238, 0.5))' }, // Cyan
                    '33%': { filter: 'drop-shadow(0 0 15px rgba(192, 38, 211, 0.6))' }, // Fuchsia/Purple
                    '66%': { filter: 'drop-shadow(0 0 12px rgba(250, 204, 21, 0.5))' }, // Yellow
                },
                'sparkle-flicker': {
                    '0%, 100%': { opacity: '0', transform: 'scale(0)' },
                    '50%': { opacity: '1', transform: 'scale(1)' },
                }
            },
            animation: {
                'multi-color-pulse': 'multi-color-pulse 3s infinite',
                'sparkle-flicker': 'sparkle-flicker 2s infinite',
            }
        },
    },
    plugins: [],
}
