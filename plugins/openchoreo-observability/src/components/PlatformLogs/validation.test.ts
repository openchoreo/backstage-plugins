import {
  MAX_LABEL_SELECTOR_LENGTH,
  MAX_SEARCH_PHRASE_LENGTH,
  validateLabelSelector,
  validateSearchPhrase,
} from './validation';

describe('validateLabelSelector', () => {
  it.each([
    ['empty means no filter', ''],
    ['a single pair', 'openchoreo.dev/plane=controlplane'],
    ['comma means AND', 'openchoreo.dev/plane=dataplane,tier=infra'],
    ['surrounding whitespace', ' app.kubernetes.io/name = openbao '],
    ['an empty value', 'openchoreo.dev/plane='],
    ['the same pair repeated', 'tier=infra,tier=infra'],
    // A trailing comma is how you type the next pair; flagging it would put the field
    // in an error state through the whole of normal typing.
    ['a trailing comma mid-typing', 'tier=infra,'],
  ])('accepts %s', (_name, selector) => {
    expect(validateLabelSelector(selector)).toBeUndefined();
  });

  it.each([
    ['a term with no equals', 'openchoreo.dev/plane', /not a key=value pair/],
    ['a missing label name', '=controlplane', /no label name/],
    ['an inequality', 'tier!=infra', /Only equality selectors/],
    ['a double equals', 'tier==infra', /Only equality selectors/],
    ['conflicting values', 'tier=infra,tier=apps', /two values/],
    [
      'an over-long selector',
      `k=${'v'.repeat(MAX_LABEL_SELECTOR_LENGTH)}`,
      /Cannot exceed 256 characters/,
    ],
  ])('rejects %s', (_name, selector, expected) => {
    expect(validateLabelSelector(selector)).toMatch(expected as RegExp);
  });

  // The whole point of the change: the states you pass through while typing a valid
  // selector must not be applied, and must say why.
  it('rejects every prefix of a pair until the value begins', () => {
    const target = 'openchoreo.dev/plane=controlplane';
    const rejected: string[] = [];

    for (let i = 1; i < target.length; i++) {
      if (validateLabelSelector(target.slice(0, i))) {
        rejected.push(target.slice(0, i));
      }
    }

    // Everything up to and including "openchoreo.dev/plane" has no "=" yet.
    expect(rejected).toContain('openchoreo.dev/plane');
    expect(rejected).toContain('o');
    // Once the "=" is typed the selector parses, even with an empty value.
    expect(validateLabelSelector('openchoreo.dev/plane=')).toBeUndefined();
    expect(validateLabelSelector(target)).toBeUndefined();
  });

  it('names the offending term so the message is actionable', () => {
    expect(validateLabelSelector('tier=infra,broken')).toContain('"broken"');
  });
});

describe('validateSearchPhrase', () => {
  it('accepts anything within the cap', () => {
    expect(validateSearchPhrase('')).toBeUndefined();
    expect(
      validateSearchPhrase('reconcile failed: "quoted", a=b'),
    ).toBeUndefined();
    expect(
      validateSearchPhrase('x'.repeat(MAX_SEARCH_PHRASE_LENGTH)),
    ).toBeUndefined();
  });

  it('rejects one character over the cap', () => {
    expect(
      validateSearchPhrase('x'.repeat(MAX_SEARCH_PHRASE_LENGTH + 1)),
    ).toMatch(/Cannot exceed 256 characters/);
  });
});
