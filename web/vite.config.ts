import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev: semua /api (termasuk WebSocket stream) diteruskan ke backend.
// Browser tidak pernah bicara langsung ke go2rtc.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: process.env.VITE_BACKEND_URL || 'http://127.0.0.1:3000',
        ws: true,
      },
    },
  },
});
