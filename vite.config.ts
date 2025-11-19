import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // This ensures the API_KEY from Vercel build environment is available in the browser code
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY)
  }
});