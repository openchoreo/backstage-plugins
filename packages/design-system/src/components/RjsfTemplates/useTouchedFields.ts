import { useCallback, useRef, useState } from 'react';
import { RJSFValidationError } from '@rjsf/utils';

/**
 * Converts an RJSF error `property` path (JS accessor notation) to the
 * corresponding field ID that RJSF passes to `onBlur`.
 *
 * Examples:
 *   ".name"              → "root_name"
 *   ".buildArgs.0.name"  → "root_buildArgs_0_name"
 *   ".['my-field']"      → "root_my-field"
 */
function propertyToId(property: string): string {
  if (!property) return 'root';
  let path = property.startsWith('.') ? property.slice(1) : property;
  // Handle bracket notation: ['key'] → key
  path = path.replace(/\['([^']+)'\]/g, '.$1');
  path = path.replace(/\[(\d+)\]/g, '.$1');
  return `root_${path.replace(/\./g, '_')}`;
}

/**
 * Hook that tracks which form fields the user has interacted with (via blur)
 * and provides a `transformErrors` callback that suppresses validation errors
 * for untouched fields.
 *
 * This allows `liveValidate` to remain enabled while avoiding the UX issue of
 * showing required-field errors on newly added (but not yet edited) array items.
 *
 * Usage:
 * ```tsx
 * const { onBlur, transformErrors, markAllTouched } = useTouchedFields();
 * <Form
 *   liveValidate
 *   onBlur={onBlur}
 *   transformErrors={transformErrors}
 *   formContext={{ markAllTouched }}
 *   ...
 * />
 * ```
 *
 * Call `markAllTouched()` before explicit validation (e.g. on submit) so that
 * all errors become visible.  The ArrayFieldTemplate calls
 * `formContext.markAllTouched()` when the user clicks the ✓ button.
 */
export function useTouchedFields() {
  const touchedRef = useRef(new Set<string>());
  const showAllRef = useRef(false);
  const [, setRenderTick] = useState(0);

  const onBlur = useCallback((id: string) => {
    touchedRef.current.add(id);
  }, []);

  const transformErrors = useCallback(
    (errors: RJSFValidationError[]): RJSFValidationError[] => {
      if (showAllRef.current) return errors;
      if (touchedRef.current.size === 0) return [];

      return errors.filter(error => {
        if (!error.property) return true;
        const expectedId = propertyToId(error.property);
        return touchedRef.current.has(expectedId);
      });
    },
    [],
  );

  const markAllTouched = useCallback(() => {
    showAllRef.current = true;
    // Force a re-render so RJSF re-runs transformErrors with all errors visible
    setRenderTick(t => t + 1);
  }, []);

  const reset = useCallback(() => {
    touchedRef.current.clear();
    showAllRef.current = false;
  }, []);

  return { onBlur, transformErrors, markAllTouched, reset };
}
