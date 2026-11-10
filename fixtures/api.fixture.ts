import { test as base } from '@playwright/test';
import { PeopleClient } from '../src/api/clients/people.client';

type ApiFixtures = {
  peopleApi: PeopleClient;
};

/**
 * API fixtures. The `peopleApi` client is scoped per scenario and deletes
 * every person it created once the scenario finishes, so scenarios never
 * depend on each other or on execution order.
 */
export const test = base.extend<ApiFixtures>({
  peopleApi: async ({ request }, use) => {
    const client = new PeopleClient(request);

    await use(client);
    await client.cleanup();
  },
});

export { expect } from '@playwright/test';

/** Common tags for the General Registration API scenarios. */
export const API_TAGS = ['@API', '@People'] as const;
