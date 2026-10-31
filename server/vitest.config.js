import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    environment: 'node', fileParallelism: false, testTimeout: 20000, hookTimeout: 30000,
    env: { NODE_ENV: 'test', JWT_SECRET: 'test-secret-test-secret-test-secret-test-secret-123456', CLIENT_URL: 'http://localhost:5173' },
  },
});
