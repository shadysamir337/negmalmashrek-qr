import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'))

// Vite config for QR Attendance.
// - Dev server listens on the LAN so phones can scan QRs at the same URL.
// - manualChunks splits big vendors so the gzipped main bundle stays slim
//   and Vite stops emitting the "chunks larger than 500 kB" warning.
// - __APP_VERSION__ is replaced at build time with package.json `version`.
export default defineConfig({
    plugins: [react()],
    define: {
        __APP_VERSION__: JSON.stringify(pkg.version),
    },
    server: {
        host: true,
        port: 5173,
    },
    build: {
        // The Cloud Run Dockerfile copies this directory into nginx.
        outDir: 'build',
        sourcemap: false,
        chunkSizeWarningLimit: 800,
        rollupOptions: {
            output: {
                manualChunks: {
                    react: ['react', 'react-dom', 'react-router-dom'],
                    firebase: [
                        'firebase/app',
                        'firebase/auth',
                        'firebase/firestore',
                        'firebase/app-check',
                    ],
                    qr: ['qrcode', 'qrcode.react', 'html5-qrcode'],
                    xlsx: ['xlsx'],
                    icons: ['lucide-react'],
                },
            },
        },
    },
})
