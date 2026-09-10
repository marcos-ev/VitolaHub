import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Painel web das charutarias parceiras (seção 5.6/7 da spec) — app Vite
// isolado, sem relação com o bundler Metro usado pelo app mobile.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
});
