import { expect, test } from '@playwright/test';

test('test argTypes/controls', async ({ page }) => {
  await page.goto('/?path=/docs/extensions-dummy-extension-components-transformerexample--docs');
  const contentFrame = page.locator('iframe[title="storybook-preview-iframe"]').contentFrame();

  const output = contentFrame.locator('#anchor--primary--extensions-dummy-extension-components-transformerexample--transform').locator('.innerZoomElementWrapper > div');
  await expect(output).toContainText('applicationType', { timeout: 10_000 }); // sometimes it is slow :/
  await expect(output).toMatchAriaSnapshot({ name: 'inital.aria.yml' });

  await test.step('change controls', async () => {
    await contentFrame.getByRole('radio', { name: '::BACKEND=backend' }).check();
    await contentFrame.locator('[id^="control-"][id$="-dateTimeInterface-date"]').fill('2025-02-17');
    await contentFrame.locator('[id^="control-"][id$="-dateTimeInterface-time"]').click();
    await contentFrame.locator('[id^="control-"][id$="-uri__url"]').fill('https://storybook.example.com/_storybook/preview?ncccc');
    await contentFrame.locator('[id^="control-"][id$="-websocket__url"]').fill('github.com');
    await contentFrame.getByRole('radio', { name: '::OK=0' }).check();
    await contentFrame.locator('[id^="control-"][id$="-combineUri__host"]').fill('andersundsehr.com');
    await contentFrame.locator('[id^="control-"][id$="-combineUri__path"]').fill('index.php');
    await contentFrame.locator('[id^="set-"][id$="-combineUri__query"]').click();
    await contentFrame.locator('[id^="control-"][id$="-combineUri__query"]').fill('Q');
    await contentFrame.locator('[id^="set-"][id$="-combineUri__fragment"]').click();
    await contentFrame.locator('[id^="control-"][id$="-combineUri__fragment"]').fill('F');
    await contentFrame.locator('[id^="set-"][id$="-combineUri__scheme"]').click();
    await contentFrame.locator('[id^="control-"][id$="-combineUri__scheme"]').fill('http');
    await contentFrame.locator('[id^="set-"][id$="-typolink__url"]').click();
    await contentFrame.locator('[id^="control-"][id$="-typolink__url"]').fill('github.com/andersundsehr/storybook-typo3');
    await contentFrame.locator('[id^="set-"][id$="-file__extPath"]').click();
    await contentFrame.locator('[id^="control-"][id$="-file__extPath"]').fill('EXT:storybook/Resources/Public/Icons/Extension.svg');
    await contentFrame.locator('[id^="set-"][id$="-fileInterface__extPath"]').click();
    await contentFrame.locator('[id^="control-"][id$="-fileInterface__extPath"]').fill('EXT:storybook/Resources/Public/Icons/Extension.svg');
    await contentFrame.locator('[id^="set-"][id$="-fileWithDefault__extPath"]').click();
    await contentFrame.locator('[id^="control-"][id$="-fileWithDefault__extPath"]').fill('EXT:storybook/Resources/Public/Icons/Extension.svg');
  });

  await expect(output).toMatchAriaSnapshot({ name: 'after-changes.aria.yml' });
});
