import { ResponseError } from '@backstage/errors';
import type { StatusType } from '@openchoreo/backstage-design-system';
import type {
  BindingRevision,
  BindingRevisionHealth,
  ResourceReleaseBindingRevision,
} from '@openchoreo/backstage-plugin-common';
import { getErrorMessage } from '../../../utils/errorUtils';

/**
 * The binding a revision history belongs to: a Component's ReleaseBinding
 * or a Resource's ResourceReleaseBinding. Both share the revision and
 * rollback models; only the API they are read and rolled back through
 * differs.
 */
export type BindingKind = 'component' | 'resource';

/** How a revision's health is shown: the StatusBadge variant and its label. */
export interface HealthPill {
  status: StatusType;
  label: BindingRevisionHealth;
}

const HEALTH_PILLS: Record<BindingRevisionHealth, HealthPill> = {
  Healthy: { status: 'success', label: 'Healthy' },
  Progressing: { status: 'pending', label: 'Progressing' },
  Degraded: { status: 'warning', label: 'Degraded' },
  Failed: { status: 'failed', label: 'Failed' },
  Unknown: { status: 'unknown', label: 'Unknown' },
};

/**
 * Maps a revision's health to its pill. A revision the controller has not
 * observed yet has no health and shows as Unknown.
 */
export const healthPill = (health?: string): HealthPill =>
  HEALTH_PILLS[health as BindingRevisionHealth] ?? HEALTH_PILLS.Unknown;

export const revisionNumber = (rev: BindingRevision): number =>
  rev.spec.revision;

/**
 * True for a ResourceReleaseBinding revision: its recorded binding spec is
 * owned by a Resource rather than a Component.
 */
export const isResourceRevision = (
  rev: BindingRevision,
): rev is ResourceReleaseBindingRevision => {
  // Used while rendering: a partial object must not throw.
  const owner: object | undefined = rev.spec.bindingSpec?.owner;
  return !!owner && 'resourceName' in owner;
};

/**
 * The release a revision bound, from the binding spec it recorded: its
 * ComponentRelease for a ReleaseBinding revision, its ResourceRelease for a
 * ResourceReleaseBinding revision.
 */
export const revisionReleaseName = (rev: BindingRevision): string =>
  (isResourceRevision(rev)
    ? rev.spec.bindingSpec.resourceRelease
    : rev.spec.bindingSpec.releaseName) ?? '';

/**
 * The Component or Resource whose binding a revision records: the owner in
 * the binding spec the revision copied.
 */
export const revisionOwnerName = (rev: BindingRevision): string => {
  const owner = rev.spec.bindingSpec.owner;
  return 'resourceName' in owner ? owner.resourceName : owner.componentName;
};

/**
 * How a revision is shown: the component (or resource) name and the
 * revision number, {name}-r{N}, e.g. frontend-r1. Numbers count from 1 per
 * binding. The object's own name is {binding}-r{N} (metadata.name), which is
 * what selection and the API use.
 */
export const revisionName = (rev: BindingRevision): string =>
  `${revisionOwnerName(rev)}-r${rev.spec.revision}`;

/**
 * The reason given for the change a revision records (its change message),
 * or undefined when none was given.
 */
export const revisionMessage = (rev: BindingRevision): string | undefined =>
  rev.spec.message?.trim() || undefined;

/** A change message on one line, cut to max characters with an ellipsis. */
export const shortMessage = (message: string, max = 60): string => {
  const line = message.split(/\s+/).join(' ').trim();
  const chars = Array.from(line);
  return chars.length > max ? `${chars.slice(0, max - 1).join('')}…` : line;
};

export const isActive = (rev: BindingRevision): boolean =>
  rev.status?.active === true;

export const isKnownGood = (rev: BindingRevision): boolean =>
  rev.status?.knownGood === true;

/**
 * The accessible name of a revision row, e.g.
 * "frontend-r4, Healthy, cause Deploy, active, known good".
 * The row's visible text is split across badges, so it is spelled out.
 */
export const revisionAccessibleName = (rev: BindingRevision): string =>
  [
    revisionName(rev),
    healthPill(rev.status?.health).label,
    `cause ${rev.spec.cause}`,
    ...(isActive(rev) ? ['active'] : []),
    ...(isKnownGood(rev) ? ['known good'] : []),
  ].join(', ');

/** Revisions ordered newest first, by revision number. */
export const sortNewestFirst = (
  revisions: BindingRevision[],
): BindingRevision[] =>
  [...revisions].sort((a, b) => revisionNumber(b) - revisionNumber(a));

const isSettling = (rev: BindingRevision): boolean =>
  !rev.status?.health || rev.status.health === 'Progressing';

/**
 * True while the controller is still settling the binding's revision: the
 * active revision is Progressing or has no health yet. Only the active
 * revision's health changes; an inactive one keeps the health it had when it
 * stopped being active, so one deactivated mid-rollout stays Progressing for
 * good and is ignored.
 *
 * With no active revision yet, any revision Progressing or without status
 * counts: the controller creates a revision and writes its status (active,
 * health) in a second write, so a list read between the two shows a
 * revision that is not active yet.
 */
export const hasProgressing = (revisions?: BindingRevision[]): boolean => {
  const list = revisions ?? [];
  const active = list.find(isActive);
  return active ? isSettling(active) : list.some(isSettling);
};

/**
 * Whether the release a revision bound still exists. `releaseNames`
 * is null while the releases are unknown (loading or failed); the revision is
 * then treated as available and the server's check decides.
 */
export const isReleaseAvailable = (
  rev: BindingRevision,
  releaseNames: ReadonlySet<string> | null,
): boolean => !releaseNames || releaseNames.has(revisionReleaseName(rev));

/**
 * Why a revision cannot be rolled back to, or null when it can. Checked in
 * the order a user can act on them.
 */
export const rollbackBlockedReason = (
  rev: BindingRevision | undefined,
  opts: {
    releaseNames: ReadonlySet<string> | null;
    canRollback: boolean;
    deniedTooltip: string;
  },
): string | null => {
  if (!rev) return 'Select a revision to roll back to.';
  if (!opts.canRollback) {
    return (
      opts.deniedTooltip ||
      'You do not have permission to roll back this deployment.'
    );
  }
  if (isActive(rev)) {
    return `${revisionName(rev)} is already active.`;
  }
  if (!isReleaseAvailable(rev, opts.releaseNames)) {
    return `Release ${revisionReleaseName(
      rev,
    )} has been deleted, so ${revisionName(rev)} can no longer be restored.`;
  }
  return null;
};

/** The API's code for a 409, when the backend passed one through. */
const conflictCode = (error: unknown): string | undefined => {
  if (!(error instanceof ResponseError) || error.statusCode !== 409) {
    return undefined;
  }
  const code = (error.cause as { code?: unknown } | undefined)?.code;
  return typeof code === 'string' ? code : undefined;
};

/** True when a rollback failed because the binding changed meanwhile. */
export const isConcurrentModification = (error: unknown): boolean =>
  conflictCode(error) === 'CONCURRENT_MODIFICATION';

/**
 * True when a rollback was refused because auto deploy would undo it: the
 * binding is in the first environment of the deployment pipeline and auto
 * deploy is on.
 */
export const isAutoDeployBlocked = (error: unknown): boolean =>
  conflictCode(error) === 'AUTO_DEPLOY_ENABLED';

/** A message for a failed rollback or rollback preview. */
export const describeRollbackError = (error: unknown): string => {
  if (error instanceof ResponseError) {
    if (error.statusCode === 403) {
      return 'You do not have permission to roll back this deployment. Contact your administrator.';
    }
    if (error.statusCode === 409) {
      const detail = error.cause?.message;
      switch (conflictCode(error)) {
        case 'RELEASE_DELETED':
          return `The release this revision deployed has been deleted, so it can no longer be restored.${
            detail ? ` ${detail}` : ''
          }`;
        case 'CONCURRENT_MODIFICATION':
          return 'The deployment changed while you were reviewing the rollback. Review the updated preview and confirm again.';
        case 'AUTO_DEPLOY_ENABLED':
          return 'Rollback blocked: auto deploy is enabled for this component, and this is the first environment of its deployment pipeline, so auto deploy would move it straight back to the latest release. Turn off auto deploy for the component in the Set Up tab, then roll back again.';
        // The server's message already says why and what to do.
        case 'GITOPS_MANAGED':
          return (
            detail ??
            'Rollback blocked: this deployment is managed by GitOps. Revert its configuration in Git instead.'
          );
        case 'NO_PREVIOUS_REVISION':
          return (
            detail ??
            'There is no previous revision to roll back to. Pick a revision instead.'
          );
        default:
          return `The rollback conflicts with the current deployment${
            detail ? `: ${detail}` : '.'
          }`;
      }
    }
    if (error.statusCode === 404) {
      return 'This revision no longer exists: it has been deleted, so it can no longer be rolled back to.';
    }
  }
  return `Rollback failed: ${getErrorMessage(error)}`;
};

/** True when a request failed because its revision or binding is gone. */
export const isNotFound = (error: unknown): boolean =>
  error instanceof ResponseError && error.statusCode === 404;

/**
 * Why a revision may not be deleted, or null when it may. Mirrors the
 * server's rules -- the active revision and the newest known-good revision
 * are protected -- so the Delete
 * action is disabled up front; the server checks again and has the final say.
 * revisions is the binding's whole history.
 */
export const deleteBlockedReason = (
  rev: BindingRevision | undefined,
  revisions: BindingRevision[],
  opts: { canDelete: boolean; deniedTooltip: string },
): string | null => {
  if (!rev) return 'Select a revision to delete.';
  if (!opts.canDelete) {
    return (
      opts.deniedTooltip ||
      'You do not have permission to delete revisions of this deployment.'
    );
  }
  if (isActive(rev)) {
    return `${revisionName(rev)} is currently active and cannot be deleted.`;
  }
  const newestKnownGood = revisions
    .filter(isKnownGood)
    .reduce<number>((n, r) => Math.max(n, revisionNumber(r)), 0);
  if (isKnownGood(rev) && revisionNumber(rev) === newestKnownGood) {
    return `${revisionName(
      rev,
    )} is the newest known-good revision, kept as the rollback target of last resort.`;
  }
  return null;
};

/** A message for a failed revision deletion or deletion check. */
export const describeDeleteRevisionError = (error: unknown): string => {
  if (error instanceof ResponseError) {
    const detail = error.cause?.message;
    if (error.statusCode === 403) {
      return 'You do not have permission to delete revisions of this deployment. Contact your administrator.';
    }
    if (error.statusCode === 404) {
      return 'This revision no longer exists: it has already been deleted.';
    }
    if (error.statusCode === 409) {
      if (conflictCode(error) === 'CONCURRENT_MODIFICATION') {
        return 'The revision changed while it was being deleted (it may have become active). Review it and try again.';
      }
      return detail ?? 'The revision cannot be deleted.';
    }
  }
  return `Deleting the revision failed: ${getErrorMessage(error)}`;
};

/**
 * A run of revision numbers missing from a history: revisions deleted by
 * hand, or removed by the history limit while an older one was kept.
 * Revision numbers are never reused, so a gap stays.
 */
export interface RevisionGap {
  /** Lowest missing number. */
  from: number;
  /** Highest missing number. */
  to: number;
}

/**
 * The gaps between the revisions of a history, keyed by the number of the
 * revision listed just above each gap. Expects revisions newest first.
 * Numbers below the oldest revision are not reported.
 */
export const revisionGaps = (
  revisions: BindingRevision[],
): Map<number, RevisionGap> => {
  const gaps = new Map<number, RevisionGap>();
  for (let i = 0; i + 1 < revisions.length; i++) {
    const above = revisionNumber(revisions[i]);
    const below = revisionNumber(revisions[i + 1]);
    if (above - below > 1) {
      gaps.set(above, { from: below + 1, to: above - 1 });
    }
  }
  return gaps;
};

/** How a gap is labelled: "r2" or "r2–r4". */
export const gapLabel = (gap: RevisionGap): string =>
  gap.from === gap.to ? `r${gap.from}` : `r${gap.from}–r${gap.to}`;
