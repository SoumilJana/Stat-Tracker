/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
      },
      includeAssets: ['pwa-192x192.png', 'pwa-512x512.png', 'notification-badge.png'],
      manifest: {
        name: 'StatTracker',
        short_name: 'StatTracker',
        description: 'Track your weekly stats',
        theme_color: '#0a0a0a',
        background_color: '#0a0a0a',
        display: 'standalone',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalized = id.replace(/\\/g, '/');
          if (normalized.includes('/node_modules/lucide-react/')) {
            return 'vendor-icons';
          }
          if (normalized.includes('/node_modules/@tanstack/')) {
            return 'vendor-query';
          }
          if (
            normalized.includes('/node_modules/framer-motion/') ||
            normalized.includes('/node_modules/motion-dom/') ||
            normalized.includes('/node_modules/motion-utils/')
          ) {
            return 'vendor-motion';
          }
          if (normalized.includes('/node_modules/@supabase/')) {
            return 'vendor-supabase';
          }
          if (
            normalized.includes('/node_modules/react/') ||
            normalized.includes('/node_modules/react-dom/') ||
            normalized.includes('/node_modules/react-router/') ||
            normalized.includes('/node_modules/react-router-dom/') ||
            normalized.includes('/node_modules/scheduler/')
          ) {
            return 'vendor-react';
          }
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    env: {
      VITE_SUPABASE_URL: 'https://mock.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'mock-anon-key',
    },
  },
})

