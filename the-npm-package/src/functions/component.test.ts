import { describe, it, type TestContext } from 'node:test';
import { componentNameFromPath, createComponent, toFluid, type StoryModule, type StoryModuleLoader } from './component.ts';
import type { FluidComponent } from '../types/types.ts';

const fluidComponent = (fullName: string): FluidComponent => ({
  fullName,
  name: fullName.slice(fullName.indexOf(':') + 1),
  namespace: fullName.slice(0, fullName.indexOf(':')),
  collection: 'Vendor\\Extension\\ComponentCollection',
  argTypes: {},
});

// stories files as import.meta.glob gives them: a loader per path, resolving to the module
const storyFiles = (modules: Record<string, StoryModule>): Record<string, StoryModuleLoader> => {
  const files: Record<string, StoryModuleLoader> = {};
  for (const [path, module] of Object.entries(modules)) {
    files[path] = (): Promise<StoryModule> => Promise.resolve(module);
  }
  return files;
};

const buttonStories: StoryModule = {
  default: {
    component: fluidComponent('de:button'),
    args: { link: 'https://www.andersundsehr.com', slot____default: 'Get started' },
  },
  Primary: {},
  Secondary: { args: { type: 'secondary' } },
  Small: { args: { size: 'small' } },
  CallToAction: { name: 'Call to action', args: { type: 'secondary', slot____default: 'Go' } },
};

const iconStories: StoryModule = {
  default: { component: fluidComponent('de:icon'), args: { icon: 'arrow', ariaHidden: true } },
  Default: {},
};

describe('componentNameFromPath', () => {
  it('is the lowercase dot path of the file below Components/ without the extension', (t: TestContext) => {
    t.assert.strictEqual(componentNameFromPath('../Components/Card.stories.ts'), 'card');
    t.assert.strictEqual(componentNameFromPath('../Components/Atom/Button.stories.js'), 'atom.button');
  });

  it('stands for the directory when the file is named after it', (t: TestContext) => {
    t.assert.strictEqual(componentNameFromPath('../Components/Card/Card.stories.ts'), 'card');
    t.assert.strictEqual(componentNameFromPath('../Components/Atom/Button/Button.stories.js'), 'atom.button');
    t.assert.strictEqual(
      componentNameFromPath('../Components/Organism/Layout/Page/Default/Default.stories.js'),
      'organism.layout.page.default',
    );
  });

  it('keeps a file not named after its directory apart', (t: TestContext) => {
    t.assert.strictEqual(componentNameFromPath('../Components/Card/Card-empty.stories.ts'), 'card.card-empty');
  });

  it('lowercases StudlyCase like the Fluid name does', (t: TestContext) => {
    t.assert.strictEqual(componentNameFromPath('../Components/Molecule/MegaNav/MegaNav.stories.js'), 'molecule.meganav');
  });

  it('ignores everything before Components/', (t: TestContext) => {
    t.assert.strictEqual(
      componentNameFromPath('/var/www/html/packages/site/Resources/Private/Components/Atom/Icon/Icon.stories.js'),
      'atom.icon',
    );
  });

  it('accepts every stories file extension', (t: TestContext) => {
    t.assert.strictEqual(componentNameFromPath('../Components/Card/Card.stories.mts'), 'card');
    t.assert.strictEqual(componentNameFromPath('../Components/Card/Card.stories.jsx'), 'card');
  });
});

describe('toFluid', () => {
  const button = fluidComponent('de:button');

  it('renders args as attributes in their order and self-closes without slots', (t: TestContext) => {
    t.assert.strictEqual(
      toFluid({ component: button, args: { link: '#', type: 'secondary' } }),
      '<de:button link="#" type="secondary" />',
    );
  });

  it('renders a component without args', (t: TestContext) => {
    t.assert.strictEqual(toFluid({ component: button, args: {} }), '<de:button />');
  });

  it('writes booleans as Fluid literals and numbers as they are', (t: TestContext) => {
    t.assert.strictEqual(
      toFluid({ component: button, args: { ariaHidden: true, visible: false, width: 32, ratio: 1.5 } }),
      '<de:button ariaHidden="{true}" visible="{false}" width="32" ratio="1.5" />',
    );
  });

  it('drops null, undefined and empty values so the component defaults apply', (t: TestContext) => {
    t.assert.strictEqual(
      toFluid({ component: button, args: { link: '#', type: '', size: null, title: undefined } }),
      '<de:button link="#" />',
    );
  });

  it('escapes double quotes in attribute values', (t: TestContext) => {
    t.assert.strictEqual(toFluid({ component: button, args: { title: 'Say "hi"' } }), '<de:button title="Say \\"hi\\"" />');
  });

  it('puts the default slot between the tags', (t: TestContext) => {
    t.assert.strictEqual(
      toFluid({ component: button, args: { link: '#', slot____default: 'Get started' } }),
      '<de:button link="#">Get started</de:button>',
    );
  });

  it('renders named slots as fragments after the default content', (t: TestContext) => {
    const card = fluidComponent('de:card');

    t.assert.strictEqual(
      toFluid({
        component: card,
        args: { slot____footer: '<a href="#">More</a>', slot____default: '<p>Text</p>', slot____header: 'Title' },
      }),
      '<de:card><p>Text</p><f:fragment name="footer"><a href="#">More</a></f:fragment>'
      + '<f:fragment name="header">Title</f:fragment></de:card>',
    );
  });

  it('renders a named slot without default content', (t: TestContext) => {
    t.assert.strictEqual(
      toFluid({ component: button, args: { slot____icon: 'x' } }),
      '<de:button><f:fragment name="icon">x</f:fragment></de:button>',
    );
  });

  it('skips an empty slot', (t: TestContext) => {
    t.assert.strictEqual(toFluid({ component: button, args: { slot____default: '' } }), '<de:button />');
  });

  it('rejects arguments that a transformer builds', (t: TestContext) => {
    const page = fluidComponent('de:page');

    t.assert.throws(
      () => toFluid({ component: page, args: { navigation__count: 3, footer__columns: 2 } }),
      { message: 'de:page: navigation, footer come from a transformer and have no Fluid form, write the tag by hand' },
    );
  });
});

describe('component', () => {
  const component = createComponent(storyFiles({ '../Components/Button/Button.stories.ts': buttonStories }));

  it('builds the tag from the meta args', async (t: TestContext) => {
    t.assert.strictEqual(
      await component('de:button', 'Primary'),
      '<de:button link="https://www.andersundsehr.com">Get started</de:button>',
    );
  });

  it('merges the story args over the meta args', async (t: TestContext) => {
    t.assert.strictEqual(
      await component('de:button', 'Secondary'),
      '<de:button link="https://www.andersundsehr.com" type="secondary">Get started</de:button>',
    );
  });

  it('finds a story by its export name regardless of case', async (t: TestContext) => {
    t.assert.strictEqual(await component('de:button', 'small'), await component('de:button', 'Small'));
  });

  it('finds a story by its name', async (t: TestContext) => {
    t.assert.strictEqual(
      await component('de:button', 'Call to action'),
      '<de:button link="https://www.andersundsehr.com" type="secondary">Go</de:button>',
    );
  });

  it('lists the available stories when the story is unknown', async (t: TestContext) => {
    await t.assert.rejects(component('de:button', 'Huge'), {
      message: 'Story "Huge" not found in "de:button", available: Primary, Secondary, Small, CallToAction',
    });
  });

  it('rejects a component without a stories file', async (t: TestContext) => {
    await t.assert.rejects(component('de:icon', 'Default'), {
      message: 'No stories file for "de:icon": none of the stories files maps to "icon"',
    });
  });

  it('rejects a stories file that belongs to another component', async (t: TestContext) => {
    const mismatched = createComponent(storyFiles({ '../Components/Icon/Icon.stories.ts': buttonStories }));

    await t.assert.rejects(mismatched('de:icon', 'Primary'), {
      message: 'The stories file found for "de:icon" belongs to "de:button"',
    });
  });

  it('rejects a stories file without a component', async (t: TestContext) => {
    const noComponent = createComponent({ '../Components/Icon/Icon.stories.ts': (): Promise<unknown> => Promise.resolve({ default: {} }) });

    await t.assert.rejects(noComponent('de:icon', 'Default'), {
      message: 'The stories file found for "de:icon" has no component in its default export',
    });
  });

  it('maps stories files to components with the given function', async (t: TestContext) => {
    const byFileName = createComponent(storyFiles({ 'stories/the-button.ts': buttonStories }), {
      componentName: (path: string): string => path.replace(/^stories\/the-/, '').replace(/\.ts$/, ''),
    });

    t.assert.strictEqual(await byFileName('de:button', 'Primary'), await component('de:button', 'Primary'));
  });

  it('loads only the requested stories file', async (t: TestContext) => {
    let iconLoads = 0;
    const lazy = createComponent({
      '../Components/Button/Button.stories.ts': (): Promise<StoryModule> => Promise.resolve(buttonStories),
      '../Components/Icon/Icon.stories.ts': (): Promise<StoryModule> => {
        iconLoads++;
        return Promise.resolve(iconStories);
      },
    });

    await lazy('de:button', 'Primary');

    t.assert.strictEqual(iconLoads, 0);
  });

  describe('overrides', () => {
    it('replace single args of the story', async (t: TestContext) => {
      t.assert.strictEqual(
        await component('de:button', 'Secondary', { slot____default: 'Read more', size: 'small' }),
        '<de:button link="https://www.andersundsehr.com" type="secondary" size="small">Read more</de:button>',
      );
    });

    it('drop an attribute with null or an empty string', async (t: TestContext) => {
      t.assert.strictEqual(
        await component('de:button', 'Secondary', { type: null }),
        await component('de:button', 'Primary'),
      );
      t.assert.strictEqual(
        await component('de:button', 'Secondary', { type: '' }),
        await component('de:button', 'Primary'),
      );
    });

    it('leave the story args alone for the next call', async (t: TestContext) => {
      await component('de:button', 'Primary', { slot____default: 'Once' });

      t.assert.match(await component('de:button', 'Primary'), />Get started</);
    });
  });

  it('nests: a story whose slot was built with component() carries that Fluid along', async (t: TestContext) => {
    const pageStories: StoryModule = {
      default: {
        component: fluidComponent('de:page'),
        args: { slot____default: await component('de:button', 'Primary') },
      },
      Default: {},
    };
    const nested = createComponent(storyFiles({ '../Components/Page/Page.stories.ts': pageStories }));

    t.assert.strictEqual(
      await nested('de:page', 'Default'),
      '<de:page><de:button link="https://www.andersundsehr.com">Get started</de:button></de:page>',
    );
  });

  it('nests any depth: a slot inside a slot inside a slot, through overrides and named slots too', async (t: TestContext) => {
    const icon = await createComponent(storyFiles({ '../Components/Icon/Icon.stories.ts': iconStories }))('de:icon', 'Default');
    const button = await component('de:button', 'Primary', { slot____default: `Get started ${icon}` });
    const cardStories: StoryModule = {
      default: { component: fluidComponent('de:card'), args: { slot____default: '<p>Text</p>', slot____footer: button } },
      Default: {},
    };
    const card = await createComponent(storyFiles({ '../Components/Card/Card.stories.ts': cardStories }))('de:card', 'Default');
    const pageStories: StoryModule = {
      default: { component: fluidComponent('de:page'), args: { slot____default: card } },
      Default: {},
    };
    const page = createComponent(storyFiles({ '../Components/Page/Page.stories.ts': pageStories }));

    t.assert.strictEqual(
      await page('de:page', 'Default'),
      '<de:page><de:card><p>Text</p><f:fragment name="footer">'
      + '<de:button link="https://www.andersundsehr.com">Get started '
      + '<de:icon icon="arrow" ariaHidden="{true}" /></de:button>'
      + '</f:fragment></de:card></de:page>',
    );
  });
});
