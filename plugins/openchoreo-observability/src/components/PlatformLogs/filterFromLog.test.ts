import {
  addLabelToSelector,
  addListValue,
  selectorHasLabel,
} from './filterFromLog';
import { MAX_LABEL_SELECTOR_LENGTH } from './validation';

describe('addListValue', () => {
  it('appends a value not yet selected', () => {
    expect(addListValue(['a'], 'b')).toEqual(['a', 'b']);
  });

  it('leaves the list alone when the value is already there', () => {
    const values = ['a', 'b'];
    expect(addListValue(values, 'a')).toBe(values);
  });
});

describe('addLabelToSelector', () => {
  it('starts a selector from nothing', () => {
    expect(addLabelToSelector('', 'app', 'web')).toBe('app=web');
  });

  it('ANDs a new key onto the existing terms', () => {
    expect(
      addLabelToSelector('openchoreo.dev/plane=controlplane', 'app', 'web'),
    ).toBe('openchoreo.dev/plane=controlplane,app=web');
  });

  // Two values for one key match nothing, and the observer rejects the selector.
  it('replaces the value of a key already in the selector', () => {
    expect(
      addLabelToSelector(
        'openchoreo.dev/plane=controlplane,app=web',
        'openchoreo.dev/plane',
        'dataplane',
      ),
    ).toBe('openchoreo.dev/plane=dataplane,app=web');
  });

  // The field accepts a key repeated with the same value; replacing only the first
  // would leave two values for it.
  it('collapses a repeated key into the one new term', () => {
    expect(addLabelToSelector('app=web,tier=fe,app=web', 'app', 'db')).toBe(
      'app=db,tier=fe',
    );
  });

  it('normalises spacing and trailing commas', () => {
    expect(addLabelToSelector(' a = 1 , ', 'b', '2')).toBe('a=1,b=2');
  });

  it('declines a selector that would exceed the length cap', () => {
    const long = `k=${'v'.repeat(MAX_LABEL_SELECTOR_LENGTH - 2)}`;
    expect(addLabelToSelector(long, 'app', 'web')).toBeNull();
  });

  // Rebuilding an invalid selector term by term would silently rewrite it.
  it('declines to rewrite a selector that is not valid', () => {
    expect(addLabelToSelector('app!=web', 'tier', 'db')).toBeNull();
  });
});

describe('selectorHasLabel', () => {
  it('matches an exact key and value', () => {
    expect(selectorHasLabel('a=1, b=2', 'b', '2')).toBe(true);
  });

  it('does not match the same key with another value', () => {
    expect(selectorHasLabel('a=1', 'a', '2')).toBe(false);
  });
});
