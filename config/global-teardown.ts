import { FullConfig, request } from '@playwright/test';
import * as API_SETTINGS from './api-settings';
import { PEOPLE_ENDPOINTS } from '../src/api/clients/endpoints';
import { COLLECTIONS } from '../src/api/clients/collections';
import { DatabaseClient } from '../src/api/clients/database';
import { TEST_DATA_PREFIX } from '../src/api/payloads/person';
import { Person } from '../src/api/helpers/models/person';

/**
 * Safety net after a run. Every scenario already removes its own data, but an
 * interrupted run (killed worker, teardown timeout) or an older version of the
 * suite can leave records behind. It runs after all workers have finished, so
 * it never touches data of the current run; do not share one environment
 * between concurrent runs.
 */
async function globalTeardown(config: FullConfig): Promise<void> {
  const configFile = config.configFile ?? '';

  if (configFile.endsWith('playwright.api.config.ts')) {
    await sweepLeftoverTestData(API_SETTINGS.APP_BASE_URL, TEST_DATA_PREFIX);
  }
}

/**
 * Removes every person whose name starts with the given test data prefix,
 * after purging their records from every collection declared in COLLECTIONS.
 */
async function sweepLeftoverTestData(baseURL: string, prefix: string): Promise<void> {
  if (!API_SETTINGS.DATABASE_CLEANUP) {
    console.log('Leftover test data sweep skipped: database cleanup is disabled.');
    return;
  }

  if (!API_SETTINGS.MONGO_URI) {
    console.log('Leftover test data sweep skipped: database access is not configured.');
    return;
  }

  const api = await request.newContext({ baseURL });

  try {
    const response = await api.get(PEOPLE_ENDPOINTS.root);

    if (!response.ok()) {
      console.warn(`Leftover test data sweep skipped: ${PEOPLE_ENDPOINTS.root} returned ${response.status()}.`);
      return;
    }

    const people = (await response.json()) as Person[];
    const ownerIds = people.filter((person) => person.name.startsWith(`${prefix} `)).map((person) => person._id);

    if (ownerIds.length === 0) {
      return;
    }

    const database = await DatabaseClient.connect(API_SETTINGS.MONGO_URI);

    try {
      for (const collection of Object.values(COLLECTIONS)) {
        const purged = await database.purge(collection, { ownerIds });
        console.log(`Removed ${purged} leftover ${collection.name} records (with their dependents).`);
      }
    } finally {
      await database.close();
    }

    for (const id of ownerIds) {
      await api.delete(PEOPLE_ENDPOINTS.byId(id));
    }

    console.log(`Removed ${ownerIds.length} leftover people prefixed "${prefix}".`);
  } finally {
    await api.dispose();
  }
}

export default globalTeardown;
