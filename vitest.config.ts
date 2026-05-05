import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    include: ['server/**/*.test.ts', 'client/src/**/*.test.ts', 'client/src/**/*.test.tsx'],
    environment: 'node',
  },
});
