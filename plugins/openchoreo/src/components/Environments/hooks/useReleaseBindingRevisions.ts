import { useCallback, useEffect, useState } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { Entity, stringifyEntityRef } from '@backstage/catalog-model';
import { useOpenChoreoQuery } from '@openchoreo/backstage-plugin-react';
import type { BindingRevision } from '@openchoreo/backstage-plugin-common';
import { openChoreoClientApiRef } from '../../../api/OpenChoreoClientApi';
import {
  type BindingKind,
  hasProgressing,
  sortNewestFirst,
} from '../utils/revisionUtils';

/**
 * Whether the controller has recorded the named revision as the active one.
 * Existing is not enough: its status is written separately, after creation.
 */
const isRecorded = (
  revisions: BindingRevision[] | undefined,
  name: string,
): boolean =>
  !!revisions?.some(r => r.metadata.name === name && r.status?.active === true);

/** How often the list refreshes while a revision is still settling. */
export const REVISION_POLL_INTERVAL_MS = 5000;
/**
 * How long to keep polling for the revision a rollback is recorded as. The
 * controller records it on its next reconcile, normally within seconds.
 */
export const AWAIT_REVISION_TIMEOUT_MS = 60_000;
/**
 * How long to keep polling for the controller to delete revisions above a
 * lowered history limit. It trims on its next reconcile, normally within
 * seconds; revisions it always keeps can stay above the limit, so the wait is
 * bounded rather than open-ended.
 */
export const AWAIT_TRIM_TIMEOUT_MS = 30_000;

/** Revisions that are not the active one: those a history limit counts. */
const oldRevisionCount = (revisions: BindingRevision[] | undefined): number =>
  revisions?.filter(r => r.status?.active !== true).length ?? 0;

/**
 * Whether the list still shows more old revisions than the limit keeps. With
 * an unknown limit (null) it is never known to be trimmed, so the wait only
 * ends at its timeout.
 */
const awaitingTrim = (
  revisions: BindingRevision[] | undefined,
  limit: number | null,
): boolean => limit === null || oldRevisionCount(revisions) > limit;

export interface UseReleaseBindingRevisionsOptions {
  /**
   * Which binding the entity owns: a Component's ReleaseBinding (default)
   * or a Resource's ResourceReleaseBinding.
   */
  kind?: BindingKind;
  pollIntervalMs?: number;
  awaitTimeoutMs?: number;
  awaitTrimTimeoutMs?: number;
}

export interface UseReleaseBindingRevisionsResult {
  /** Revisions of the binding, newest first. */
  revisions: BindingRevision[];
  loading: boolean;
  isRefetching: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  /**
   * Keep refreshing until a revision with this name appears as the active
   * one. Rollbacks are recorded by the controller after the API call
   * returns, so the new revision is not in the list straight away.
   */
  awaitRevision: (revisionName: string) => void;
  /**
   * Keep refreshing, for at most AWAIT_TRIM_TIMEOUT_MS, until the list shows
   * no more old revisions than limit: the history limit now in effect, or null
   * when it is not known. A lowered limit is trimmed by the controller after
   * the API call returns.
   */
  awaitTrim: (limit: number | null) => void;
}

/**
 * Fetches the revision history of the entity's binding in one environment:
 * a Component's ReleaseBinding, or a Resource's ResourceReleaseBinding.
 * bindingName narrows it to that binding, since a component has one binding
 * per release line in an environment. The list refreshes on an interval while any revision is
 * Progressing, and while a revision passed to awaitRevision is missing.
 */
export function useReleaseBindingRevisions(
  entity: Entity,
  environment: string | undefined,
  bindingName: string | undefined,
  {
    kind = 'component',
    pollIntervalMs = REVISION_POLL_INTERVAL_MS,
    awaitTimeoutMs = AWAIT_REVISION_TIMEOUT_MS,
    awaitTrimTimeoutMs = AWAIT_TRIM_TIMEOUT_MS,
  }: UseReleaseBindingRevisionsOptions = {},
): UseReleaseBindingRevisionsResult {
  const client = useApi(openChoreoClientApiRef);
  const [awaiting, setAwaiting] = useState<string | null>(null);
  // The history limit a trim is awaited for; undefined when none is.
  const [trimLimit, setTrimLimit] = useState<number | null | undefined>(
    undefined,
  );

  const { data, loading, isRefetching, error, refetch } = useOpenChoreoQuery(
    [
      kind === 'resource'
        ? 'resourceReleaseBindingRevisions'
        : 'releaseBindingRevisions',
      stringifyEntityRef(entity),
      environment ?? '',
      bindingName ?? '',
    ],
    async () =>
      sortNewestFirst(
        kind === 'resource'
          ? await client.listResourceReleaseBindingRevisions(
              entity,
              environment!,
              bindingName,
            )
          : await client.listReleaseBindingRevisions(
              entity,
              environment!,
              bindingName,
            ),
      ),
    {
      enabled: !!environment,
      refetchInterval: query => {
        const revisions = query.state.data;
        const missing = awaiting !== null && !isRecorded(revisions, awaiting);
        const untrimmed =
          trimLimit !== undefined && awaitingTrim(revisions, trimLimit);
        return missing || untrimmed || hasProgressing(revisions)
          ? pollIntervalMs
          : false;
      },
    },
  );

  // Stop waiting once the revision shows up.
  useEffect(() => {
    if (awaiting !== null && isRecorded(data, awaiting)) setAwaiting(null);
  }, [awaiting, data]);

  // ...or after the timeout, so a rollback the controller never records
  // doesn't poll forever. The deadline is set when the wait starts; list
  // refreshes do not move it.
  useEffect(() => {
    if (awaiting === null) return undefined;
    const timer = setTimeout(() => setAwaiting(null), awaitTimeoutMs);
    return () => clearTimeout(timer);
  }, [awaiting, awaitTimeoutMs]);

  // Stop waiting for a trim once the list is within the limit...
  useEffect(() => {
    if (trimLimit !== undefined && !awaitingTrim(data, trimLimit)) {
      setTrimLimit(undefined);
    }
  }, [trimLimit, data]);

  // ...or after its timeout, measured from when the wait started.
  useEffect(() => {
    if (trimLimit === undefined) return undefined;
    const timer = setTimeout(() => setTrimLimit(undefined), awaitTrimTimeoutMs);
    return () => clearTimeout(timer);
  }, [trimLimit, awaitTrimTimeoutMs]);

  // A different environment has its own history; drop pending waits.
  useEffect(() => {
    setAwaiting(null);
    setTrimLimit(undefined);
  }, [environment]);

  const awaitRevision = useCallback(
    (revisionName: string) => {
      setAwaiting(revisionName);
      refetch();
    },
    [refetch],
  );

  const awaitTrim = useCallback(
    (limit: number | null) => {
      setTrimLimit(limit);
      refetch();
    },
    [refetch],
  );

  return {
    revisions: data ?? [],
    loading,
    isRefetching,
    error,
    refetch,
    awaitRevision,
    awaitTrim,
  };
}
