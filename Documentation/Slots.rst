:navigation-title: Slots

..  _slots:

===========================
Slots and nested components
===========================

A `slot <https://docs.typo3.org/permalink/t3viewhelper:typo3fluid-fluid-slot>`_ of a component takes its content
from the args of the story: ``slot____default`` for the default slot, ``slot____<name>`` for a named slot (four
underscores). The content passes TYPO3's HTML sanitizer and is rendered as it is, so the Storybook controls can
hold text or HTML, but not another component.

..  _slots-renderSlotsAsFluid:

Render slot content as Fluid
============================

With the extension setting ``renderSlotsAsFluid`` (:guilabel:`Admin Tools > Settings > Extension Configuration >
storybook`, or in :file:`config/system/settings.php`) the slot content of a story is a Fluid template. It is
parsed and rendered in the rendering context of the story, in the same request as the story itself: other
components via their global namespace, nested slots, ``<f:fragment>`` and inline arrays work as in a template.

..  code-block:: php
    :caption: config/system/settings.php

    $GLOBALS['TYPO3_CONF_VARS']['EXTENSIONS']['storybook']['renderSlotsAsFluid'] = '1';

..  code-block:: ts
    :caption: Components/Page/Page.stories.ts

    export const WithCard: StoryObj = {
      args: {
        slot____default: '<de:card title="Yar Pirate Ipsum" link="https://www.andersundsehr.com" />',
      },
    };

..  warning::
    The slot content skips the HTML sanitizer and runs as Fluid in the TYPO3 instance. Enable the setting only
    where every story author may run arbitrary Fluid there, which is usually the case in a development instance.

..  _slots-component:

Build the slot content from another story
=========================================

``component()`` builds that Fluid from the story of another component, so stories reference each other instead
of repeating markup. Create it once over the stories files of the project:

..  code-block:: ts
    :caption: .storybook/component.ts

    import { createComponent } from '@andersundsehr/storybook-typo3';

    // every stories file of the project, loaded on demand
    export const component = createComponent(import.meta.glob('../Components/**/*.stories.ts'));

..  code-block:: ts
    :caption: Components/Page/Page.stories.ts

    import { type StoryObj, fetchComponent } from '@andersundsehr/storybook-typo3';
    import { component } from '../../.storybook/component';

    export default {
      component: await fetchComponent('de:page'),
    };

    export const WithCard: StoryObj = {
      args: {
        slot____default: await component('de:card', 'Pirate'),
      },
    };

``await component('de:card', 'Pirate')`` gives ``<de:card title="Yar Pirate Ipsum" text="…" link="…" />``: the
meta args of the stories file merged with the args of the story as attributes, booleans as ``{true}`` and
``{false}``, slots as the children of the tag or as ``<f:fragment>``. ``null``, ``undefined`` and ``''`` drop an
attribute, so the defaults of the component apply. Slots built the same way nest to any depth: a story whose own
slots were built with ``component()`` carries that Fluid along.

The second argument is the export name of the story (case-insensitive) or its ``name``. An optional third
argument overrides single args of that story, keyed as in the stories file:

..  code-block:: ts

    await component('de:card', 'Pirate', { link: '#', slot____default: 'Read more' })

The stories file of a component is found by its path: ``componentNameFromPath()`` takes the path below
``Components/`` without the extension as lowercase dot path, and a file named after its directory stands for that
directory (``Components/Card/Card.stories.ts`` or ``Components/Card.stories.ts`` belongs to ``de:card``,
``Components/Atom/Button/Button.stories.js`` to ``de:atom.button``). ``component()`` rejects a name that several
stories files map to. For another layout, pass your own mapping:

..  code-block:: ts

    createComponent(import.meta.glob('../src/**/*.stories.ts'), {
      componentName: (path) => path.replace(/^.*\/stories\//, '').replace(/\.stories\.ts$/, '').toLowerCase(),
    });

Limits:

*   Arguments built by a `transformer <transformers>`_ (``name__part`` keys) have no Fluid form: write such a tag
    by hand, with inline Fluid values.
*   Stories must not reference each other in a cycle; their module imports would wait forever.
