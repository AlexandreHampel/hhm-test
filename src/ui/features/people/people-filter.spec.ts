import { test, expect, UI_TAGS } from '../../../../fixtures/ui.fixture';
import { uniqueSuffix } from '../../helpers/unique';
import { IsDisplayed, NumberOf, TextOf } from '../../questions/generic';
import { IdOfListedPerson } from '../../questions/people';
import { ask, askUntilPresent, perform } from '../../screenplay/core';
import { PeopleFilter, PeopleList } from '../../targets/people';
import { OpenGeneralRegistration } from '../../tasks/navigation';
import { ClearTheFilter, FilterPeople, FindPerson, SelectRole } from '../../tasks/people-list';
import { RegisterPerson } from '../../tasks/registration';
import { buildPersonForm } from '../../payloads/person';

test.describe('People UI | Filter people', () => {
  test.describe('POSITIVE', () => {
    test('Narrows the list by name and shows how many criteria are active', {
      tag: [...UI_TAGS, '@POSITIVE'],
    }, async ({ page }) => {
      const token = `QA-UI Filter ${uniqueSuffix()}`;
      const first = buildPersonForm({ roles: ['DOCTOR'], name: `${token} Alpha` });
      const second = buildPersonForm({ roles: ['DOCTOR'], name: `${token} Beta` });

      await perform(page, RegisterPerson.with(first), RegisterPerson.with(second), SelectRole.named('DOCTOR'), FilterPeople.by({ name: token.toLowerCase() }));

      await test.step('Both people are listed, ignoring case, and one criterion is active', async () => {
        await expect.poll(() => ask(page, NumberOf.the(PeopleList.ROWS))).toBe(2);
        await askUntilPresent(page, IdOfListedPerson.withCpf(first.cpf));
        await askUntilPresent(page, IdOfListedPerson.withCpf(second.cpf));
        expect(await ask(page, TextOf.the(PeopleFilter.ACTIVE_COUNT))).toBe('1');
      });

      await perform(page, FilterPeople.by({ cpf: first.cpf }));

      await test.step('Adding the CPF of one of them leaves a single row and two active criteria', async () => {
        await expect.poll(() => ask(page, NumberOf.the(PeopleList.ROWS))).toBe(1);
        await askUntilPresent(page, IdOfListedPerson.withCpf(first.cpf));
        expect(await ask(page, TextOf.the(PeopleFilter.ACTIVE_COUNT))).toBe('2');
      });
    });

    test('Narrows the OTHER list by custom role', {
      tag: [...UI_TAGS, '@POSITIVE'],
    }, async ({ page }) => {
      const customRole = `Role ${uniqueSuffix()}`;
      const data = buildPersonForm({ roles: ['OTHER'], customRoles: ['Volunteer', customRole] });

      await perform(page, RegisterPerson.with(data), SelectRole.named('OTHER'), FilterPeople.by({ 'custom-role': customRole }));

      await test.step('Only that person is listed', async () => {
        await expect.poll(() => ask(page, NumberOf.the(PeopleList.ROWS))).toBe(1);
        await askUntilPresent(page, IdOfListedPerson.withCpf(data.cpf));
      });
    });

    test('Keeps the filter while switching roles and restores the list when cleared', {
      tag: [...UI_TAGS, '@POSITIVE'],
    }, async ({ page }) => {
      const data = buildPersonForm({ roles: ['DOCTOR', 'PATIENT'] });

      await perform(page, RegisterPerson.with(data), FindPerson.withCpf(data.cpf).under('DOCTOR'));
      const personId = await askUntilPresent(page, IdOfListedPerson.withCpf(data.cpf));

      await perform(page, SelectRole.named('PATIENT'));

      await test.step('Switching to PATIENT keeps the same filter', async () => {
        await expect.poll(() => ask(page, NumberOf.the(PeopleList.ROWS))).toBe(1);
        expect(await ask(page, IsDisplayed.the(PeopleList.row(personId)))).toBe(true);
      });

      await perform(page, ClearTheFilter());

      await test.step('Clearing the filter removes the active criteria', async () => {
        await expect.poll(() => ask(page, IsDisplayed.the(PeopleFilter.ACTIVE_COUNT))).toBe(false);
        expect(await ask(page, IsDisplayed.the(PeopleList.EMPTY_STATE))).toBe(false);
      });
    });
  });

  test.describe('NEGATIVE', () => {
    test('Explains that no people match the filter', {
      tag: [...UI_TAGS, '@NEGATIVE'],
    }, async ({ page }) => {
      await perform(
        page,
        RegisterPerson.with(buildPersonForm({ roles: ['PATIENT'] })),
        OpenGeneralRegistration(),
        SelectRole.named('PATIENT'),
        FilterPeople.by({ name: `Nobody ${uniqueSuffix()}` }),
      );

      await test.step('The no-match message is shown', async () => {
        await expect.poll(() => ask(page, NumberOf.the(PeopleList.ROWS))).toBe(0);
        expect(await ask(page, TextOf.the(PeopleList.EMPTY_STATE))).toBe('No people match the current filter.');
      });
    });
  });
});
