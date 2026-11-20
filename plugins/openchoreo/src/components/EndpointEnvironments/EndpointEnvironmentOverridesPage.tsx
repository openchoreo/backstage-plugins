import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Tooltip,
  Typography,
  makeStyles,
} from '@material-ui/core';
import { Alert } from '@material-ui/lab';
import SettingsIcon from '@material-ui/icons/Settings';
import CallSplitIcon from '@material-ui/icons/CallSplit';
import type { JSONSchema7 } from 'json-schema';
import { useSearchParams } from 'react-router-dom';
import { useApi } from '@backstage/core-plugin-api';
import { useEntity } from '@backstage/plugin-catalog-react';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import {
  ChangesList,
  DetailPageLayout,
  ForbiddenState,
  UnsavedChangesDialog,
} from '@openchoreo/backstage-plugin-react';
import {
  RjsfForm,
  Skeleton,
  VerticalTabNav,
  type TabItemData,
} from '@openchoreo/backstage-design-system';
import {
  openChoreoClientApiRef,
  type EndpointEnvironment,
} from '../../api/OpenChoreoClientApi';
import { isForbiddenError, getErrorMessage } from '../../utils/errorUtils';
import { useNotification } from '../../hooks';
import { NotificationBanner } from '../Environments/components';
import { EnvironmentTrafficTab } from './traffic/EnvironmentTrafficTab';
import { useEnvironmentTrafficDraft } from './traffic/useEnvironmentTrafficDraft';
import { useUnsavedGuard } from './traffic/useUnsavedGuard';
import { ClearOverridesDialog } from './ClearOverridesDialog';

const useStyles = makeStyles(theme => ({
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    padding: theme.spacing(4),
  },
  formCard: {
    backgroundColor: theme.palette.background.paper,
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 12,
    padding: theme.spacing(3),
  },
  formHint: {
    color: theme.palette.text.secondary,
    fontSize: theme.typography.body2.fontSize,
    marginBottom: theme.spacing(2),
  },
  actionsRow: {
    display: 'flex',
    gap: theme.spacing(1),
    alignItems: 'center',
  },
  tabNav: {
    minHeight: 400,
  },
  emptyState: {
    color: theme.palette.text.secondary,
    fontStyle: 'italic',
    padding: theme.spacing(4),
    textAlign: 'center',
  },
}));

export interface EndpointEnvironmentOverridesPageProps {
  envName: string;
  /**
   * When set, the wizard runs in deploy mode: the binding is pinned to
   * this release on save and the primary action reads "Deploy".
   */
  releaseFromUrl?: string;
  onBack: () => void;
  onSaved: () => void;
}

function trafficStatus(traffic: {
  dirty: boolean;
  problem: string;
  own: boolean;
}): TabItemData['status'] {
  if (traffic.dirty && traffic.problem) return 'error';
  if (traffic.dirty) return 'info';
  if (traffic.own) return 'success';
  return undefined;
}

/**
 * The page's content, in the Configuration and Traffic tabs of a Component's
 * overrides page when the environment routes to more than one backend, or
 * on its own otherwise.
 */
const TabsIfTraffic = ({
  show,
  activeTab,
  onChange,
  configStatus,
  trafficStatus: status,
  traffic,
  className,
  children,
}: {
  show: boolean;
  activeTab: string;
  onChange: (tab: string) => void;
  configStatus: TabItemData['status'];
  trafficStatus: TabItemData['status'];
  traffic: ReactNode;
  className?: string;
  children: ReactNode;
}) => {
  if (!show) return <>{children}</>;
  const tabs: TabItemData[] = [
    {
      id: 'configuration',
      label: 'Configuration',
      icon: <SettingsIcon />,
      status: configStatus,
    },
    { id: 'traffic', label: 'Traffic', icon: <CallSplitIcon />, status },
  ];
  return (
    <VerticalTabNav
      tabs={tabs}
      activeTabId={activeTab}
      onChange={onChange}
      className={className}
    >
      {activeTab === 'traffic' ? traffic : children}
    </VerticalTabNav>
  );
};

/**
 * Edits `EndpointReleaseBinding.spec.endpointTypeEnvironmentConfigs` for a
 * single environment, and its own traffic (`spec.backendOverrides`) on the
 * Traffic tab when its release routes to more than one backend. Saving
 * updates the binding through the BFF, and the controller re-renders the
 * endpoint's routes there with the new values.
 *
 * The schema comes from the snapshot stored on the pinned EndpointRelease
 * (not the live (Cluster)EndpointType) so the form validates against what
 * the release was actually cut against — the live type may have drifted.
 */
export const EndpointEnvironmentOverridesPage = ({
  envName,
  releaseFromUrl,
  onBack,
  onSaved,
}: EndpointEnvironmentOverridesPageProps) => {
  const classes = useStyles();
  const { entity } = useEntity();
  const client = useApi(openChoreoClientApiRef);
  const notification = useNotification();

  const [envInfo, setEnvInfo] = useState<EndpointEnvironment | null>(null);
  const [schema, setSchema] = useState<JSONSchema7 | null>(null);
  const [overrides, setOverrides] = useState<Record<string, unknown>>({});
  const [initialOverrides, setInitialOverrides] = useState<
    Record<string, unknown>
  >({});
  /**
   * True when the binding had a non-empty endpointTypeEnvironmentConfigs
   * map. Distinct from `hasChanges` because RJSF auto-fills defaults from
   * the schema on mount; we use the backend's perspective to gate the
   * Clear Overrides action.
   */
  const [hasActualOverrides, setHasActualOverrides] = useState(false);
  /**
   * When the backend has no stored overrides, RJSF auto-fills schema
   * defaults on its first onChange and we adopt that normalized snapshot
   * as the baseline (otherwise hasChanges would flip true on mount).
   * When the backend already has values, those values ARE the baseline
   * and we skip the capture so a real user edit doesn't get mistaken
   * for initial state.
   */
  const formInitializedRef = useRef(true);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [search, setSearch] = useSearchParams();
  const traffic = useEnvironmentTrafficDraft(entity, envName);
  const trafficGuard = useUnsavedGuard(traffic.dirty && !saving);

  const namespaceName =
    entity.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE] || '';
  const typeDisplayName =
    entity.metadata.annotations?.[CHOREO_ANNOTATIONS.ENDPOINTTYPE] ??
    'this endpoint type';
  const envDisplayName = envInfo?.name ?? envName;
  const hasBinding = Boolean(envInfo?.bindingName);
  const isDeployMode = Boolean(releaseFromUrl);
  const showTraffic = !isDeployMode && traffic.applies;
  const activeTab =
    showTraffic && search.get('tab') === 'traffic'
      ? 'traffic'
      : 'configuration';

  const effectiveRelease =
    releaseFromUrl ?? envInfo?.endpointRelease ?? envInfo?.latestRelease ?? '';

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    const load = async () => {
      try {
        const envs = await client.fetchEndpointEnvironmentInfo(entity);
        if (cancelled) return;

        const matchingEnv =
          envs.find(e => e.resourceName === envName || e.name === envName) ??
          null;
        setEnvInfo(matchingEnv);

        const backendOverrides =
          matchingEnv?.endpointTypeEnvironmentConfigs ?? {};
        const backendOverridesCopy = JSON.parse(
          JSON.stringify(backendOverrides),
        );

        // If the backend has stored values, those are the baseline; skip
        // the RJSF normalization capture so the user's first edit isn't
        // mistaken for initial state. Empty backend → allow capture to
        // absorb schema-default expansion.
        formInitializedRef.current = Object.keys(backendOverrides).length > 0;
        setOverrides(backendOverridesCopy);
        setInitialOverrides(backendOverridesCopy);
        setHasActualOverrides(Object.keys(backendOverrides).length > 0);

        const releaseForSchema =
          releaseFromUrl ??
          matchingEnv?.endpointRelease ??
          matchingEnv?.latestRelease ??
          '';

        if (!releaseForSchema) {
          setSchema({} as JSONSchema7);
          return;
        }

        const schemaResult = await client.fetchEndpointReleaseSchema(
          namespaceName,
          releaseForSchema,
        );
        if (cancelled) return;

        setSchema((schemaResult?.data as JSONSchema7) ?? ({} as JSONSchema7));
      } catch (err: unknown) {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [client, entity, envName, namespaceName, releaseFromUrl]);

  const hasChanges = useMemo(
    () => JSON.stringify(overrides) !== JSON.stringify(initialOverrides),
    [overrides, initialOverrides],
  );

  const hasFields =
    !!schema?.properties && Object.keys(schema.properties).length > 0;

  const persist = useCallback(
    async (next: Record<string, unknown>) => {
      // Saving overrides on an existing binding leaves its release alone, so
      // a promotion made since this page loaded is not rolled back and an
      // unpinned binding is not pinned. Only a deploy, or a save that creates
      // the binding, sends a release.
      const pinRelease = isDeployMode || !hasBinding;
      if (pinRelease && !effectiveRelease) {
        throw new Error(
          'No release available to bind. The endpoint has not cut a release yet.',
        );
      }
      const envRef = envInfo?.resourceName ?? envName;
      await client.updateEndpointReleaseBinding(entity, envRef, {
        ...(pinRelease && { endpointRelease: effectiveRelease }),
        endpointTypeEnvironmentConfigs: next,
      });
    },
    [
      client,
      effectiveRelease,
      entity,
      envInfo?.resourceName,
      envName,
      hasBinding,
      isDeployMode,
    ],
  );

  const handlePrimary = useCallback(async () => {
    setConfirming(false);
    setSaving(true);
    setSaveError(null);
    try {
      if (isDeployMode) {
        // First, so no write pins the release with overrides it doesn't
        // heed: this keeps the environment's own traffic where the release
        // still has its backends, as a promote does.
        await client.deployEndpointRelease(
          entity,
          envInfo?.resourceName ?? envName,
          effectiveRelease,
        );
      }
      if (isDeployMode || hasChanges) await persist(overrides);
      if (traffic.dirty) await traffic.save();
      notification.showSuccess(
        isDeployMode
          ? `Deployed ${effectiveRelease} to ${envDisplayName}.`
          : `Saved overrides for ${envDisplayName}.`,
      );
      trafficGuard.pass(onSaved);
    } catch (err: unknown) {
      setSaveError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }, [
    client,
    effectiveRelease,
    entity,
    envDisplayName,
    envInfo?.resourceName,
    envName,
    hasChanges,
    isDeployMode,
    notification,
    onSaved,
    overrides,
    persist,
    traffic,
    trafficGuard,
  ]);

  const handleClear = useCallback(async () => {
    setClearing(true);
    setSaveError(null);
    try {
      if (hasActualOverrides) await persist({});
      if (traffic.own) await traffic.reset();
      notification.showSuccess(`Cleared overrides for ${envDisplayName}.`);
      setConfirmingClear(false);
      trafficGuard.pass(onSaved);
    } catch (err: unknown) {
      setSaveError(getErrorMessage(err));
      setConfirmingClear(false);
    } finally {
      setClearing(false);
    }
  }, [
    envDisplayName,
    hasActualOverrides,
    notification,
    onSaved,
    persist,
    traffic,
    trafficGuard,
  ]);

  const canPrimary = isDeployMode ? Boolean(effectiveRelease) : hasBinding;
  const trafficProblem = traffic.dirty ? traffic.problem : '';
  const primaryDisabled =
    saving ||
    clearing ||
    !canPrimary ||
    Boolean(trafficProblem) ||
    (!isDeployMode && !hasChanges && !traffic.dirty);
  let primaryLabel: string;
  if (isDeployMode) {
    primaryLabel = saving ? 'Deploying' : 'Deploy';
  } else {
    primaryLabel = saving ? 'Saving' : 'Save Overrides';
  }

  const headerActions = !loading && !loadError && (
    <Box className={classes.actionsRow}>
      {!isDeployMode && (
        <Tooltip
          title={
            traffic.error
              ? 'Couldn’t read this environment’s traffic, so its overrides can’t all be cleared yet. Reload to retry.'
              : ''
          }
        >
          <span>
            <Button
              onClick={() => setConfirmingClear(true)}
              disabled={
                saving ||
                clearing ||
                // Clearing waits for the traffic read, so it never reports
                // success while the environment's own traffic stays.
                traffic.loading ||
                Boolean(traffic.error) ||
                !(hasActualOverrides || traffic.own) ||
                !hasBinding
              }
            >
              {clearing ? 'Clearing' : 'Clear Overrides'}
            </Button>
          </span>
        </Tooltip>
      )}
      <Tooltip title={trafficProblem}>
        <span>
          <Button
            variant="contained"
            color="primary"
            onClick={() =>
              traffic.dirty ? setConfirming(true) : void handlePrimary()
            }
            disabled={primaryDisabled}
            startIcon={
              saving ? (
                <CircularProgress size={20} color="inherit" />
              ) : undefined
            }
          >
            {primaryLabel}
          </Button>
        </span>
      </Tooltip>
    </Box>
  );

  const subtitle = isDeployMode
    ? `Pin ${envDisplayName} to ${effectiveRelease} and set any ${envDisplayName}-specific overrides.`
    : `Set ${envDisplayName}-specific values for the ${typeDisplayName} environment configuration of this binding only.`;

  if (isForbiddenError(loadError)) {
    return (
      <ForbiddenState
        message="You do not have permission to configure overrides for this environment."
        minHeight="400px"
      />
    );
  }

  return (
    <DetailPageLayout
      title={`Configure Environment Overrides — ${envDisplayName}`}
      subtitle={subtitle}
      onBack={() => trafficGuard.leave(onBack)}
      actions={headerActions}
    >
      <NotificationBanner notification={notification.notification} />

      {loading && (
        <Box className={classes.loadingContainer}>
          <Skeleton variant="rect" width="100%" height={64} />
          <Skeleton variant="rect" width="100%" height={120} />
        </Box>
      )}

      {loadError && !loading && (
        <Box mb={2}>
          <Alert severity="error">
            Failed to load overrides: {getErrorMessage(loadError)}
          </Alert>
        </Box>
      )}

      {!loading && !loadError && !isDeployMode && !hasBinding && (
        <Box mb={2}>
          <Alert severity="info">
            No binding exists for {envDisplayName} yet. Deploy this endpoint to{' '}
            {envDisplayName} before configuring overrides.
          </Alert>
        </Box>
      )}

      {saveError && !loading && (
        <Box mb={2}>
          <Alert severity="error" onClose={() => setSaveError(null)}>
            {saveError}
          </Alert>
        </Box>
      )}

      {!loading && !loadError && (isDeployMode || hasBinding) && (
        <TabsIfTraffic
          show={showTraffic}
          activeTab={activeTab}
          onChange={tab =>
            setSearch(
              prev => {
                const next = new URLSearchParams(prev);
                next.set('tab', tab);
                return next;
              },
              { replace: true },
            )
          }
          configStatus={hasChanges ? 'info' : undefined}
          trafficStatus={trafficStatus(traffic)}
          traffic={
            <EnvironmentTrafficTab
              traffic={traffic}
              envLabel={envDisplayName}
              disabled={saving || clearing}
            />
          }
          className={classes.tabNav}
        >
          <Box className={classes.formCard}>
            {hasFields ? (
              <>
                <Typography className={classes.formHint}>
                  Only fields you fill in here are persisted on this binding.
                  Empty fields use the endpoint type&apos;s defaults.
                </Typography>
                <RjsfForm
                  schema={schema as any}
                  uiSchema={{}}
                  formData={overrides}
                  onChange={data => {
                    const next = (data.formData ?? {}) as Record<
                      string,
                      unknown
                    >;
                    setOverrides(next);
                    // RJSF normalizes formData on first render (e.g. injects
                    // schema defaults). Treat that normalized snapshot as
                    // the baseline so the user's actual edits surface as
                    // changes; without this, hasChanges flips true on mount.
                    if (!formInitializedRef.current) {
                      setInitialOverrides(next);
                      formInitializedRef.current = true;
                    }
                  }}
                  tagName="div"
                />
              </>
            ) : (
              <Typography className={classes.emptyState}>
                {typeDisplayName} declares no environment-configs schema, so
                per-env overrides are not applicable for this release.
              </Typography>
            )}
          </Box>
        </TabsIfTraffic>
      )}

      <Dialog
        open={confirming}
        onClose={() => !saving && setConfirming(false)}
        maxWidth="md"
        fullWidth
        aria-labelledby="confirm-env-traffic-title"
      >
        <DialogTitle id="confirm-env-traffic-title">
          Confirm Save Changes ({traffic.changes.length}{' '}
          {traffic.changes.length === 1 ? 'change' : 'changes'})
        </DialogTitle>
        <DialogContent dividers>
          <ChangesList
            sections={[
              { title: 'Traffic Overrides', changes: traffic.changes },
            ]}
            emptyMessage="No changes to save"
          />
          <Typography
            variant="body2"
            color="textSecondary"
            style={{ marginTop: 16 }}
          >
            This will trigger a redeployment of the{' '}
            <strong>{envDisplayName}</strong> environment.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirming(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="primary"
            disabled={saving}
            onClick={() => void handlePrimary()}
          >
            {saving ? 'Saving...' : 'Confirm Save'}
          </Button>
        </DialogActions>
      </Dialog>

      <ClearOverridesDialog
        open={confirmingClear}
        envLabel={envDisplayName}
        configFields={
          hasActualOverrides ? Object.keys(initialOverrides).length : 0
        }
        trafficBackends={traffic.env?.overrides.length ?? 0}
        clearing={clearing}
        onCancel={() => setConfirmingClear(false)}
        onConfirm={() => void handleClear()}
      />

      <UnsavedChangesDialog
        {...trafficGuard.dialog}
        changeCount={traffic.changes.length}
      />
    </DetailPageLayout>
  );
};
