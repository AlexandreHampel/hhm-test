import { PersonReference } from './models/visit';

/** Extracts the identifier from a plain or populated `people` reference. */
export function referenceId(reference: PersonReference | null | undefined): string | undefined {
  if (reference === null || reference === undefined) {
    return undefined;
  }

  return typeof reference === 'string' ? reference : reference._id;
}
