
import { FullConfig } from '@playwright/test';
import * as UI_SETTINGS from './ui-settings';
import * as API_SETTINGS from './api-settings';

async function globalSetup(config: FullConfig): Promise<void> {
  const configFile = config.configFile ?? '';

  if (configFile.endsWith('playwright.ui.config.ts')) {
    setupUI();
    return;
  }

  if (configFile.endsWith('playwright.api.config.ts')) {
    setupAPI();
    return;
  }

  throw new Error(`Unknown Playwright configuration: ${configFile}`);
}

function setupUI(): void {
  validateURL(UI_SETTINGS.APP_BASE_URL);

  console.log('========== UI TEST SETTINGS ==========');
  console.log(`Application URL: ${UI_SETTINGS.APP_BASE_URL}`);
  console.log(`Parallel workers: ${UI_SETTINGS.NWORKERS}`);
  console.log(`Retry attempts: ${UI_SETTINGS.RETRY_COUNT}`);
  console.log(`Test timeout: ${UI_SETTINGS.EXECUTION_TIMEOUT} ms`);
  console.log(`Assertion timeout: ${UI_SETTINGS.EXPECT_TIMEOUT} ms`);
  console.log(`Navigation timeout: ${UI_SETTINGS.NAVIGATION_TIMEOUT} ms`);
  console.log(`Action timeout: ${UI_SETTINGS.ACTION_TIMEOUT} ms`);
  console.log(`Action delay: ${UI_SETTINGS.SLOWMO} ms`);
}

function setupAPI(): void {
  validateURL(API_SETTINGS.APP_BASE_URL);

  console.log('========== API TEST SETTINGS ==========');
  console.log(`Application URL: ${API_SETTINGS.APP_BASE_URL}`);
  console.log(`Parallel workers: ${API_SETTINGS.NWORKERS}`);
  console.log(`Retry attempts: ${API_SETTINGS.RETRY_COUNT}`);
  console.log(`Test timeout: ${API_SETTINGS.EXECUTION_TIMEOUT} ms`);
  console.log(`Assertion timeout: ${API_SETTINGS.EXPECT_TIMEOUT} ms`);
  console.log(`Action timeout: ${API_SETTINGS.ACTION_TIMEOUT} ms`);
  console.log(`Test data cleanup database: ${!API_SETTINGS.DATABASE_CLEANUP
    ? 'disabled (DATABASE_CLEANUP is false)'
    : API_SETTINGS.MONGO_URI_MASKED ?? 'NOT configured (scenarios that need it will fail)'}`);
}

function validateURL(url: string): void {
  if (!/^https?:\/\/.+/.test(url)) {
    throw new TypeError(`Invalid application URL: "${url}".`);
  }
}

export default globalSetup;
