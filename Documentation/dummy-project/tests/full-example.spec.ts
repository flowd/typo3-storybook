import { expect, test } from '@playwright/test';

test('test argTypes/controls', async ({ page }) => {
  await page.goto('/?path=/docs/extensions-dummy-extension-components-fullexample--docs');
  const frame = page.locator('iframe[title="storybook-preview-iframe"]').contentFrame();

  const docs = frame.locator('#storybook-docs');
  await test.step('check if the component is rendered', async () => {
    await expect(docs).toContainText('Translation: The default Header Comment. EN', { timeout: 10_000 }); // storybook is not the fastest
    // the docs page renders the primary story twice: in the Primary block (anchor--primary--…) and again in the
    // Stories block (anchor--…). Scope the switch to the Primary block instead of relying on DOM order.
    const primary = frame.locator('#anchor--primary--extensions-dummy-extension-components-fullexample--only-required');
    await primary.getByRole('switch', { name: 'Show code' }).click();
    await expect(primary.getByText('<de:fullexample').describe('Code Block')).toBeVisible();
    await expect(frame.locator('#anchor--extensions-dummy-extension-components-fullexample--only-required')).toMatchAriaSnapshot({ name: 'story-with-only-required-arguments.aria.yml' });
  });

  const story = frame.locator('#story--extensions-dummy-extension-components-fullexample--only-required--primary-inner');

  await test.step('check if the story is rendered', async () => {
    await frame.getByPlaceholder('Edit string...').fill('this is still required');
    await expect(story).toContainText('requiredArgument => \'this is still required\' (22 chars)');
    await expect(docs).toContainText('this is still required');
  });
  await test.step('optionalBool => FALSE', async () => {
    await frame.locator('[id^="set-"][id$="-optionalBool"]').click();
    await expect(story).toContainText('optionalBool => FALSE');
    await expect(docs).toContainText('optionalBool="{false}"');
    await expect(docs).toContainText('optionalBool: false');
  });
  await test.step('optionalBool => TRUE', async () => {
    // the checkbox itself is visually hidden inside its label, so the label takes the click
    await frame.locator('label[for$="-optionalBool"]').click();
    await expect(story).toContainText('optionalBool => TRUE');
    await expect(docs).toContainText('optionalBool="{true}"');
    await expect(docs).toContainText('optionalBool: true');
  });
  await test.step('optionalInt => 13.37', async () => {
    await frame.locator('[id^="set-"][id$="-optionalInt"]').click();
    await frame.locator('[id^="control-"][id$="-optionalInt"]').fill('13.37');
    await expect(story).toContainText('optionalInt => 13 (integer)');
    await expect(docs).toContainText('optionalInt="13"');
    await expect(docs).toContainText('optionalInt: 13');
  });
  await test.step('optionalFloat => 13.38', async () => {
    await frame.locator('[id^="set-"][id$="-optionalFloat"]').click();
    await frame.locator('[id^="control-"][id$="-optionalFloat"]').fill('13.38');
    await expect(story).toContainText('optionalFloat => 13.38 (double)');
    await expect(docs).toContainText('optionalFloat="13.38"');
    await expect(docs).toContainText('optionalFloat: 13.38');
  });
  await test.step('optionalString => Optional String', async () => {
    await frame.locator('[id^="set-"][id$="-optionalString"]').click();
    await frame.locator('[id^="control-"][id$="-optionalString"]').fill('Optional String');
    await expect(story).toContainText('optionalString => \'Optional String\' (15 chars)');
    await expect(docs).toContainText('optionalString="Optional String"');
    await expect(docs).toContainText('optionalString: \'Optional String\'');
  });
  await test.step('slot => <b>\'default\' "Slot" Content</b>', async () => {
    await frame.locator('[id^="set-"][id$="-slot____default"]').click();
    await frame.locator('[id^="control-"][id$="-slot____default"]').fill('<b>\'default\' "Slot" Content</b>');
    await expect(story).toContainText('Slot Content: \'default\' "Slot" Content');
    await expect(docs).toContainText('<b>\'default\' "Slot" Content</b>');
    await expect(docs).toContainText('{\'<b>\\\'default\\\' "Slot" Content</b>\' ->');
  });
  await test.step('stroy with slot', async () => {
    const exampleWithSlot = frame.locator('#anchor--extensions-dummy-extension-components-fullexample--with-slot');
    await exampleWithSlot.getByRole('switch', { name: 'Show code' }).click();
    await expect(exampleWithSlot.getByText('<de:fullexample').describe('Code Block Visible')).toBeVisible();
    await expect(exampleWithSlot).toMatchAriaSnapshot({ name: 'story-with-slot.aria.yml' });
  });
});
