import { defineConfig } from 'vite'
import monkey from 'vite-plugin-monkey'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        monkey({
            entry: 'src/main.ts',
            userscript: {
                name: 'Cathay Award Search Fixer',
                namespace: 'https://github.com/injust',
                version: '3.3.0+injust',
                author: 'injust',
                description: 'Un-elevate your Cathay award search',
                homepageURL: 'https://github.com/injust/cathay-award-search',
                downloadURL: 'https://github.com/injust/cathay-award-search/raw/main/cx.user.js',
                match: [
                    'https://*.cathaypacific.com/cx/*/book-a-trip/redeem-flights/facade.html',
                    'https://*.cathaypacific.com/cx/*/book-a-trip/redeem-flights/redeem-flight-awards.html',
                    'https://book.cathaypacific.com/*'
                ],
                sandbox: 'DOM'
            },
        }),
    ],
})
