import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['bin/index.ts'],
  format: ['esm'],
  target: 'esnext',
  clean: true,
});