import { preact } from '@preact/preset-vite'
import { UserConfig } from 'vite'
import monkey, { cdn } from 'vite-plugin-monkey'

export default {
    build: {
        minify: true,
    },
    plugins: [
        monkey({
            entry: 'src/main.tsx',
            userscript: {
                name: 'Cathay Award Search Fixer',
                namespace: 'https://github.com/injust',
                version: '3.3.1+injust',
                author: 'injust',
                description: 'Un-elevate your Cathay award search',
                homepageURL: 'https://github.com/injust/cathay-award-search',
                match: [
                    'https://*.cathaypacific.com/cx/*/book-a-trip/redeem-flights/facade.html',
                    'https://*.cathaypacific.com/cx/*/book-a-trip/redeem-flights/redeem-flight-awards.html',
                    'https://book.cathaypacific.com/*',
                ],
                sandbox: 'JavaScript',
                noframes: true,
            },
            build: {
                externalGlobals: {
                    classnames: cdn.jsdelivr('classNames'),
                    dayjs: cdn.jsdelivr('dayjs'),
                    'dayjs-plugin-utc': cdn.jsdelivr('dayjsPluginUTC'),
                    preact: cdn.jsdelivr('preact'),
                    'preact-render-to-string': cdn.jsdelivr('preactRenderToString', 'dist/index.umd.min.js'),
                },
            },
        }),
        preact(),
    ],
} satisfies UserConfig
