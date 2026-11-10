import { expect, Page, test } from '@playwright/test';

/**
 * Screenplay building blocks, without actors.
 *
 * Interactions are atomic operations on the interface, tasks are business
 * activities composed of interactions or other tasks, and questions read the
 * state of the interface. Everything receives the page it works on.
 */

type Kind = 'interaction' | 'task';

/** Something that can be performed on a page: an interaction or a task. */
export interface Performable {
  readonly kind: Kind;
  readonly description: string;
  performAs(page: Page): Promise<void>;
}

/** Something that can be answered by reading the page. */
export interface Question<T> {
  readonly description: string;
  answeredBy(page: Page): Promise<T>;
}

class Activity implements Performable {
  constructor(
    readonly kind: Kind,
    readonly description: string,
    private readonly body: (page: Page) => Promise<void>,
  ) {}

  performAs(page: Page): Promise<void> {
    return this.body(page);
  }

  toString(): string {
    return this.description;
  }
}

/** Runs activities in order. Tasks are reported as steps, interactions run silently inside them. */
async function run(page: Page, activities: readonly Performable[]): Promise<void> {
  for (const activity of activities) {
    if (activity.kind === 'task') {
      await test.step(activity.description, () => activity.performAs(page));
    } else {
      await activity.performAs(page);
    }
  }
}

/** Defines an atomic interaction with the interface. */
export function interaction(description: string, body: (page: Page) => Promise<void>): Performable {
  return new Activity('interaction', description, body);
}

/** Defines a task as a fixed sequence of interactions or other tasks. */
export function task(description: string, ...activities: Performable[]): Performable {
  return new Activity('task', description, (page) => run(page, activities));
}

/** Defines a task whose steps depend on what the interface shows while it runs. */
export function taskWhere(description: string, body: (page: Page) => Promise<void>): Performable {
  return new Activity('task', description, body);
}

/** Defines a question about the current state of the interface. */
export function question<T>(description: string, answer: (page: Page) => Promise<T>): Question<T> {
  return { description, answeredBy: answer, toString: () => description } as Question<T>;
}

/** Performs the given activities on the page. */
export async function perform(page: Page, ...activities: Performable[]): Promise<void> {
  await run(page, activities);
}

/** Answers a question about the page as it is right now. */
export function ask<T>(page: Page, subject: Question<T>): Promise<T> {
  return subject.answeredBy(page);
}

/** Keeps asking until the answer satisfies the condition, then returns it. */
export async function askUntil<T>(page: Page, subject: Question<T>, isSatisfied: (answer: T) => boolean): Promise<T> {
  let answer!: T;

  await expect
    .poll(async () => {
      answer = await subject.answeredBy(page);
      return isSatisfied(answer);
    }, { message: `Waiting for an answer to: ${subject.description}` })
    .toBe(true);

  return answer;
}

/** Keeps asking until the question has an answer other than null or undefined, then returns it. */
export async function askUntilPresent<T>(page: Page, subject: Question<T>): Promise<NonNullable<T>> {
  return (await askUntil(page, subject, (answer) => answer !== null && answer !== undefined)) as NonNullable<T>;
}
