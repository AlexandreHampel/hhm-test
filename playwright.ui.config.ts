
import { defineConfig, devices } from '@playwright/test';
import * as UI_SETTINGS from './config/ui-settings';

const ci = Boolean(process.env.CI);

const chromeDefaults = {
  ...devices['Desktop Chrome'],
  ...(UI_SETTINGS.BROWSER_EXECUTABLE_PATH ? {} : { channel: 'chrome' as const }),
  locale: 'en',
};

const browserLanguage = {
  args: [`--lang=${UI_SETTINGS.BROWSER_LANGUAGE}`],
  env: {
    ...process.env,
    LANGUAGE: UI_SETTINGS.BROWSER_LANGUAGE.replace('-', '_'),
    LANG: `${UI_SETTINGS.BROWSER_LANGUAGE.replace('-', '_')}.UTF-8`,
    LC_ALL: `${UI_SETTINGS.BROWSER_LANGUAGE.replace('-', '_')}.UTF-8`,
  },
};

export default defineConfig({
  testDir: './src/ui/features',
  outputDir: './test-results/ui',

  globalSetup: require.resolve('./config/global-setup.ts'),

  timeout: UI_SETTINGS.EXECUTION_TIMEOUT,

  expect: {
    timeout: UI_SETTINGS.EXPECT_TIMEOUT,
  },

  fullyParallel: true,
  forbidOnly: ci,
  retries: UI_SETTINGS.RETRY_COUNT,
  workers: UI_SETTINGS.NWORKERS,

  reporter: [
    ['list'],
    ['html', {
      outputFolder: 'playwright-report/ui',
      open: 'never',
    }],
    ['json', {
      outputFile: 'playwright-report/ui-test-results.json',
    }],
    ['blob', {
      outputDir: 'blob-report/ui',
    }],
  ],

  use: {
    baseURL: UI_SETTINGS.APP_BASE_URL,
    navigationTimeout: UI_SETTINGS.NAVIGATION_TIMEOUT,
    actionTimeout: UI_SETTINGS.ACTION_TIMEOUT,
    storageState: undefined,

    video: {
      mode: 'retain-on-failure',
      size: { width: 1920, height: 1080 },
    },

    screenshot: {
      mode: 'only-on-failure',
      fullPage: true,
    },

    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'headed-chrome',
      use: {
        ...chromeDefaults,
        headless: false,
        viewport: null,
        deviceScaleFactor: undefined,

        launchOptions: {
          slowMo: UI_SETTINGS.SLOWMO,
          executablePath: UI_SETTINGS.BROWSER_EXECUTABLE_PATH,
          args: ['--start-maximized', ...browserLanguage.args],
          env: browserLanguage.env,
        },
      },
    },
    {
      name: 'headless-chrome',
      use: {
        ...chromeDefaults,
        headless: true,

        viewport: {
          width: 1920,
          height: 1080,
        },

        launchOptions: {
          slowMo: UI_SETTINGS.SLOWMO,
          executablePath: UI_SETTINGS.BROWSER_EXECUTABLE_PATH,
          args: browserLanguage.args,
          env: browserLanguage.env,
        },
      },
    },
  ],
});
