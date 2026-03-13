const CAMEL_CASE_RE = /^[a-z][a-zA-Z0-9]*$/;

/**
 * Converts camelCase property keys to Title Case for display.
 * Already-formatted titles (with spaces, etc.) are returned as-is.
 */
export function humanizeTitle(text: string): string {
  if (!text || !CAMEL_CASE_RE.test(text)) return text;
  return text
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([a-zA-Z])(\d)/g, '$1 $2')
    .replace(/\b\w/g, c => c.toUpperCase());
}
