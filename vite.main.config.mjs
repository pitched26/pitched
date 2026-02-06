import { defineConfig } from 'vite';

// https://vitejs.dev/config
export default defineConfig({
  build: {
    rollupOptions: {
      external: ['dedalus-labs', 'dedalus-labs/helpers/zod', 'dotenv'],
    },
  },
});
