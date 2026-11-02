import {
  CompletionContext,
  type CompletionResult,
} from '@codemirror/autocomplete';
import { json } from '@codemirror/lang-json';
import { EditorState } from '@codemirror/state';
import {
  annotationPath,
  facetKeyOf,
  filterCompletionSource,
  type FilterSuggestions,
} from './filterCompletions';

const suggestions: FilterSuggestions = {
  annotationKeys: async () => ['backstage.io/techdocs-ref'],
  valuesOf: jest.fn(async (facetKey: string) =>
    facetKey === 'spec.lifecycle' ? ['experimental', 'production'] : [],
  ),
};
const source = filterCompletionSource(() => suggestions);

/** Completes at the `|` in `doc`. */
async function complete(docWithCursor: string) {
  const pos = docWithCursor.indexOf('|');
  const doc = docWithCursor.replace('|', '');
  const state = EditorState.create({ doc, extensions: [json()] });
  const result = (await source(
    new CompletionContext(state, pos, true),
  )) as CompletionResult | null;
  return { result, doc, labels: result?.options.map(o => o.label) };
}

describe('filter paths', () => {
  it('writes annotation paths with single-quoted brackets', () => {
    expect(annotationPath('backstage.io/techdocs-ref')).toBe(
      "metadata.annotations['backstage.io/techdocs-ref']",
    );
  });

  it.each([
    ['spec.type', 'spec.type'],
    [
      "metadata.annotations['backstage.io/techdocs-ref']",
      'metadata.annotations.backstage.io/techdocs-ref',
    ],
    ['metadata.annotations["a/b"]', 'metadata.annotations.a/b'],
  ])('maps %s to the facet key %s', (path, key) => {
    expect(facetKeyOf(path)).toBe(key);
  });
});

describe('filterCompletionSource', () => {
  it('suggests paths and annotation keys for a key', async () => {
    const { result, doc, labels } = await complete('{ "spec.l|" }');
    expect(labels).toEqual(
      expect.arrayContaining([
        'spec.lifecycle',
        "metadata.annotations['backstage.io/techdocs-ref']",
      ]),
    );
    expect(doc.slice(result!.from, result!.to)).toBe('spec.l');
  });

  it("suggests the catalog's values for a key's value", async () => {
    const { result, doc, labels } = await complete(
      '{ "spec.lifecycle": "pro|" }',
    );
    expect(labels).toEqual(['experimental', 'production']);
    expect(doc.slice(result!.from, result!.to)).toBe('pro');
    expect(suggestions.valuesOf).toHaveBeenCalledWith('spec.lifecycle');
  });

  it('adds quotes when the value is not typed yet', async () => {
    const { result } = await complete('{ "spec.lifecycle": | }');
    expect(result!.options[0].apply).toBe('"experimental"');
  });

  it('suggests values for an item of an array value', async () => {
    const { labels } = await complete(
      '{ "spec.lifecycle": ["production", "|"] }',
    );
    expect(labels).toEqual(['experimental', 'production']);
  });

  it('suggests keys in each object of a raw filter array', async () => {
    const { labels } = await complete('[{ "kind": "Component" }, { "|" }]');
    expect(labels).toContain('spec.type');
  });

  it.each([
    ['for a nested object', '{ "spec.type": { "|": 1 } }'],
    ['for a path the catalog has no values for', '{ "spec.owner": "|" }'],
  ])('suggests nothing %s', async (_label, doc) => {
    expect((await complete(doc)).result).toBeNull();
  });
});
