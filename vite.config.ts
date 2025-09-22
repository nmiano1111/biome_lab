import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import swc from 'rollup-plugin-swc3';

export default defineConfig({
  plugins: [
    react(), // keep your existing React plugin
    swc({
      jsc: {
        parser: { syntax: 'typescript', tsx: true },
        transform: { react: { runtime: 'automatic' } },
      },
      // apply to TS/TSX only
      include: /\.[jt]sx?$/,
      exclude: /node_modules/,
    }),
  ],
});