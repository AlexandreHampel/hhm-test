import { APIResponse, expect } from '@playwright/test';

/** Returns a short, human-readable description of a response for assertion messages. */
export async function describeResponse(response: APIResponse): Promise<string> {
  let body = '';

  try {
    body = (await response.text()).slice(0, 500);
  } catch {
    body = 'Unreadable body';
  }

  return `${response.status()} ${response.url()} -> ${body}`;
}

/** Asserts the response status is one of the expected codes, printing the body on failure. */
export async function expectStatus(response: APIResponse, expected: number | readonly number[]): Promise<void> {
  const accepted = typeof expected === 'number' ? [expected] : [...expected];

  expect(accepted, `Unexpected HTTP status. Response: ${await describeResponse(response)}`).toContain(
    response.status(),
  );
}

/** Parses a JSON body, failing with a descriptive message when the body is not JSON. */
export async function readJson<T>(response: APIResponse): Promise<T> {
  const contentType = response.headers()['content-type'] ?? '';

  expect(contentType, `Expected a JSON response. Response: ${await describeResponse(response)}`).toContain(
    'application/json',
  );

  return (await response.json()) as T;
}
