import { useCallback, useRef } from 'react';
import { FieldExtensionComponentProps } from '@backstage/plugin-scaffolder-react';
import { useScaffolderPreselection } from '../ScaffolderPreselectionContext';
import {
  NamespaceSelectField,
  type NamespaceOption,
} from './NamespaceSelectField';

/**
 * Scaffolder field extension for selecting a namespace (Domain entity).
 * Stores the value as an entity reference (e.g. "domain:default/engineering").
 *
 * If the URL contains a `namespace` query parameter (captured via
 * ScaffolderPreselectionContext), the matching namespace is pre-selected on
 * load. Otherwise the dropdown starts empty.
 */
export const NamespaceEntityPicker = ({
  onChange,
  formData,
  schema,
  rawErrors,
  required,
}: FieldExtensionComponentProps<string>) => {
  const { preselectedNamespace, clearPreselectedNamespace } =
    useScaffolderPreselection();
  const preselectionAppliedRef = useRef(false);

  const handleNamespacesLoaded = useCallback(
    (namespaces: NamespaceOption[]) => {
      if (preselectionAppliedRef.current || formData) return;

      if (preselectedNamespace) {
        const match = namespaces.find(ns => ns.name === preselectedNamespace);
        if (match) {
          preselectionAppliedRef.current = true;
          clearPreselectedNamespace();
          onChange(match.entityRef);
          return;
        }
      }

      // Fall back to the first namespace if no URL preselection matched
      if (namespaces.length > 0) {
        preselectionAppliedRef.current = true;
        onChange(namespaces[0].entityRef);
      }
    },
    [preselectedNamespace, clearPreselectedNamespace, formData, onChange],
  );

  const hasError = (rawErrors?.length ?? 0) > 0;

  return (
    <NamespaceSelectField
      value={formData ?? ''}
      onChange={onChange}
      label={schema?.title ?? 'Namespace'}
      helperText={
        hasError ? rawErrors?.[0] : 'Select the namespace for this resource'
      }
      required={required}
      error={hasError}
      onNamespacesLoaded={handleNamespacesLoaded}
    />
  );
};
