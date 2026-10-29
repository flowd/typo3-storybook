import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Entry, PresetProperty } from 'storybook/internal/types';
import { viteFinal } from './functions/viteFinal.ts';

/**
 * The directory of a package, resolved from this package: Storybook reads the addon's `exports` from there,
 * so the addons work with a package manager that does not hoist them (pnpm, nested installs).
 */
function getAbsolutePath<I extends string>(value: I): I {
  return dirname(fileURLToPath(import.meta.resolve(`${value}/package.json`))) as I;
}

export const addons: PresetProperty<'addons'> = [
  getAbsolutePath('@storybook/addon-docs'),
  getAbsolutePath('@storybook/addon-a11y'),
];

/**
 * We want storybook to not use your local vite config.
 * As that is not really needed, and can cause issues or break storybook.
 */
export { viteFinal };

/**
 * Storybook 10 wants the builder as a fully resolved entry point and the renderer as its preset file.
 * @see https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#corebuilder-configuration-must-be-a-fully-resolved-path
 */
export const core: PresetProperty<'core'> = {
  builder: import.meta.resolve('@storybook/builder-vite'),
  renderer: import.meta.resolve('@storybook/server/preset'),
  disableTelemetry: true,
};

export const previewAnnotations: PresetProperty<'previewAnnotations'> = async (entry: Entry[] = [], options) => {
  const docsEnabled = Object.keys(await options.presets.apply('docs', {}, options)).length > 0;

  return entry
    .concat(fileURLToPath(import.meta.resolve('./entry-preview.js')))
    .concat(docsEnabled ? [fileURLToPath(import.meta.resolve('./entry-preview-docs.js'))] : []);
};

export const tags = ['autodocs'];

/**
 * BUGFIX for chromium based browsers on windows
 * @see https://github.com/talkjs/country-flag-emoji-polyfill?tab=readme-ov-file
 */
export const managerHead = `<style>
  body {
    font-family: "Twemoji Country Flags", "Nunito Sans", -apple-system, ".SFNSText-Regular", "San Francisco", BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Helvetica, Arial, sans-serif !important;
  }
  @font-face {
    font-family: "Twemoji Country Flags";
    unicode-range: U+1F1E6-1F1FF, U+1F3F4, U+E0062-E0063, U+E0065, U+E0067, U+E006C, U+E006E, U+E0073-E0074, U+E0077, U+E007F;
    src: url('https://cdn.jsdelivr.net/npm/country-flag-emoji-polyfill@0.1/dist/TwemojiCountryFlags.woff2') format('woff2');
    font-display: swap;
  }
</style>`;
