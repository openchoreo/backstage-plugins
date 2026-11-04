import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { jsonLanguage, jsonParseLinter } from '@codemirror/lang-json';
import { lintGutter, linter } from '@codemirror/lint';
import { StateEffect } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import { useApi } from '@backstage/core-plugin-api';
import useLatest from 'react-use/lib/useLatest';
import { dynamicChecksApiRef } from '../../api/DynamicChecksApi';
import { factFieldsOf, type FactSchema } from '../../api/types';
import { JsonEditor } from './JsonEditor';
import { ruleCompletionSource, type FactOption } from './ruleCompletions';
import { serverRuleLinter } from './ruleLint';

const LINT_DELAY_MS = 500;

/**
 * Asks the server linter to run again. A change of retrievers changes which
 * facts are known, not the text, so CodeMirror wouldn't lint on its own, and
 * `forceLinting` only hurries a lint that's already pending.
 */
const relint = StateEffect.define<null>();

export interface RuleEditorProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  factIds: string[];
  factSchemas: FactSchema[];
  /**
   * Whether the backend may be asked to validate the rule. Validation needs
   * the manage permission, so without it only JSON syntax is checked.
   */
  canValidate: boolean;
  error?: boolean;
  helperText?: ReactNode;
}

/**
 * The check's json-rules-engine rule: JSON syntax errors, the backend
 * validator's problems marked on the condition at fault, and suggestions for
 * the chosen retrievers' facts and the engine's operators.
 */
export function RuleEditor(props: RuleEditorProps) {
  const { factIds, factSchemas, canValidate, ...editorProps } = props;
  const api = useApi(dynamicChecksApiRef);

  const facts = useMemo<FactOption[]>(
    () =>
      factIds.flatMap(id => {
        const schema = factSchemas.find(s => s.id === id);
        return schema
          ? factFieldsOf(schema).map(({ name, field }) => ({
              name,
              type: field.type,
              description: field.description,
              retriever: id,
            }))
          : [];
      }),
    [factIds, factSchemas],
  );

  // The sources read these through refs, so the extensions are built once.
  const factsRef = useLatest(facts);
  const validateRef = useLatest(
    canValidate
      ? (rule: unknown) => api.validateRule(factIds, rule)
      : async () => undefined,
  );
  const extensions = useMemo(
    () => [
      lintGutter(),
      linter(jsonParseLinter(), { delay: LINT_DELAY_MS }),
      linter(
        serverRuleLinter(rule => validateRef.current(rule)),
        {
          delay: LINT_DELAY_MS,
          needsRefresh: update =>
            update.transactions.some(tr =>
              tr.effects.some(effect => effect.is(relint)),
            ),
        },
      ),
      jsonLanguage.data.of({
        autocomplete: ruleCompletionSource(() => factsRef.current),
      }),
    ],
    [factsRef, validateRef],
  );

  const viewRef = useRef<EditorView>();
  const retrieverKey = factIds.join('\n');
  useEffect(() => {
    viewRef.current?.dispatch({ effects: relint.of(null) });
  }, [retrieverKey, canValidate]);

  return (
    <JsonEditor
      {...editorProps}
      extensions={extensions}
      onCreateEditor={view => {
        viewRef.current = view;
      }}
    />
  );
}
