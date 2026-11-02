import { json } from '@codemirror/lang-json';
import { EditorState } from '@codemirror/state';
import {
  factValueNodes,
  nodeAtPointer,
  siblingString,
  valueContextAt,
} from './jsonTree';

function stateOf(doc: string) {
  return EditorState.create({ doc, extensions: [json()] });
}

const RULE = `{
  "conditions": {
    "all": [
      { "fact": "isArchived", "operator": "equal", "value": false },
      { "any": [
        { "fact": "stars", "operator": "greaterThan", "value": 3 },
        { "not": { "fact": "isArchived", "operator": "equals", "value": true } }
      ] }
    ]
  }
}`;

describe('nodeAtPointer', () => {
  const state = stateOf(RULE);
  const text = (pointer: string) => {
    const node = nodeAtPointer(state, pointer);
    return node && state.sliceDoc(node.from, node.to);
  };

  it('finds the root for an empty pointer', () => {
    expect(text('')).toBe(RULE);
  });

  it('walks objects and arrays, through any and not', () => {
    expect(text('/conditions/all/1/any/1/not')).toBe(
      '{ "fact": "isArchived", "operator": "equals", "value": true }',
    );
    expect(text('/conditions/all/0/value')).toBe('false');
  });

  it.each(['/conditions/all/5', '/conditions/none', '/conditions/all/x', 'x'])(
    'returns undefined for %s',
    pointer => {
      expect(nodeAtPointer(state, pointer)).toBeUndefined();
    },
  );

  it('decodes escaped segments and takes the last of a repeated key', () => {
    const doc = '{ "a/b": 1, "m~n": 2, "k": 3, "k": 4 }';
    const own = stateOf(doc);
    const at = (pointer: string) => {
      const node = nodeAtPointer(own, pointer)!;
      return own.sliceDoc(node.from, node.to);
    };
    expect(at('/a~1b')).toBe('1');
    expect(at('/m~0n')).toBe('2');
    expect(at('/k')).toBe('4');
  });
});

describe('factValueNodes', () => {
  it('finds every use of a fact', () => {
    const state = stateOf(RULE);
    const nodes = factValueNodes(state, 'isArchived');
    expect(nodes.map(n => state.sliceDoc(n.from, n.to))).toEqual([
      '"isArchived"',
      '"isArchived"',
    ]);
    expect(factValueNodes(state, 'missing')).toEqual([]);
  });
});

describe('valueContextAt', () => {
  it('names the property whose string value holds the cursor', () => {
    const doc = '{ "fact": "isAr", "operator": "equal" }';
    const state = stateOf(doc);
    const context = valueContextAt(state, doc.indexOf('isAr') + 2)!;
    expect(context.key).toBe('fact');
    expect(state.sliceDoc(context.value!.from, context.value!.to)).toBe(
      '"isAr"',
    );
    expect(siblingString(state, context.object, 'operator')).toBe('equal');
  });

  it('names the property when its value is still empty', () => {
    const doc = '{ "fact": "isArchived", "value":  }';
    const context = valueContextAt(stateOf(doc), doc.indexOf(':  ') + 2)!;
    expect(context.key).toBe('value');
    expect(context.value).toBeUndefined();
  });

  it.each([
    ['in a key', '{ "fact": "x" }', 3],
    ['between properties', '{ "fact": "x",  "value": 1 }', 15],
    ['after a value', '{ "fact": "x" }', 14],
  ])('returns undefined %s', (_label, doc, pos) => {
    expect(valueContextAt(stateOf(doc), pos)).toBeUndefined();
  });
});
