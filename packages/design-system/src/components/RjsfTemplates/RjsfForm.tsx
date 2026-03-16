import { useState, useRef, useMemo, ComponentProps } from 'react';
import BaseForm from '@rjsf/material-ui';
import defaultValidator from '@rjsf/validator-ajv8';
import type { IChangeEvent } from '@rjsf/core';
import { ArrayFieldTemplate } from './ArrayFieldTemplate';
import { DescriptionFieldTemplate } from './DescriptionFieldTemplate';
import { TitleFieldTemplate } from './TitleFieldTemplate';

type BaseFormProps = ComponentProps<typeof BaseForm>;

/**
 * A wrapper around `@rjsf/material-ui`'s Form that automatically wires up
 * the ArrayFieldTemplate's edit-buffer behaviour:
 *
 * - **liveValidate toggle** — validation is off by default and only turned on
 *   when the user clicks ✓ on an array item or submits the form.
 * - **Item-level validation** — the ✓ button validates the item against its
 *   schema before allowing collapse.
 * - **Revert on cancel** — the ✗ button restores the item to its pre-edit
 *   snapshot; for newly added items it deletes the row instead.
 *
 * All of this is injected via `formContext` so the ArrayFieldTemplate works
 * out of the box without any per-consumer setup.
 *
 * Usage — simply replace `import Form from '@rjsf/material-ui'` with:
 * ```tsx
 * import { RjsfForm } from '@openchoreo/backstage-design-system';
 * <RjsfForm schema={schema} formData={data} onChange={e => setData(e.formData)} />
 * ```
 */
export function RjsfForm(
  props: Omit<BaseFormProps, 'validator'> & {
    validator?: BaseFormProps['validator'];
  },
) {
  const {
    formContext: userFormContext,
    templates: userTemplates,
    validator: userValidator,
    onChange: userOnChange,
    liveValidate: userLiveValidate,
    showErrorList: userShowErrorList,
    noHtml5Validate: userNoHtml5Validate,
    formData,
    children,
    ...rest
  } = props;

  const [internalLiveValidate, setInternalLiveValidate] = useState(false);

  // Consumer's liveValidate is OR'd with internal state so both the
  // ArrayFieldTemplate's ✓-button validation and external triggers work.
  const effectiveLiveValidate =
    (userLiveValidate ?? false) || internalLiveValidate;

  // Refs to avoid stale closures in the memoised formContext
  const formDataRef = useRef(formData);
  formDataRef.current = formData;
  const onChangeRef = useRef(userOnChange);
  onChangeRef.current = userOnChange;

  const resolvedValidator = userValidator ?? defaultValidator;

  // Merged formContext — users can still pass their own keys and they will
  // be preserved alongside the built-in helpers.
  const formContext = useMemo(
    () => ({
      ...userFormContext,

      enableValidation: () => setInternalLiveValidate(true),
      disableValidation: () => setInternalLiveValidate(false),

      /** Synchronous item-level validation used by ArrayFieldTemplate's ✓ button. */
      validateItem: (data: any, itemSchema: any) => {
        const result = resolvedValidator.validateFormData(data, itemSchema);
        return result.errors.length === 0;
      },

      /**
       * Revert a single array item to its snapshot.
       * Called by ArrayFieldTemplate's ✗ button for existing items.
       */
      revertArrayItem: (fieldKey: string, idx: number, snapshot: any) => {
        const current = formDataRef.current;
        if (!current || typeof current !== 'object' || Array.isArray(current))
          return;

        const next = { ...(current as Record<string, unknown>) };
        const arr = [...((next[fieldKey] as any[]) || [])];
        arr[idx] = JSON.parse(JSON.stringify(snapshot));
        next[fieldKey] = arr;

        // Trigger the parent's onChange so it updates its formData state
        onChangeRef.current?.({ formData: next } as IChangeEvent);
      },
    }),
    // userFormContext is intentionally the only external dep — the rest use refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userFormContext, resolvedValidator],
  );

  return (
    <BaseForm
      {...rest}
      formData={formData}
      onChange={userOnChange}
      formContext={formContext}
      validator={resolvedValidator}
      templates={{
        ArrayFieldTemplate,
        DescriptionFieldTemplate,
        TitleFieldTemplate,
        ...userTemplates,
      }}
      liveValidate={effectiveLiveValidate}
      showErrorList={userShowErrorList ?? false}
      noHtml5Validate={userNoHtml5Validate ?? true}
    >
      {children ?? <div />}
    </BaseForm>
  );
}

RjsfForm.displayName = 'RjsfForm';
