import { defineConfig, devices } from '@playwright/test';

/**
 * E2E runs against the real production build served statically — the same
 * artefact that goes to GitHub Pages, service worker included. Testing the dev
 * server would skip precisely the layer that makes the app work offline.
 */
const PORT = 4173;
const BASE = `http://127.0.0.1:${PORT}/Courses/`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['list']] : 'list',
  timeout: 45_000,
  use: {
    baseURL: BASE,
    trace: 'retain-on-failure',
    ...devices['Desktop Chrome'],
  },
  webServer: {
    // Bind explicitly to 127.0.0.1: `vite preview` otherwise listens on
    // `localhost`, which on CI runners can resolve to ::1 while Playwright polls
    // the IPv4 address — the server comes up and the wait still times out.
    command: `npm run build && npx vite preview --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: BASE,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
