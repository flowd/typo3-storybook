import { describe, it, type TestContext } from 'node:test';
import { escapeFluidString } from './escapeFluidString.ts';

describe('escapeFluidString', () => {
  it('escapes the given quote', (t: TestContext) => {
    t.assert.strictEqual(escapeFluidString('Say "hi"', '"'), 'Say \\"hi\\"');
    t.assert.strictEqual(escapeFluidString('Say \'hi\'', '\''), 'Say \\\'hi\\\'');
  });

  it('leaves the other quote alone', (t: TestContext) => {
    t.assert.strictEqual(escapeFluidString('Say \'hi\'', '"'), 'Say \'hi\'');
  });

  it('escapes backslashes, before a quote too, as Fluid unquotes them', (t: TestContext) => {
    t.assert.strictEqual(escapeFluidString('C:\\dir\\', '"'), 'C:\\\\dir\\\\');
    t.assert.strictEqual(escapeFluidString('a\\"b', '"'), 'a\\\\\\"b');
  });
});
