import type {
  CompletionContext,
  CompletionResult,
  CompletionSource,
} from '@codemirror/autocomplete';
import { syntaxTree } from '@codemirror/language';
import type { EditorState } from '@codemirror/state';
import type { SyntaxNode } from '@lezer/common';
import { propertyKey, propertyValue } from './jsonTree';

/** Entity paths most filters use, in the form jsonfc reads them. */
export const COMMON_FILTER_PATHS: ReadonlyArray<{
  path: string;
  info: string;
}> = [
  { path: 'spec.type', info: 'e.g. service, website' },
  { path: 'spec.lifecycle', info: 'e.g. production, experimental' },
  { path: 'spec.owner', info: 'the owning group or user' },
  { path: 'spec.system', info: 'the system the entity belongs to' },
  { path: 'metadata.name', info: "the entity's name" },
  { path: 'metadata.namespace', info: "the entity's namespace" },
  { path: 'metadata.tags', info: 'matches when any tag matches' },
];

/**
 * The filter path for an annotation. jsonfc reads paths with lodash `get`,
 * where a key holding dots or slashes needs brackets; single quotes keep the
 * JSON key free of escapes.
 */
export function annotationPath(key: string): string {
  return `metadata.annotations['${key}']`;
}

/**
 * The catalog's facet key for a filter path: the catalog flattens entities
 * to dotted keys, so `metadata.annotations['a/b']` is `metadata.annotations.a/b`.
 */
export function facetKeyOf(path: string): string {
  return path.replace(/\[(['"])(.*?)\1\]/g, '.$2');
}

/** What the catalog can suggest, for the entity kinds the check targets. */
export interface FilterSuggestions {
  annotationKeys(): Promise<string[]>;
  valuesOf(facetKey: string): Promise<string[]>;
}

/**
 * Objects whose keys are filter paths: the filter itself, or in a raw
 * filter, each object of the top-level array (jsonfc ORs them).
 */
function isFilterObject(node: SyntaxNode | null): boolean {
  if (node?.name !== 'Object') return false;
  const parent = node.parent;
  return (
    parent?.name === 'JsonText' ||
    (parent?.name === 'Array' && parent.parent?.name === 'JsonText')
  );
}

/** The inside of a string node, when the cursor is within its quotes. */
function insideQuotes(node: SyntaxNode, pos: number) {
  return pos > node.from && pos < node.to
    ? { from: node.from + 1, to: node.to - 1 }
    : undefined;
}

/** A filter key the cursor is typing. */
function keyTarget(state: EditorState, pos: number) {
  const node = syntaxTree(state).resolveInner(pos, -1);
  if (node.name !== 'PropertyName') return undefined;
  if (!isFilterObject(node.parent?.parent ?? null)) return undefined;
  return insideQuotes(node, pos);
}

/**
 * A value the cursor is typing for a filter key, either the key's own value
 * or an item of its array value (an array matches any of its items).
 */
function valueTarget(state: EditorState, pos: number) {
  let node: SyntaxNode | null = syntaxTree(state).resolveInner(pos, -1);
  const string = node.name === 'String' ? node : undefined;
  if (string) node = node.parent;
  if (node?.name === 'Array') node = node.parent;
  if (node?.name !== 'Property' || !isFilterObject(node.parent)) {
    return undefined;
  }
  const colon = node.getChild(':');
  const key = propertyKey(state, node);
  if (!colon || pos < colon.to || key === undefined) return undefined;
  if (string) {
    const range = insideQuotes(string, pos);
    return range && { key, ...range, quote: false };
  }
  // Nothing typed yet: only directly after the colon, not inside an array.
  return propertyValue(node)
    ? undefined
    : { key, from: pos, to: pos, quote: true };
}

/**
 * Suggests entity paths for a filter's keys, with the annotation keys the
 * catalog's entities carry, and the catalog's values for a key's value.
 * `getSuggestions` is read on every request, so the source can be created
 * once while the chosen kinds change.
 */
export function filterCompletionSource(
  getSuggestions: () => FilterSuggestions,
): CompletionSource {
  return async (
    context: CompletionContext,
  ): Promise<CompletionResult | null> => {
    const { state, pos } = context;
    const key = keyTarget(state, pos);
    if (key) {
      const annotationKeys = await getSuggestions().annotationKeys();
      return {
        ...key,
        validFor: /^[\w.\-/'[\]]*$/,
        options: [
          ...COMMON_FILTER_PATHS.map(({ path, info }) => ({
            label: path,
            info,
            type: 'property',
          })),
          ...annotationKeys.map(annotation => ({
            label: annotationPath(annotation),
            detail: 'annotation',
            type: 'property',
            boost: -1,
          })),
        ],
      };
    }

    const value = valueTarget(state, pos);
    if (!value) return null;
    const values = await getSuggestions().valuesOf(facetKeyOf(value.key));
    if (values.length === 0) return null;
    return {
      from: value.from,
      to: value.to,
      validFor: /^[^"]*$/,
      options: values.map(v => ({
        label: v,
        type: 'constant',
        apply: value.quote ? JSON.stringify(v) : JSON.stringify(v).slice(1, -1),
      })),
    };
  };
}
