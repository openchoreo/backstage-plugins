import { factEntryFieldsOf } from './types';

describe('factEntryFieldsOf', () => {
  it("reads the entry fields from a fact's metadata", () => {
    expect(
      factEntryFieldsOf({
        type: 'set',
        metadata: {
          entries: {
            name: { type: 'string', description: 'The shard name.' },
            healthy: { type: 'boolean' },
          },
        },
      }),
    ).toEqual({
      name: { type: 'string', description: 'The shard name.' },
      healthy: { type: 'boolean' },
    });
  });

  it('leaves out fields without a string type', () => {
    expect(
      factEntryFieldsOf({
        type: 'set',
        metadata: {
          entries: {
            name: { type: 'string', description: 7 },
            broken: { description: 'no type' },
            odd: 'boolean',
          },
        },
      }),
    ).toEqual({ name: { type: 'string' } });
  });

  it.each([
    ['no metadata', { type: 'set' }],
    [
      'entries that are not an object',
      { type: 'set', metadata: { entries: [] } },
    ],
    ['no usable fields', { type: 'set', metadata: { entries: { a: {} } } }],
  ])('returns undefined for %s', (_label, field) => {
    expect(factEntryFieldsOf(field)).toBeUndefined();
  });
});
