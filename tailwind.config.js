/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                'clara-green': '#004D40',
                'clara-burgundy': '#6B0D0D',
                'clara-cream': '#FDF5E6',
            },
            fontFamily: {
                'serif': ['Merriweather', 'serif'],
                'sans': ['DM Sans', 'sans-serif'],
            },
        },
    },
    plugins: [],
}
