import { randomUUID } from 'node:crypto';

/** Short random suffix used to keep generated test data unique across parallel runs. */
export function uniqueSuffix(): string {
  return randomUUID().slice(0, 8);
}
