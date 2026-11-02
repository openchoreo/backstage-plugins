/**
 * json-rules-engine's built-in operators. jsonfc passes no others unless a
 * module adds them, and none of ours do.
 */
export const RULE_OPERATORS: ReadonlyArray<{ name: string; info: string }> = [
  { name: 'equal', info: 'fact must equal value' },
  { name: 'notEqual', info: 'fact must not equal value' },
  { name: 'lessThan', info: 'fact must be less than value' },
  { name: 'lessThanInclusive', info: 'fact must be at most value' },
  { name: 'greaterThan', info: 'fact must be greater than value' },
  { name: 'greaterThanInclusive', info: 'fact must be at least value' },
  { name: 'in', info: 'fact must be one of value (an array)' },
  { name: 'notIn', info: 'fact must not be one of value (an array)' },
  { name: 'contains', info: 'fact (an array) must include value' },
  { name: 'doesNotContain', info: 'fact (an array) must not include value' },
];

/**
 * json-rules-engine's built-in operator decorators, written before an
 * operator as `name:operator` and able to stack, e.g. `not:someFact:equal`.
 */
export const RULE_OPERATOR_DECORATORS: ReadonlyArray<{
  name: string;
  info: string;
}> = [
  { name: 'not', info: 'negates the operator' },
  {
    name: 'someFact',
    info: 'fact (an array): at least one item must pass against value',
  },
  {
    name: 'everyFact',
    info: 'fact (an array): every item must pass against value',
  },
  {
    name: 'someValue',
    info: 'value (an array): fact must pass against at least one item',
  },
  {
    name: 'everyValue',
    info: 'value (an array): fact must pass against every item',
  },
  { name: 'swap', info: 'compares value against fact instead' },
];
