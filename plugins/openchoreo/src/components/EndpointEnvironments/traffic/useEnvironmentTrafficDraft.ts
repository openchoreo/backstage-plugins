import { useCallback, useMemo, useState } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import type { Entity } from '@backstage/catalog-model';
import type { Change } from '@openchoreo/backstage-plugin-react';
import {
  backendLabel,
  capabilityProblems,
  describeMatch,
  isMirror,
  matchProblem,
  sameMatch,
  splitOf,
  splitProblem,
  type EndpointBackendMatch,
  type EndpointSplit,
  type EndpointTrafficBackend,
} from '@openchoreo/backstage-plugin-common';
import { openChoreoClientApiRef } from '../../../api/OpenChoreoClientApi';
import { toMatch, toRows, type ConditionRow } from './BackendPage';
import { draftSplit, toDraft, type ShareDraft } from './ShareFields';
import { servedBackends, useEndpointTraffic } from './useEndpointTraffic';

/**
 * An environment's own traffic as it is being edited on its Configure
 * Overrides page: the shares, copies and conditions it serves now, the
 * values typed so far, what changed, why it can't be saved, and save and
 * reset.
 */
export function useEnvironmentTrafficDraft(entity: Entity, envName: string) {
  const client = useApi(openChoreoClientApiRef);
  const { info, loading, error, refetch } = useEndpointTraffic(entity);
  const env = info?.environments.find(e => e.environment === envName);

  const release = useMemo(() => env?.release ?? [], [env]);
  const served = useMemo(() => (env ? servedBackends(env) : []), [env]);
  const conditioned = useMemo(
    () => release.filter(b => b.match && !isMirror(b)),
    [release],
  );
  const initialSplit = useMemo(() => splitOf(served), [served]);
  const defaultSplit = useMemo(() => splitOf(release), [release]);
  const initialRows = useMemo(
    () =>
      Object.fromEntries(
        served.filter(b => b.match).map(b => [b.name, toRows(b.match)]),
      ) as Record<string, ConditionRow[]>,
    [served],
  );

  // The values typed so far, for the traffic the environment served when
  // they were typed; a reload starts again from what it serves then.
  const [edit, setEdit] = useState<{
    base: EndpointSplit;
    draft: ShareDraft;
    rows: Record<string, ConditionRow[]>;
  }>();
  const current =
    edit?.base === initialSplit
      ? edit
      : { base: initialSplit, draft: toDraft(initialSplit), rows: initialRows };
  const { draft, rows } = current;
  const setDraft = (next: ShareDraft) => setEdit({ ...current, draft: next });
  const setRows = (next: Record<string, ConditionRow[]>) =>
    setEdit({ ...current, rows: next });

  const split: EndpointSplit = draftSplit(draft);
  const matches: Record<string, EndpointBackendMatch> = Object.fromEntries(
    conditioned
      .filter(b => rows[b.name])
      .map(b => [b.name, toMatch(rows[b.name])]),
  );

  const preview: EndpointTrafficBackend[] = served.map(b => {
    if (isMirror(b)) return { ...b, mirror: { percent: split[b.name] || 0 } };
    return {
      ...b,
      weight: split[b.name] || 0,
      ...(matches[b.name] && { match: matches[b.name] }),
    };
  });

  const changes: Change[] = [
    ...served
      .filter(b => split[b.name] !== initialSplit[b.name])
      .map(b => ({
        path: isMirror(b) ? `${b.name} copy` : `${b.name} share`,
        type: 'modified' as const,
        oldValue: `${initialSplit[b.name]}%`,
        newValue: Number.isNaN(split[b.name]) ? '' : `${split[b.name]}%`,
      })),
    ...served
      .filter(b => b.match && !sameMatch(matches[b.name], b.match))
      .map(b => ({
        path: `${b.name} condition`,
        type: 'modified' as const,
        oldValue: describeMatch(b.match!),
        newValue: describeMatch(matches[b.name] ?? {}),
      })),
  ];

  let problem = served.length > 0 ? splitProblem(served, split) : '';
  for (const b of conditioned) {
    if (problem || !matches[b.name]) continue;
    const p = matchProblem(preview, b.name, matches[b.name]);
    if (p) problem = `${backendLabel(b)}: ${p}`;
  }
  // The type of the release this environment runs must render what it uses.
  if (!problem) {
    problem = capabilityProblems(preview, env?.capabilities)[0] ?? '';
  }

  const own = Boolean(env && env.overrides.length > 0);
  const applies = Boolean(env?.endpointRelease) && release.length > 1;

  const save = useCallback(async () => {
    try {
      await client.setEnvironmentSplit(entity, envName, split, matches);
    } catch (e: unknown) {
      // 501: the shares and copies were saved but the control plane dropped
      // the conditions. Read what is stored now, so the form shows it.
      if ((e as { response?: { status?: number } })?.response?.status === 501) {
        await refetch().catch(() => undefined);
      }
      throw e;
    }
  }, [client, entity, envName, split, matches, refetch]);
  const reset = useCallback(
    () => client.setEnvironmentSplit(entity, envName, null),
    [client, entity, envName],
  );

  return {
    info,
    env,
    loading,
    error,
    refetch,
    /** The environment's release has more than one backend to route between. */
    applies,
    /** The environment has its own traffic now. */
    own,
    release,
    served,
    draft,
    setDraft,
    rows,
    setRows,
    initialSplit,
    defaultSplit,
    preview,
    changes,
    dirty: changes.length > 0,
    problem,
    save,
    reset,
  };
}

export type EnvironmentTrafficDraft = ReturnType<
  typeof useEnvironmentTrafficDraft
>;
