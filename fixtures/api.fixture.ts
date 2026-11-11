import { test as base } from '@playwright/test';
import { PeopleClient } from '../src/api/clients/people';
import { VisitsClient } from '../src/api/clients/visits';
import { DatabaseClient } from '../src/api/clients/database';
import { DATABASE_CLEANUP, MONGO_URI } from '../config/api-settings';

type ApiFixtures = {
  peopleApi: PeopleClient;
  visitsApi: VisitsClient;
};

type ApiWorkerFixtures = {
  /** Undefined when database cleanup is disabled (DATABASE_CLEANUP in config/api-settings.ts). */
  database: DatabaseClient | undefined;
};

/**
 * API fixtures. The `peopleApi` client is scoped per scenario and deletes
 * every person it created once the scenario finishes, so scenarios never
 * depend on each other or on execution order.
 *
 * Module clients whose data cannot be deleted through the API, such as
 * `visitsApi`, purge it through the `database` fixture and depend on
 * `peopleApi`, so Playwright tears them down first and people are deleted last.
 * The database connection is opened once per worker, and only by workers that
 * run a scenario needing it.
 */
export const test = base.extend<ApiFixtures, ApiWorkerFixtures>({
  peopleApi: async ({ request }, use) => {
    const client = new PeopleClient(request);

    await use(client);
    await client.cleanup();
  },

  database: [async ({}, use) => {
    if (!DATABASE_CLEANUP) {
      await use(undefined);
      return;
    }

    if (!MONGO_URI) {
      throw new Error(
        'This scenario needs database access to remove test data that the API cannot delete. ' +
        'Provide the MONGO_HOST, MONGO_PORT, MONGO_DATABASE, MONGO_USER and MONGO_PASSWORD variables of the backend `.env` file, ' +
        'or set DATABASE_CLEANUP to false in config/api-settings.ts.',
      );
    }

    const database = await DatabaseClient.connect(MONGO_URI);

    await use(database);
    await database.close();
  }, { scope: 'worker' }],

  visitsApi: async ({ request, peopleApi, database }, use) => {
    const client = new VisitsClient(request, peopleApi, database);

    await use(client);
    await client.cleanup();
  },
});

export { expect } from '@playwright/test';

/** Common tags for the General Registration API scenarios. */
export const API_TAGS = ['@API', '@People'] as const;

/** Common tags for the Patient Visits API scenarios. */
export const VISIT_API_TAGS = ['@API', '@Visits'] as const;
