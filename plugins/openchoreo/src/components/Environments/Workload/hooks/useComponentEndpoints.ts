import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Entity } from '@backstage/catalog-model';
import { useApi } from '@backstage/core-plugin-api';
import {
  endpointTypeKey,
  parseEndpointTypeKey,
  toStoredReleaseLine,
  type AllowedEndpointTypeEntry,
  type ComponentEndpointInput,
  type ComponentEndpointSummary,
  type EndpointExposureChoice,
  type EndpointExposures,
  type ExposableEndpoint,
} from '@openchoreo/backstage-plugin-common';
import { openChoreoClientApiRef } from '../../../../api/OpenChoreoClientApi';
import { getErrorMessage } from '../../../../utils/errorUtils';
import {
  currentEndpointName,
  initialEndpointMode,
  planEndpointChanges,
  primaryOriginals,
  type EndpointFormMode,
} from '../componentEndpointDrafts';

export interface ComponentEndpointsState {
  loading: boolean;
  loadError: string | null;
  allowedEndpoints: AllowedEndpointTypeEntry[];
  /** The component's Endpoints as on the server. */
  originals: ComponentEndpointSummary[];
  /**
   * How many of the rows were prefilled from the main line's Endpoints: on a
   * release line without Endpoints of its own, its rows start from the
   * generator's drafts, which are created for the line on save. 0 otherwise.
   */
  draftedFromMain: number;
  /** The Endpoint type chosen per workload endpoint, by current name. */
  choices: EndpointExposures;
  renames: Record<string, string>;
  /** The form the Endpoints tab shows, applied on save. */
  mode: EndpointFormMode;
  /** The form the page opened with (or last saved). */
  initialMode: EndpointFormMode;
  /**
   * Switches forms. Nothing is applied until save, and switching back
   * restores the loaded state, since the rows are the same in both forms.
   */
  setMode: (mode: EndpointFormMode) => void;
  /**
   * Whether the ComponentType allows any Endpoint type. Without one the
   * Endpoints form keeps every endpoint project-scoped, and legacy
   * endpoints cannot be migrated.
   */
  canUseEndpoints: boolean;
  setChoice: (workloadEndpoint: string, choice: EndpointExposureChoice) => void;
  /** Puts back a row's earlier choice, or none, when its edit is cancelled. */
  restoreChoice: (
    workloadEndpoint: string,
    choice: EndpointExposureChoice | undefined,
  ) => void;
  /** Keeps a renamed workload endpoint's Endpoint and choice. */
  renameWorkloadEndpoint: (from: string, to: string) => void;
  /**
   * The workload endpoints as the page edits them: each one exposed through
   * an Endpoint shows that Endpoint's visibility, which the workload itself
   * no longer carries. Also picks the form the page opens with.
   */
  prepare: <T extends ExposableEndpoint>(
    endpoints: Record<string, T>,
  ) => Record<string, T>;
  /**
   * Saves the planned Endpoint calls. Each saved call becomes the new
   * baseline, so after a failure only what is left stays pending; the error
   * names the Endpoint that failed.
   */
  apply: (
    endpoints: Record<string, ExposableEndpoint>,
    autoDeploy: boolean,
  ) => Promise<void>;
}

const EMPTY: AllowedEndpointTypeEntry[] = [];

/**
 * Loads a component's own Endpoints and stages changes to them: those of its
 * main line, or of the release line given in options, so a line's configure
 * page manages only the line's Endpoints.
 */
export function useComponentEndpoints(
  entity: Entity,
  options: { skip?: boolean; releaseLine?: string } = {},
): ComponentEndpointsState {
  const client = useApi(openChoreoClientApiRef);
  const releaseLine = options.releaseLine;
  const [loading, setLoading] = useState(!options.skip);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [allowedEndpoints, setAllowedEndpoints] =
    useState<AllowedEndpointTypeEntry[]>(EMPTY);
  const [originals, setOriginals] = useState<ComponentEndpointSummary[]>([]);
  const [drafts, setDrafts] = useState<ComponentEndpointInput[]>([]);
  const [choices, setChoices] = useState<EndpointExposures>({});
  const [renames, setRenames] = useState<Record<string, string>>({});
  const [mode, setMode] = useState<EndpointFormMode>('legacy');
  const [initialMode, setInitialMode] = useState<EndpointFormMode>('legacy');

  useEffect(() => {
    if (options.skip) {
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    const line = toStoredReleaseLine(releaseLine);
    const load = async () => {
      const result = await client.fetchComponentEndpoints(entity, releaseLine);
      // A release line without Endpoints of its own starts from the main
      // line's, as drafts the user reviews and saves. Without drafts the page
      // works as before, so a failure to fetch them is not an error.
      const lineDrafts =
        line && result.endpoints.length === 0
          ? await client
              .fetchReleaseLineEndpointDrafts(entity, line)
              .catch(() => [])
          : [];
      return { result, lineDrafts };
    };
    load()
      .then(({ result, lineDrafts }) => {
        if (cancelled) return;
        setAllowedEndpoints(result.allowedEndpoints ?? EMPTY);
        setOriginals(result.endpoints);
        setDrafts(lineDrafts);
        const initial: EndpointExposures = {};
        for (const [name, original] of primaryOriginals(result.endpoints, {})) {
          initial[name] = {
            type: endpointTypeKey({
              kind: original.typeKind,
              name: original.typeName,
            }),
            parameters: original.parameters,
          };
        }
        for (const draft of lineDrafts) {
          if (initial[draft.workloadEndpoint]) continue;
          initial[draft.workloadEndpoint] = {
            type: endpointTypeKey({
              kind: draft.typeKind,
              name: draft.typeName,
            }),
            parameters: draft.parameters ?? {},
          };
        }
        setChoices(initial);
        setLoadError(null);
      })
      .catch(e => {
        if (!cancelled) setLoadError(getErrorMessage(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [client, entity, releaseLine, options.skip]);

  const setChoice = useCallback(
    (workloadEndpoint: string, choice: EndpointExposureChoice) => {
      setChoices(prev => ({ ...prev, [workloadEndpoint]: choice }));
    },
    [],
  );

  const restoreChoice = useCallback(
    (workloadEndpoint: string, choice: EndpointExposureChoice | undefined) => {
      setChoices(prev => {
        const { [workloadEndpoint]: _current, ...rest } = prev;
        return choice ? { ...rest, [workloadEndpoint]: choice } : rest;
      });
    },
    [],
  );

  const renameWorkloadEndpoint = useCallback(
    (from: string, to: string) => {
      if (from === to) return;
      setRenames(prev => {
        const next = { ...prev };
        for (const original of originals) {
          if (currentEndpointName(original, prev) === from) {
            next[original.workloadEndpoint] = to;
          }
        }
        return next;
      });
      setChoices(prev => {
        if (!(from in prev)) return prev;
        const { [from]: moved, ...rest } = prev;
        return { ...rest, [to]: moved };
      });
    },
    [originals],
  );

  const prepare = useCallback(
    <T extends ExposableEndpoint>(endpoints: Record<string, T>) => {
      const primary = primaryOriginals(originals, {});
      // A line's drafts open the Endpoints form, like Endpoints it had.
      const drafted = new Map<string, ComponentEndpointInput>();
      if (originals.length === 0) {
        for (const draft of drafts) {
          if (!drafted.has(draft.workloadEndpoint)) {
            drafted.set(draft.workloadEndpoint, draft);
          }
        }
      }
      const opening =
        drafted.size > 0
          ? 'endpoints'
          : initialEndpointMode(endpoints, originals);
      setMode(opening);
      setInitialMode(opening);
      const result: Record<string, T> = {};
      for (const [name, endpoint] of Object.entries(endpoints)) {
        const visibilitySource =
          primary.get(name)?.visibility ?? drafted.get(name)?.visibility;
        if (!visibilitySource) {
          result[name] = endpoint;
          continue;
        }
        const visibility = [
          ...new Set([...(endpoint.visibility ?? []), ...visibilitySource]),
        ];
        result[name] = { ...endpoint, visibility };
      }
      return result;
    },
    [originals, drafts],
  );

  const apply = useCallback(
    async (
      endpoints: Record<string, ExposableEndpoint>,
      autoDeploy: boolean,
    ) => {
      const changes = planEndpointChanges({
        mode,
        endpoints,
        allowedEndpoints,
        choices,
        originals,
        renames,
      });
      for (const change of changes) {
        const label =
          change.op === 'create'
            ? `for ${change.workloadEndpoint}`
            : change.original.name;
        try {
          if (change.op === 'delete') {
            await client.deleteComponentEndpoint(
              entity,
              change.original.name,
              releaseLine,
            );
            setOriginals(prev => prev.filter(o => o !== change.original));
          } else if (change.op === 'update') {
            const saved = await client.updateComponentEndpoint(
              entity,
              change.original.name,
              {
                visibility: change.visibility,
                parameters: change.parameters,
                workloadEndpoint: change.workloadEndpoint,
              },
              releaseLine,
            );
            setOriginals(prev =>
              prev.map(o => (o === change.original ? saved : o)),
            );
          } else {
            const { kind, name: typeName } = parseEndpointTypeKey(
              change.typeKey,
            );
            const { name } = await client.createComponentEndpoint(
              entity,
              {
                workloadEndpoint: change.workloadEndpoint,
                typeKind: kind,
                typeName,
                visibility: change.visibility,
                parameters: change.parameters,
                autoDeploy,
              },
              releaseLine,
            );
            setOriginals(prev => [
              ...prev,
              {
                name,
                releaseLine: toStoredReleaseLine(releaseLine) ?? '',
                workloadEndpoint: change.workloadEndpoint,
                typeKind: kind,
                typeName,
                visibility: change.visibility,
                parameters: change.parameters,
                autoDeploy,
              },
            ]);
          }
        } catch (e) {
          throw new Error(
            `Endpoint ${label} could not be ${
              { create: 'created', update: 'updated', delete: 'deleted' }[
                change.op
              ]
            }: ${getErrorMessage(e)}`,
          );
        }
      }
      setRenames({});
      setInitialMode(mode);
    },
    [
      client,
      entity,
      releaseLine,
      mode,
      allowedEndpoints,
      choices,
      originals,
      renames,
    ],
  );

  return useMemo(
    () => ({
      loading,
      loadError,
      allowedEndpoints,
      originals,
      draftedFromMain: originals.length === 0 ? drafts.length : 0,
      choices,
      renames,
      mode,
      initialMode,
      setMode,
      canUseEndpoints: allowedEndpoints.length > 0,
      setChoice,
      restoreChoice,
      renameWorkloadEndpoint,
      prepare,
      apply,
    }),
    [
      loading,
      loadError,
      allowedEndpoints,
      originals,
      drafts,
      choices,
      renames,
      mode,
      initialMode,
      setChoice,
      restoreChoice,
      renameWorkloadEndpoint,
      prepare,
      apply,
    ],
  );
}
