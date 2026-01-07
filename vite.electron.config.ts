import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

// Electron-specific Vite configuration
export default defineConfig({
    plugins: [
        react(),
        tailwindcss(),
    ],
    base: './', // Use relative paths for Electron
    build: {
        outDir: 'dist',
        emptyOutDir: true,
        rollupOptions: {
            input: {
                main: path.resolve(__dirname, 'index.html'),
            },
        },
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'resources/js'),
        },
    },
    esbuild: {
        jsx: 'automatic',
    },
    // For Electron, we need to handle the environment
    define: {
        'process.env.IS_ELECTRON': JSON.stringify(true),
    },
});
