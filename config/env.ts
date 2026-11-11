import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Loads the `.env` file at the root of this project, when present, for the API
 * settings. Playwright does not load env files on its own, so without this step
 * settings such as the database used for test data cleanup would only come from
 * the shell.
 * Variables already defined in the environment take precedence over the file.
 * Uses the loader built into Node.js (20.12+), so no extra dependency is needed.
 */
export const ENV_FILE = resolve(__dirname, '..', '.env');

if (existsSync(ENV_FILE)) {
  process.loadEnvFile(ENV_FILE);
}
