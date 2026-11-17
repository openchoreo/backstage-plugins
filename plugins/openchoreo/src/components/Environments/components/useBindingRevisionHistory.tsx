import { type ReactNode, useEffect, useState } from 'react';
import { alertApiRef, useApi } from '@backstage/core-plugin-api';
import { useEntity } from '@backstage/plugin-catalog-react';
import type {
  BindingRevision,
  BindingRevisionHistoryLimit,
  DeleteBindingRevisionResponse,
  RollbackResponse,
} from '@openchoreo/backstage-plugin-common';
import { useReleaseBindingRevisions } from '../hooks/useReleaseBindingRevisions';
import {
  type BindingKind,
  deleteBlockedReason,
  isActive,
  revisionName,
  rollbackBlockedReason,
} from '../utils/revisionUtils';
import { RevisionBrowserDialog } from './RevisionBrowserDialog';
import { RevisionManifestDialog } from './RevisionManifestDialog';
import { RollbackConfirmDialog } from './RollbackConfirmDialog';
import { DeleteRevisionDialog } from './DeleteRevisionDialog';
import {
  RevisionHistoryLimitControl,
  inheritedLimitText,
} from './RevisionHistoryLimitControl';

export interface UseBindingRevisionHistoryOptions {
  /** Whose binding: a Component's ReleaseBinding or a Resource's. */
  kind: BindingKind;
  /** The environment's display name, e.g. "Development". */
  environmentName: string;
  /** The environment's resource name, e.g. "development". */
  envResourceName: string;
  bindingName: string;
  /** Names of releases that still exist; null while unknown. */
  releaseNames: ReadonlySet<string> | null;
  canRollback: boolean;
  deniedTooltip: string;
  /** Whether the user may delete revisions; false hides nothing, it disables. */
  canDeleteRevision?: boolean;
  deleteDeniedTooltip?: string;
  /**
   * Whether the user may change the binding, which its revision history
   * limit is part of; false disables the limit control.
   */
  canUpdateBinding?: boolean;
  updateDeniedTooltip?: string;
  /** Called after a rollback is applied, to refresh the environments. */
  onRolledBack: () => void;
}

export interface BindingRevisionHistory {
  /** Revisions of the binding, newest first. */
  revisions: BindingRevision[];
  active: BindingRevision | undefined;
  loading: boolean;
  isRefetching: boolean;
  error: Error | null;
  /** The revision picked to roll back to; the active one until another is. */
  selectedName: string | null;
  setSelectedName: (name: string | null) => void;
  selected: BindingRevision | undefined;
  /** Whether the user may roll back this binding at all. */
  canRollback: boolean;
  /** Why the user may not roll back, when canRollback is false. */
  rollbackDeniedTooltip: string;
  /** Why rolling back to rev is not allowed, or null when it is. */
  rollbackBlockedReason: (rev: BindingRevision | undefined) => string | null;
  /** Opens the Revision Browser on the named revision, or on the selected one. */
  openBrowser: (revisionName?: string) => void;
  /** Opens the active revision's manifest, like the release's. */
  openManifest: () => void;
  /** Opens the rollback confirmation (dry run first) for rev. */
  openConfirm: (rev: BindingRevision) => void;
  /** The manifest, browser, rollback and delete dialogs; render them once. */
  dialogs: ReactNode;
}

/**
 * The state behind an environment binding's revision history: the revisions,
 * the revision picked to roll back to, and the Revision Browser, rollback
 * confirmation and delete dialogs with their success toasts. Shared by the
 * revision picker (BindingRevisionHistory) and the Component deploy panel,
 * which shows the active revision beside the release and opens the browser
 * from its Actions.
 */
export const useBindingRevisionHistory = ({
  kind,
  environmentName,
  envResourceName,
  bindingName,
  releaseNames,
  canRollback,
  deniedTooltip,
  canDeleteRevision = false,
  deleteDeniedTooltip = '',
  canUpdateBinding = false,
  updateDeniedTooltip = '',
  onRolledBack,
}: UseBindingRevisionHistoryOptions): BindingRevisionHistory => {
  const { entity } = useEntity();
  const alertApi = useApi(alertApiRef);

  const {
    revisions,
    loading,
    error,
    isRefetching,
    awaitRevision,
    awaitTrim,
    refetch,
  } = useReleaseBindingRevisions(entity, envResourceName, bindingName, {
    kind,
  });

  const active = revisions.find(isActive);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [browserOpen, setBrowserOpen] = useState(false);
  const [manifestOpen, setManifestOpen] = useState(false);
  const [browserInitialName, setBrowserInitialName] = useState<string | null>(
    null,
  );
  const [confirmTarget, setConfirmTarget] = useState<BindingRevision | null>(
    null,
  );
  const [deleteTarget, setDeleteTarget] = useState<BindingRevision | null>(
    null,
  );

  // The picker shows the active revision until another is picked, and
  // returns to it when the picked one disappears.
  useEffect(() => {
    if (selectedName && revisions.some(r => r.metadata.name === selectedName)) {
      return;
    }
    setSelectedName(active?.metadata.name ?? null);
  }, [revisions, selectedName, active]);

  // Another environment's history: start from its active revision.
  useEffect(() => {
    setSelectedName(null);
  }, [envResourceName]);

  const selected = revisions.find(r => r.metadata.name === selectedName);
  const blockedReason = (rev: BindingRevision | undefined) =>
    rollbackBlockedReason(rev, { releaseNames, canRollback, deniedTooltip });

  const handleRolledBack = (result: RollbackResponse) => {
    const unchanged = result.warnings.some(w => w.code === 'NoSpecChange');
    const target = revisions.find(r => r.metadata.name === result.revisionName);
    const shownName =
      result.revisionDisplayName ??
      (target ? revisionName(target) : result.revisionName);
    alertApi.post({
      message: unchanged
        ? `${shownName} is already active in ${environmentName}; nothing changed.`
        : `Rolled back ${environmentName} to revision ${result.revision}: ${shownName} is active again.`,
      severity: 'success',
      display: 'transient',
    });
    if (!unchanged) {
      awaitRevision(result.revisionName);
      // The rolled-back revision becomes the active one the picker shows.
      setSelectedName(result.revisionName);
    }
    onRolledBack();
  };

  // The other revisions keep their numbers; the list is refreshed so the
  // deleted one is no longer offered anywhere, the picker included.
  const handleDeleted = (result: DeleteBindingRevisionResponse) => {
    const shownName = result.revisionDisplayName ?? result.revisionName;
    alertApi.post({
      message: `Deleted revision ${result.revision} (${shownName}) from ${environmentName}'s history.`,
      severity: 'success',
      display: 'transient',
    });
    refetch();
  };

  // A lower limit makes the controller delete the oldest revisions after the
  // API call returns, so the list keeps refreshing until they are gone or the
  // wait times out. The limit in effect is unknown when it comes from the
  // platform default or an Environment that could not be read.
  const handleLimitChanged = (limit: BindingRevisionHistoryLimit) => {
    alertApi.post({
      message:
        limit.bindingLimit === null
          ? `${environmentName} now uses ${inheritedLimitText(
              limit,
            )} for its revision history.`
          : `${environmentName} now keeps ${limit.bindingLimit} old ${
              limit.bindingLimit === 1 ? 'revision' : 'revisions'
            }.`,
      severity: 'success',
      display: 'transient',
    });
    awaitTrim(
      limit.bindingLimit ??
        (limit.environmentLimitUnreadable ? null : limit.environmentLimit),
    );
  };

  const openBrowser = (name?: string) => {
    setBrowserInitialName(name ?? selectedName);
    setBrowserOpen(true);
  };

  const openDelete = (rev: BindingRevision) => {
    setBrowserOpen(false);
    setDeleteTarget(rev);
  };

  const openConfirm = (rev: BindingRevision) => {
    setBrowserOpen(false);
    setConfirmTarget(rev);
  };

  const dialogs = (
    <>
      <RevisionManifestDialog
        open={manifestOpen}
        onClose={() => setManifestOpen(false)}
        revision={active}
        environmentName={environmentName}
        onOpenRevisionBrowser={() => openBrowser(active?.metadata.name)}
      />

      <RevisionBrowserDialog
        open={browserOpen}
        onClose={() => setBrowserOpen(false)}
        revisions={revisions}
        environmentName={environmentName}
        releaseNames={releaseNames}
        initialRevisionName={browserInitialName}
        rollbackBlockedReason={rev => blockedReason(rev)}
        onRollback={openConfirm}
        deleteBlockedReason={rev =>
          deleteBlockedReason(rev, revisions, {
            canDelete: canDeleteRevision,
            deniedTooltip: deleteDeniedTooltip,
          })
        }
        onDelete={openDelete}
        historyLimitControl={
          // Mounted with the browser so the limit is read when it opens.
          browserOpen && (
            <RevisionHistoryLimitControl
              kind={kind}
              bindingName={bindingName}
              environmentName={environmentName}
              oldRevisionCount={revisions.filter(r => !isActive(r)).length}
              canUpdate={canUpdateBinding}
              deniedTooltip={
                updateDeniedTooltip ||
                'You do not have permission to change the revision history limit.'
              }
              onChanged={handleLimitChanged}
            />
          )
        }
      />

      <RollbackConfirmDialog
        open={confirmTarget !== null}
        onClose={() => setConfirmTarget(null)}
        kind={kind}
        bindingName={bindingName}
        environmentName={environmentName}
        target={confirmTarget}
        activeRevisionName={active ? revisionName(active) : undefined}
        onRolledBack={handleRolledBack}
        onTargetMissing={() => refetch()}
      />

      <DeleteRevisionDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        kind={kind}
        bindingName={bindingName}
        environmentName={environmentName}
        target={deleteTarget}
        onDeleted={handleDeleted}
        onTargetMissing={() => refetch()}
      />
    </>
  );

  return {
    revisions,
    active,
    loading,
    isRefetching,
    error,
    selectedName,
    setSelectedName,
    selected,
    canRollback,
    rollbackDeniedTooltip:
      deniedTooltip ||
      'You do not have permission to roll back this deployment.',
    rollbackBlockedReason: blockedReason,
    openBrowser,
    openManifest: () => setManifestOpen(true),
    openConfirm,
    dialogs,
  };
};
