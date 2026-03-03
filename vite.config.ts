import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 5173,
      host: '0.0.0.0',
      open: true,
    },
    plugins: [react()],
    define: {
      // For @google/genai SDK which reads process.env
      'process.env.API_KEY':         JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY':  JSON.stringify(env.GEMINI_API_KEY),
      // Also expose as import.meta.env for Vite-native access in gemini.ts
      'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: { '@': path.resolve(__dirname, '.') },
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom'],
            charts:  ['recharts'],
            genai:   ['@google/genai'],
          },
        },
      },
    },
  };
});
