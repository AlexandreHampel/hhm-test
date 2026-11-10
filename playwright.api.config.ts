
import { defineConfig } from '@playwright/test';
import * as API_SETTINGS from './config/api-settings';

const ci = Boolean(process.env.CI);

export default defineConfig({
  testDir: './src/api/features',
  outputDir: './test-results/api',
  
  globalSetup: require.resolve('./config/global-setup.ts'),

  timeout: API_SETTINGS.EXECUTION_TIMEOUT,

  expect: {
    timeout: API_SETTINGS.EXPECT_TIMEOUT,
  },

  fullyParallel: true,
  forbidOnly: ci,
  retries: API_SETTINGS.RETRY_COUNT,
  workers: API_SETTINGS.NWORKERS,

  reporter: [
    ['list'],
    ['html', {
      outputFolder: 'playwright-report/api',
      open: 'never',
    }],
    ['json', {
      outputFile: 'playwright-report/api-test-results.json',
    }],
    ['blob', {
      outputDir: 'blob-report/api',
    }],
  ],

  use: {
    baseURL: API_SETTINGS.APP_BASE_URL,
    actionTimeout: API_SETTINGS.ACTION_TIMEOUT,

    extraHTTPHeaders: {
      Accept: 'application/json',
    },

    trace: 'on-first-retry',
  },
});
