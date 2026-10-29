/**
 * A string for the inside of a Fluid value in the given quotes: Fluid unquotes `\"` (or `\'`) to the quote and `\\`
 * to a backslash, so both get a backslash in front.
 */
export function escapeFluidString(value: string, quote: '"' | '\''): string {
  return value.replace(/\\/g, '\\\\').split(quote).join(`\\${quote}`);
}
