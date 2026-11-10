const KEBAB_CASE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Rule violations found in a set of rendered test IDs. */
export interface TestIdViolations {
  duplicates: string[];
  notKebabCase: string[];
  indexBased: string[];
}

/**
 * Checks rendered test IDs against the contract: unique within the page,
 * English kebab case, and never built from array positions.
 */
export function testIdViolations(testIds: readonly string[]): TestIdViolations {
  return {
    duplicates: [...new Set(testIds.filter((testId, index) => testIds.indexOf(testId) !== index))],
    notKebabCase: testIds.filter((testId) => !KEBAB_CASE.test(testId)),
    indexBased: testIds.filter((testId) => /-(index|idx)-?\d*$/.test(testId)),
  };
}

export const NO_VIOLATIONS: TestIdViolations = Object.freeze({ duplicates: [], notKebabCase: [], indexBased: [] }) as TestIdViolations;
