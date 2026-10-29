import { describe, it, type TestContext } from 'node:test';
import { fluidInlineValue } from './fluidInlineValue.ts';

describe('fluidInlineValue', () => {
  it('writes a list with its indexes as keys', (t: TestContext) => {
    t.assert.strictEqual(fluidInlineValue(['a', 'b']), '{0: \'a\', 1: \'b\'}');
  });

  it('writes an object with its keys, quoting keys Fluid does not take bare', (t: TestContext) => {
    t.assert.strictEqual(
      fluidInlineValue({ title: 'Hi', 'data-id': 7, 'a.b': true, 'it\'s': null }),
      '{title: \'Hi\', data-id: 7, \'a.b\': true, \'it\\\'s\': null}',
    );
  });

  it('nests arrays and objects', (t: TestContext) => {
    t.assert.strictEqual(
      fluidInlineValue({ items: [{ label: 'One' }, { label: 'Two' }], empty: [] }),
      '{items: {0: {label: \'One\'}, 1: {label: \'Two\'}}, empty: {}}',
    );
  });

  it('writes booleans and null as Fluid literals and plain numbers bare', (t: TestContext) => {
    t.assert.strictEqual(fluidInlineValue([true, false, null, 3, 1.5]), '{0: true, 1: false, 2: null, 3: 3, 4: 1.5}');
  });

  it('quotes numbers Fluid has no literal for', (t: TestContext) => {
    t.assert.strictEqual(fluidInlineValue([-1, 1e21]), '{0: \'-1\', 1: \'1e+21\'}');
  });

  it('escapes single quotes and backslashes in strings, as Fluid unquotes them', (t: TestContext) => {
    t.assert.strictEqual(fluidInlineValue(['it\'s', 'a\\b', 'say "hi"']), '{0: \'it\\\'s\', 1: \'a\\\\b\', 2: \'say "hi"\'}');
  });

  it('writes a scalar on its own', (t: TestContext) => {
    t.assert.strictEqual(fluidInlineValue('text'), '\'text\'');
    t.assert.strictEqual(fluidInlineValue(2), '2');
  });
});
