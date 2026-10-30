import { defineConfig, devices } from '@playwright/test';

const PORT = 4174;
const MATURE_PORT = 4175;
/** The default build served under /Inspire-card-parlor/, as on GitHub Pages. */
const PAGES_PORT = 4176;

// Lets sandboxes with a preinstalled Chromium reuse it; CI uses `npx playwright install chromium`.
const executablePath = process.env.PW_CHROMIUM_PATH || undefined;

/** Adult-content edition tests run against a separate build with the edition flag on. */
const MATURE_SPECS = /\.mature\.spec\.ts$/;
const PAGES_SPECS = /\.pages\.spec\.ts$/;
const TABLET_SPECS = /(main-menu|screens|progression|toolbar|solitaire|games|story)\.spec\.ts$/;

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}/`,
    trace: 'retain-on-failure',
    launchOptions: { executablePath },
  },
  projects: [
    {
      name: 'phone-portrait',
      testIgnore: [MATURE_SPECS, PAGES_SPECS],
      use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, hasTouch: true },
    },
    {
      name: 'small-phone',
      testIgnore: [MATURE_SPECS, PAGES_SPECS],
      use: { ...devices['Desktop Chrome'], viewport: { width: 360, height: 640 }, hasTouch: true },
    },
    {
      name: 'phone-landscape',
      testIgnore: [MATURE_SPECS, PAGES_SPECS],
      use: { ...devices['Desktop Chrome'], viewport: { width: 844, height: 390 }, hasTouch: true },
    },
    {
      name: 'desktop',
      testIgnore: [MATURE_SPECS, PAGES_SPECS],
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    // Tablets: the layout-focused specs (menus, screens, tables, toolbar, progression).
    {
      name: 'tablet-portrait',
      testMatch: TABLET_SPECS,
      use: { ...devices['Desktop Chrome'], viewport: { width: 820, height: 1180 }, hasTouch: true },
    },
    {
      name: 'tablet-landscape',
      testMatch: TABLET_SPECS,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1180, height: 820 }, hasTouch: true },
    },
    {
      name: 'mature-edition',
      testMatch: MATURE_SPECS,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
        baseURL: `http://localhost:${MATURE_PORT}/`,
      },
    },
    {
      name: 'github-pages',
      testMatch: PAGES_SPECS,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
        baseURL: `http://localhost:${PAGES_PORT}/Inspire-card-parlor/`,
      },
    },
  ],
  webServer: [
    {
      command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
      port: PORT,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: `VITE_ENABLE_MATURE_CONTENT=true npx vite build --outDir dist-mature && npx vite preview --outDir dist-mature --port ${MATURE_PORT} --strictPort`,
      port: MATURE_PORT,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      // Reads dist/ on each request, so it serves whatever the first server built.
      command: `node scripts/serve-pages.mjs ${PAGES_PORT}`,
      port: PAGES_PORT,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
