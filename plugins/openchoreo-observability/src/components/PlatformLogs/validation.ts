/**
 * Client-side mirrors of the platform logs query validation.
 *
 * The observer validates these too and remains the authority — this exists so a filter
 * that cannot succeed is never sent, and the reason is shown on the field instead of
 * arriving as a 400 after the debounce.
 *
 * It matters most for the label selector, because every intermediate state of one is
 * invalid: typing `openchoreo.dev/plane=controlplane` passes through
 * `openchoreo.dev/plane`, and pausing there used to fire a query the observer rejected.
 *
 * Kept deliberately in step with `ParseLabelSelector` and the caps in
 * `internal/observer/api/handlers/validations.go` in the openchoreo repo. Two
 * implementations can drift; the server's is the one that decides.
 */

/** Matches `maxPlatformLogsSelectorLen`. */
export const MAX_LABEL_SELECTOR_LENGTH = 256;

/** Matches `maxPlatformLogsSearchLength`. */
export const MAX_SEARCH_PHRASE_LENGTH = 256;

/**
 * Why a value cannot be applied, or undefined when it can.
 *
 * An empty string is always valid: it means "no filter", which is how the label selector
 * is cleared to search everything.
 */
export type ValidationError = string | undefined;

/**
 * Validates an equality-based Kubernetes label selector — the syntax `kubectl -l`
 * accepts, where a comma means AND.
 */
export function validateLabelSelector(selector: string): ValidationError {
  if (selector === '') return undefined;

  if (selector.length > MAX_LABEL_SELECTOR_LENGTH) {
    return `Cannot exceed ${MAX_LABEL_SELECTOR_LENGTH} characters.`;
  }

  const seen = new Map<string, string>();

  for (const rawTerm of selector.split(',')) {
    const term = rawTerm.trim();
    // A trailing comma is how you type the next pair, so it is not an error yet.
    if (term === '') continue;

    const equals = term.indexOf('=');
    if (equals === -1) {
      return `"${term}" is not a key=value pair.`;
    }

    const key = term.slice(0, equals).trim();
    const value = term.slice(equals + 1).trim();

    if (key === '') {
      return `"${term}" has no label name.`;
    }
    // "!=" and "==" both survive the split above with a stray character on one side.
    if (key.endsWith('!') || value.startsWith('=')) {
      return `Only equality selectors are supported, so "${term}" will not match.`;
    }

    const existing = seen.get(key);
    if (existing !== undefined && existing !== value) {
      return `"${key}" is given two values; no record can match both.`;
    }
    seen.set(key, value);
  }

  return undefined;
}

/** Validates a free-text search phrase. Only its length is constrained. */
export function validateSearchPhrase(phrase: string): ValidationError {
  if (phrase.length > MAX_SEARCH_PHRASE_LENGTH) {
    return `Cannot exceed ${MAX_SEARCH_PHRASE_LENGTH} characters.`;
  }
  return undefined;
}
