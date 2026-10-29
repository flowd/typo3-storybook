import { escapeFluidString } from './escapeFluidString.ts';

// keys Fluid takes bare, like Patterns::$SPLIT_PATTERN_SHORTHANDSYNTAX_ARRAY_PARTS
const BARE_KEY = /^[a-zA-Z0-9_-]+$/;
// the numbers Fluid has a literal for: no sign, no exponent
const BARE_NUMBER = /^[0-9]+(\.[0-9]+)?$/;

/**
 * A story arg as a Fluid inline value: booleans and `null` as the literals Fluid resolves, numbers bare where Fluid
 * has a literal (otherwise quoted), strings in single quotes, arrays and objects as inline arrays (`{0: 'a', 1: 'b'}`,
 * `{key: {nested: true}}`, `{}` for an empty one). Inside an attribute the result still needs the escaping for the
 * attribute's quotes.
 */
export function fluidInlineValue(value: unknown): string {
  if (value === null || value === undefined) {
    return 'null';
  }
  if (typeof value === 'boolean') {
    return String(value);
  }
  if (typeof value === 'number') {
    return BARE_NUMBER.test(String(value)) ? String(value) : `'${value}'`;
  }
  if (typeof value === 'object') {
    const entries: [string, unknown][] = Array.isArray(value)
      ? value.map((element: unknown, index: number): [string, unknown] => [String(index), element])
      : Object.entries(value);
    const parts = entries.map(([key, element]: [string, unknown]): string => `${inlineKey(key)}: ${fluidInlineValue(element)}`);
    return `{${parts.join(', ')}}`;
  }
  return `'${escapeFluidString(String(value), '\'')}'`;
}

function inlineKey(key: string): string {
  return BARE_KEY.test(key) ? key : `'${escapeFluidString(key, '\'')}'`;
}
