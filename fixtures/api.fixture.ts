import { test as base } from '@playwright/test';
import { PeopleClient } from '../src/api/clients/people';
import { VisitsClient } from '../src/api/clients/visits';

type ApiFixtures = {
  peopleApi: PeopleClient;
  visitsApi: VisitsClient;
};

export const test = base.extend<ApiFixtures>({
  peopleApi: async ({ request }, use) => {
    await use(new PeopleClient(request));
  },

  visitsApi: async ({ request, peopleApi }, use) => {
    await use(new VisitsClient(request, peopleApi));
  },
});

export { expect } from '@playwright/test';

/** Common tags for the General Registration API scenarios. */
export const API_TAGS = ['@API', '@People'] as const;

/** Common tags for the Patient Visits API scenarios. */
export const VISIT_API_TAGS = ['@API', '@Visits'] as const;
