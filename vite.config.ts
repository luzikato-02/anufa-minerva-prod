import { wayfinder } from '@laravel/vite-plugin-wayfinder';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import laravel from 'laravel-vite-plugin';
import { defineConfig } from 'vite';

export default defineConfig({
    plugins: [
        laravel({
            input: ['resources/css/app.css', 'resources/js/app.tsx'],
            ssr: 'resources/js/ssr.tsx',
            refresh: true,
        }),
        react(),
        tailwindcss(),
        wayfinder({
            formVariants: true,
        }),
    ],
    esbuild: {
        jsx: 'automatic',
    },

    server: {
    host: '0.0.0.0', // Allow external devices to access Vite
    cors: true,
    hmr: {
      host: 'anufa-minerva.vercel.app', // or your HTTPS domain if using remote dev
      protocol: 'wss',   // Use WebSocket Secure if needed
    },
  },
});
