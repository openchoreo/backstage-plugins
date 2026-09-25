import { useEffect, useState } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import {
  CHOREO_ANNOTATIONS,
  type HookParameter,
  type HookSubjectRef,
  type HookSubjectSelectorKind,
} from '@openchoreo/backstage-plugin-common';
import type { HookOption, SubjectTypeOption } from './hookBindingValidation';

/** Catalog kinds a hook binding's appliesTo may name, and whether they are namespaced. */
const SUBJECT_TYPE_KINDS: Array<{
  kind: HookSubjectSelectorKind;
  namespaced: boolean;
}> = [
  { kind: 'ComponentType', namespaced: true },
  { kind: 'ClusterComponentType', namespaced: false },
];

export function hookEntityToOption(e: {
  kind: string;
  metadata: {
    name: string;
    title?: string;
    annotations?: Record<string, string>;
  };
  spec?: unknown;
}): HookOption {
  const spec = (e.spec ?? {}) as {
    parameters?: HookParameter[];
    enabledTo?: HookSubjectRef[];
  };
  return {
    kind: e.kind === 'ClusterHook' ? 'ClusterHook' : 'Hook',
    name: e.metadata.name,
    namespace: e.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE],
    displayName: e.metadata.title,
    parameters: Array.isArray(spec.parameters) ? spec.parameters : [],
    enabledTo: Array.isArray(spec.enabledTo) ? spec.enabledTo : [],
  };
}

/**
 * Loads what the hook-binding editor offers for one namespace: the Hooks in it
 * plus every ClusterHook, and the component types an appliesTo selector may
 * name. Returns empty lists while disabled or without a namespace.
 */
export function useHookEditorOptions(
  namespaceName: string,
  enabled: boolean,
): { hooks: HookOption[]; subjectTypes: SubjectTypeOption[] } {
  const catalogApi = useApi(catalogApiRef);
  const [hooks, setHooks] = useState<HookOption[]>([]);
  const [subjectTypes, setSubjectTypes] = useState<SubjectTypeOption[]>([]);

  useEffect(() => {
    if (!enabled || !namespaceName) {
      setHooks([]);
      setSubjectTypes([]);
      return;
    }
    const inNamespace = (e: {
      metadata: { annotations?: Record<string, string> };
    }) =>
      e.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE] ===
        namespaceName &&
      !e.metadata.annotations?.[CHOREO_ANNOTATIONS.DELETION_TIMESTAMP];

    const fetchHooks = async () => {
      try {
        const [{ items: nsHooks }, { items: clusterHooks }] = await Promise.all(
          [
            catalogApi.getEntities({ filter: { kind: 'Hook' } }),
            catalogApi.getEntities({ filter: { kind: 'ClusterHook' } }),
          ],
        );
        setHooks([
          ...nsHooks.filter(inNamespace).map(hookEntityToOption),
          ...clusterHooks.map(hookEntityToOption),
        ]);
      } catch {
        setHooks([]);
      }
    };
    const fetchTypes = async () => {
      try {
        const results = await Promise.all(
          SUBJECT_TYPE_KINDS.map(async ({ kind, namespaced }) => {
            const { items } = await catalogApi.getEntities({
              filter: { kind },
            });
            return items
              .filter(e => !namespaced || inNamespace(e))
              .map(e => ({ kind, name: e.metadata.name }));
          }),
        );
        setSubjectTypes(results.flat());
      } catch {
        setSubjectTypes([]);
      }
    };
    fetchHooks();
    fetchTypes();
  }, [enabled, namespaceName, catalogApi]);

  return { hooks, subjectTypes };
}
