import { useState } from 'react';
import { act, waitFor } from '@testing-library/react';
import {
  mockDynamicChecksApi,
  renderWithApis,
} from '../../__testUtils__/testApis';
import type { FactSchema } from '../../api/types';
import { RuleEditor, type RuleEditorProps } from './RuleEditor';

const RULE = JSON.stringify({
  conditions: {
    all: [
      {
        fact: 'shards',
        path: '$[*].nope',
        operator: 'everyFact:equal',
        value: true,
      },
    ],
  },
});

const schema = (shards: Record<string, unknown>): FactSchema =>
  ({
    id: 'shardFacts',
    version: '1.0.0',
    shards: { type: 'set', description: '', ...shards },
  } as FactSchema);

type Changes = Partial<
  Pick<RuleEditorProps, 'factIds' | 'factSchemas' | 'canValidate'>
>;

async function renderEditor(initial: Changes = {}) {
  let change: (changes: Changes) => void = () => {};
  function Harness() {
    const [props, setProps] = useState<Changes>({
      factIds: ['shardFacts'],
      factSchemas: [schema({})],
      canValidate: true,
      ...initial,
    });
    change = changes => setProps(prev => ({ ...prev, ...changes }));
    return (
      <RuleEditor
        label="Rule"
        value={RULE}
        onChange={() => {}}
        factIds={props.factIds!}
        factSchemas={props.factSchemas!}
        canValidate={props.canValidate!}
      />
    );
  }
  const api = mockDynamicChecksApi();
  const rendered = await renderWithApis(<Harness />, { api });
  return {
    ...rendered,
    change: (changes: Changes) => act(() => change(changes)),
  };
}

const warnings = (container: HTMLElement) =>
  container.querySelectorAll('.cm-lintRange-warning').length;

describe('RuleEditor', () => {
  it('validates on the backend only when the rule or its retrievers change', async () => {
    const { api, container, change } = await renderEditor();
    await waitFor(() => expect(api.validateRule).toHaveBeenCalledTimes(1), {
      timeout: 3000,
    });
    expect(warnings(container)).toBe(0);

    change({
      factSchemas: [
        schema({ metadata: { entries: { name: { type: 'string' } } } }),
      ],
    });
    // The fact linter's warning shows the linters ran again.
    await waitFor(() => expect(warnings(container)).toBeGreaterThan(0), {
      timeout: 3000,
    });
    expect(api.validateRule).toHaveBeenCalledTimes(1);

    change({ factIds: ['shardFacts', 'otherFacts'] });
    await waitFor(() => expect(api.validateRule).toHaveBeenCalledTimes(2), {
      timeout: 3000,
    });
    expect(api.validateRule).toHaveBeenLastCalledWith(
      ['shardFacts', 'otherFacts'],
      JSON.parse(RULE),
    );
  });

  it('validates on the backend once the validate permission arrives', async () => {
    const { api, container, change } = await renderEditor({
      canValidate: false,
    });
    change({
      factSchemas: [
        schema({ metadata: { entries: { name: { type: 'string' } } } }),
      ],
    });
    await waitFor(() => expect(warnings(container)).toBeGreaterThan(0), {
      timeout: 3000,
    });
    expect(api.validateRule).not.toHaveBeenCalled();

    change({ canValidate: true });
    await waitFor(() => expect(api.validateRule).toHaveBeenCalledTimes(1), {
      timeout: 3000,
    });
  });
});
