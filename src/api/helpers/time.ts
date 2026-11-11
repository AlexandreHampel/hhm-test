/** Time helpers for visit and movement timestamps. All values are ISO-8601 UTC strings. */

export const MINUTE_MS = 60_000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;

/**
 * Maximum accepted difference between two server-generated timestamps that the
 * requirement expects to be "server time" for the same request, such as a
 * defaulted `occurredAt` and the `createdAt` of the same movement.
 */
export const SAME_REQUEST_TOLERANCE_MS = 5_000;

/**
 * Margin used for "later than the server's current time" scenarios. It is large
 * enough to absorb reasonable clock skew between the runner and the API host.
 */
export const FUTURE_MARGIN_MS = HOUR_MS;

export function isoAgo(ms: number): string {
  return new Date(Date.now() - ms).toISOString();
}

export function isoFromNow(ms: number): string {
  return new Date(Date.now() + ms).toISOString();
}

/** Shifts an ISO timestamp by the given number of milliseconds. */
export function shiftIso(iso: string, ms: number): string {
  return new Date(Date.parse(iso) + ms).toISOString();
}

/** Milliseconds since the epoch for an ISO timestamp, failing loudly on invalid input. */
export function toEpoch(iso: string | null | undefined): number {
  const epoch = Date.parse(String(iso));

  if (Number.isNaN(epoch)) {
    throw new TypeError(`Not a valid timestamp: ${iso}`);
  }

  return epoch;
}
