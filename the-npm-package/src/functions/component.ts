import type { FluidComponent } from '../types/types';

/** Prefix of a slot in the args of a story: `slot____default` */
export const SLOT_PREFIX = 'slot____';

export type StoryArgs = Record<string, unknown>;

export interface StoryExport {
  name?: string;
  args?: StoryArgs;
}

/** A stories module: the meta as default export, every other export a story */
export interface StoryModule {
  default: { component: FluidComponent; args?: StoryArgs };
  [exportName: string]: unknown;
}

/** Loads a stories module on demand, as the values of `import.meta.glob` do */
export type StoryModuleLoader = () => Promise<unknown>;

export interface ComponentOptions {
  /**
   * The component name without namespace of a stories file, from its path as `import.meta.glob` gives it.
   * Default: `componentNameFromPath`.
   */
  componentName?: (path: string) => string;
}

/** The Fluid tag rendering a story of a component: `await component('de:card', 'Pirate')` */
export type ComponentFunction = (name: string, story: string, overrides?: StoryArgs) => Promise<string>;

/** A component with the args to render it with */
export interface ComponentTarget {
  component: FluidComponent;
  args: StoryArgs;
}

/**
 * The component name of a stories file from its path: the path below `Components/` without the extension,
 * as lowercase dot path. A file named after its directory stands for that directory:
 * `Components/Card/Card.stories.ts` and `Components/Card.stories.ts` both give `card`,
 * `Components/Atom/Button/Button.stories.js` gives `atom.button`.
 */
export function componentNameFromPath(path: string): string {
  const segments = path
    .replace(/^.*\/Components\//, '')
    .replace(/\.stories\.[cm]?[jt]sx?$/, '')
    .split('/');
  if (segments.length > 1 && segments[segments.length - 1] === segments[segments.length - 2]) {
    segments.pop();
  }
  return segments.join('.').toLowerCase();
}

/**
 * `component()` over the given stories files, the result of `import.meta.glob` over them:
 * `await component('de:card', 'Pirate')` gives the Fluid tag rendering that story, built from its args (the meta
 * args merged with the story's args): `<de:card title="Yar Pirate Ipsum" text="…" link="…" />`. Slots become the
 * children of the tag or `<f:fragment>`s. With the extension setting `renderSlotsAsFluid` the tag can be the slot
 * content of another story, which renders the component inside that story; slots built the same way nest to any
 * depth.
 *
 * `story` is the export name of the story (case-insensitive) or its `name`. `overrides` replaces single args of
 * that story, keyed as in the stories file (`slot____<name>` for slots; `null` or `''` drops the attribute):
 * `await component('de:card', 'Pirate', { link: '#', slot____default: 'Read more' })`.
 *
 * Arguments built by a transformer (`name__part` keys) have no Fluid form: write such a tag by hand with inline
 * Fluid values. Stories must not reference each other in a cycle; their module imports would wait forever.
 */
export function createComponent(storyFiles: Record<string, StoryModuleLoader>, options: ComponentOptions = {}): ComponentFunction {
  const index = indexStoryFiles(storyFiles, options.componentName ?? componentNameFromPath);
  return async (name: string, story: string, overrides: StoryArgs = {}): Promise<string> => {
    const target = await loadStory(index, name, story);
    return toFluid({ ...target, args: { ...target.args, ...overrides } });
  };
}

/** The Fluid tag for a component: args as attributes, slots as children or `<f:fragment>` */
export function toFluid(target: ComponentTarget): string {
  const tag = target.component.fullName;
  const attributes: string[] = [];
  const slots = new Map<string, string>();
  const transformed = new Set<string>();
  for (const [key, value] of Object.entries(target.args)) {
    if (value === null || value === undefined || value === '') {
      continue;
    }
    if (key.startsWith(SLOT_PREFIX)) {
      slots.set(key.slice(SLOT_PREFIX.length), String(value));
      continue;
    }
    if (key.includes('__')) {
      transformed.add(key.split('__')[0] ?? key);
      continue;
    }
    attributes.push(`${key}="${attributeValue(value)}"`);
  }
  if (transformed.size > 0) {
    const names = [...transformed].join(', ');
    throw new Error(`${tag}: ${names} come from a transformer and have no Fluid form, write the tag by hand`);
  }

  const openTag = `<${tag}${attributes.length > 0 ? ' ' + attributes.join(' ') : ''}`;
  if (slots.size === 0) {
    return `${openTag} />`;
  }
  // the default slot is the content outside of fragments
  let children = slots.get('default') ?? '';
  for (const [slotName, content] of slots) {
    if (slotName !== 'default') {
      children += `<f:fragment name="${slotName}">${content}</f:fragment>`;
    }
  }
  return `${openTag}>${children}</${tag}>`;
}

/** Stories file loaders keyed by component name */
function indexStoryFiles(storyFiles: Record<string, StoryModuleLoader>, componentName: (path: string) => string): Map<string, StoryModuleLoader> {
  const index = new Map<string, StoryModuleLoader>();
  for (const [path, load] of Object.entries(storyFiles)) {
    index.set(componentName(path), load);
  }
  return index;
}

// Fluid literals for booleans, quotes escaped like the code panel does; `{` in a string stays Fluid syntax
function attributeValue(value: unknown): string {
  if (typeof value === 'boolean') {
    return `{${value}}`;
  }
  if (typeof value === 'number') {
    return String(value);
  }
  return String(value).replace(/"/g, '\\"');
}

async function loadStory(index: Map<string, StoryModuleLoader>, name: string, story: string): Promise<ComponentTarget> {
  const componentName = name.slice(name.indexOf(':') + 1);
  const load = index.get(componentName);
  if (!load) {
    throw new Error(`No stories file for "${name}": none of the stories files maps to "${componentName}"`);
  }
  const storiesModule = await load();
  if (!isStoryModule(storiesModule)) {
    throw new Error(`The stories file found for "${name}" has no component in its default export`);
  }
  const meta = storiesModule.default;
  if (meta.component.fullName !== name) {
    throw new Error(`The stories file found for "${name}" belongs to "${meta.component.fullName}"`);
  }
  const exportNames = Object.keys(storiesModule).filter((exportName: string): boolean => exportName !== 'default');
  const exportName = findStory(storiesModule, exportNames, story);
  if (exportName === undefined) {
    throw new Error(`Story "${story}" not found in "${name}", available: ${exportNames.join(', ')}`);
  }
  const storyExport = storiesModule[exportName] as StoryExport;
  return { component: meta.component, args: { ...meta.args, ...storyExport.args } };
}

function isStoryModule(storiesModule: unknown): storiesModule is StoryModule {
  if (typeof storiesModule !== 'object' || storiesModule === null || !('default' in storiesModule)) {
    return false;
  }
  const meta = storiesModule.default;
  return typeof meta === 'object' && meta !== null && 'component' in meta
    && typeof meta.component === 'object' && meta.component !== null && 'fullName' in meta.component
    && typeof meta.component.fullName === 'string';
}

// the export name as written, otherwise case-insensitive or the story's `name`
function findStory(storiesModule: StoryModule, exportNames: string[], story: string): string | undefined {
  const exact = exportNames.find((exportName: string): boolean => exportName === story);
  if (exact !== undefined) {
    return exact;
  }
  return exportNames.find((exportName: string): boolean => {
    const storyExport = storiesModule[exportName] as StoryExport;
    return exportName.toLowerCase() === story.toLowerCase() || storyExport.name === story;
  });
}
