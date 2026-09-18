import { validateLabelSelector } from './validation';

/**
 * Adds a value to a list filter, leaving it as it is when the value is already there.
 *
 * Appended rather than replacing what is selected: values of one filter are OR'd, the
 * same as ticking another box in the picker, and the chip or picker takes one off.
 */
export function addListValue(values: string[], value: string): string[] {
  return values.includes(value) ? values : [...values, value];
}

/** Whether the selector already requires exactly `key=value`. */
export function selectorHasLabel(
  selector: string,
  key: string,
  value: string,
): boolean {
  return selectorTerms(selector).some(([k, v]) => k === key && v === value);
}

/**
 * Adds `key=value` to a label selector, or null when the result could not be applied.
 *
 * A term for the same key is replaced rather than joined: the selector is an AND, so a
 * second value for one key matches nothing, and the observer rejects it outright. Null
 * covers what the observer would reject anyway - chiefly a selector grown past its
 * length cap - so the caller can decline the click instead of sending it.
 */
export function addLabelToSelector(
  selector: string,
  key: string,
  value: string,
): string | null {
  // A hand-edited URL can carry a selector the field would never have committed;
  // rebuilding it term by term would quietly rewrite it into something else.
  if (validateLabelSelector(selector)) return null;

  // The first term for the key takes the new value in place and any repeats are
  // dropped: the field accepts `app=web,app=web`, and replacing only the first would
  // leave `app=db,app=web`, which matches nothing.
  const all = selectorTerms(selector);
  const first = all.findIndex(([k]) => k === key);
  const terms = all.filter(([k], i) => k !== key || i === first);
  if (first === -1) terms.push([key, value]);
  else terms[first] = [key, value];

  const next = terms.map(([k, v]) => `${k}=${v}`).join(',');
  return validateLabelSelector(next) ? null : next;
}

/** The `key=value` pairs of a valid selector, trimmed, with empty terms dropped. */
function selectorTerms(selector: string): Array<[string, string]> {
  return selector
    .split(',')
    .map(term => term.trim())
    .filter(Boolean)
    .map((term): [string, string] => {
      const equals = term.indexOf('=');
      return [term.slice(0, equals).trim(), term.slice(equals + 1).trim()];
    });
}
