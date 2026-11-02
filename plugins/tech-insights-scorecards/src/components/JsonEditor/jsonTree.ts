import { ensureSyntaxTree, syntaxTree } from '@codemirror/language';
import type { EditorState } from '@codemirror/state';
import type { SyntaxNode } from '@lezer/common';

const VALUE_NODES = new Set([
  'Object',
  'Array',
  'String',
  'Number',
  'True',
  'False',
  'Null',
]);

function treeOf(state: EditorState) {
  return ensureSyntaxTree(state, state.doc.length, 1000) ?? syntaxTree(state);
}

function valueChildren(node: SyntaxNode): SyntaxNode[] {
  const values: SyntaxNode[] = [];
  for (let child = node.firstChild; child; child = child.nextSibling) {
    if (VALUE_NODES.has(child.name)) values.push(child);
  }
  return values;
}

/** A string or property name node's value, or undefined if it isn't one. */
export function stringValue(
  state: EditorState,
  node: SyntaxNode,
): string | undefined {
  try {
    const value = JSON.parse(state.sliceDoc(node.from, node.to));
    return typeof value === 'string' ? value : undefined;
  } catch {
    return undefined;
  }
}

export function propertyKey(
  state: EditorState,
  property: SyntaxNode,
): string | undefined {
  const name = property.getChild('PropertyName');
  return name ? stringValue(state, name) : undefined;
}

export function propertyValue(property: SyntaxNode): SyntaxNode | undefined {
  const last = property.lastChild;
  return last && VALUE_NODES.has(last.name) ? last : undefined;
}

/**
 * The node a JSON pointer such as `/conditions/all/0` names, or undefined
 * when the document has no value there. With a repeated key the last one is
 * taken, as `JSON.parse` does.
 */
export function nodeAtPointer(
  state: EditorState,
  pointer: string,
): SyntaxNode | undefined {
  let node: SyntaxNode | undefined = valueChildren(treeOf(state).topNode)[0];
  if (!node || (pointer !== '' && !pointer.startsWith('/'))) return undefined;
  if (pointer === '') return node;
  for (const raw of pointer.slice(1).split('/')) {
    const segment = raw.replace(/~1/g, '/').replace(/~0/g, '~');
    if (node.name === 'Object') {
      const property: SyntaxNode | undefined = node
        .getChildren('Property')
        .filter(p => propertyKey(state, p) === segment)
        .pop();
      node = property && propertyValue(property);
    } else if (node.name === 'Array' && /^\d+$/.test(segment)) {
      node = valueChildren(node)[Number(segment)];
    } else {
      return undefined;
    }
    if (!node) return undefined;
  }
  return node;
}

/** Every string value of a `"fact"` property that names the given fact. */
export function factValueNodes(state: EditorState, fact: string): SyntaxNode[] {
  const found: SyntaxNode[] = [];
  treeOf(state).iterate({
    enter: ref => {
      if (ref.name !== 'Property') return;
      const property = ref.node;
      const value = propertyValue(property);
      if (
        value?.name === 'String' &&
        propertyKey(state, property) === 'fact' &&
        stringValue(state, value) === fact
      ) {
        found.push(value);
      }
    },
  });
  return found;
}

export interface ValueContext {
  /** The key of the property whose value the position is in. */
  key: string;
  /** The value, when one is typed; a string includes its quotes. */
  value?: SyntaxNode;
  /** The object holding the property, for reading its siblings. */
  object: SyntaxNode | null;
}

/** The property whose value `pos` is in, if it is in one. */
export function valueContextAt(
  state: EditorState,
  pos: number,
): ValueContext | undefined {
  let node: SyntaxNode | null = syntaxTree(state).resolveInner(pos, -1);
  while (node && node.name !== 'Property') {
    // Between an object's properties or an array's items, or in a key.
    if (['Object', 'Array', 'PropertyName'].includes(node.name)) {
      return undefined;
    }
    node = node.parent;
  }
  if (!node) return undefined;
  const colon = node.getChild(':');
  const key = propertyKey(state, node);
  if (!colon || pos < colon.to || key === undefined) return undefined;
  const value = propertyValue(node);
  if (value && (pos < value.from || pos > value.to)) return undefined;
  return { key, value, object: node.parent };
}

/** The string value of a sibling property in the same object. */
export function siblingString(
  state: EditorState,
  object: SyntaxNode | null,
  key: string,
): string | undefined {
  const property = object
    ?.getChildren('Property')
    .filter(p => propertyKey(state, p) === key)
    .pop();
  const value = property && propertyValue(property);
  return value?.name === 'String' ? stringValue(state, value) : undefined;
}
