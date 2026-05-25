import {
  lazy,
  memo,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Progress } from '@backstage/core-components';
import Box from '@material-ui/core/Box';
import CircularProgress from '@material-ui/core/CircularProgress';
import FormControl from '@material-ui/core/FormControl';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import IconButton from '@material-ui/core/IconButton';
import InputLabel from '@material-ui/core/InputLabel';
import MenuItem from '@material-ui/core/MenuItem';
import Select from '@material-ui/core/Select';
import Switch from '@material-ui/core/Switch';
import Tooltip from '@material-ui/core/Tooltip';
import Typography from '@material-ui/core/Typography';
import RefreshIcon from '@material-ui/icons/Refresh';
import { useEntity } from '@backstage/plugin-catalog-react';
import { useApi } from '@backstage/core-plugin-api';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { useTheme } from '@material-ui/core/styles';
import { openChoreoClientApiRef } from '../../api/OpenChoreoClientApi';
import { DiagramLayer, Project } from '@wso2/cell-diagram';
import { useChoreoTokens } from '@openchoreo/backstage-design-system';
import { EmptyState } from '@openchoreo/backstage-plugin-react';
import { useCellEnvironments } from './useCellEnvironments';

const CellView = lazy(() =>
  import('@wso2/cell-diagram').then(module => ({
    default: module.CellDiagram,
  })),
);

// The cell-diagram lib redraws and re-fits the canvas on every render
// (its internal effect deps on the entire props object). Memoize so it
// only renders when project/mode actually change — without this, every
// loading/refresh state flip in our parent causes a center/zoom race
// and the diagram lands in a random corner.
const MemoCellView = memo(CellView);

const TIME_RANGES: {
  label: string;
  value: string;
  ms: number;
}[] = [
  { label: 'Last 10 minutes', value: '10m', ms: 10 * 60 * 1000 },
  { label: 'Last 30 minutes', value: '30m', ms: 30 * 60 * 1000 },
  { label: 'Last 1 hour', value: '1h', ms: 60 * 60 * 1000 },
  { label: 'Last 24 hours', value: '24h', ms: 24 * 60 * 60 * 1000 },
  {
    label: 'Last 7 days',
    value: '7d',
    ms: 7 * 24 * 60 * 60 * 1000,
  },
  {
    label: 'Last 14 days',
    value: '14d',
    ms: 14 * 24 * 60 * 60 * 1000,
  },
];

function hasObservations(project: Project | undefined): boolean {
  if (!project?.components) return false;
  return project.components.some(component =>
    Object.values(component.services ?? {}).some(service => {
      const gateways = (service as any)?.deploymentMetadata?.gateways;
      return (
        (gateways?.internet?.observations?.length ?? 0) > 0 ||
        (gateways?.intranet?.observations?.length ?? 0) > 0
      );
    }),
  );
}

export const CellDiagram = () => {
  const { entity } = useEntity();
  const [cellDiagramData, setCellDiagramData] = useState<Project>();
  const [environment, setEnvironment] = useState<string>('');
  const [timeRange, setTimeRange] = useState<string>('1h');
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasFetchedOnce, setHasFetchedOnce] = useState(false);
  const [runtimeEnabled, setRuntimeEnabled] = useState(false);
  const client = useApi(openChoreoClientApiRef);
  const { mode } = useChoreoTokens();
  const theme = useTheme();
  const controlBg = theme.palette.background.paper;

  const projectName = entity.metadata.name;
  const namespaceName =
    entity.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE];
  const { environments, loading: environmentsLoading } = useCellEnvironments(
    projectName,
    namespaceName,
  );

  useEffect(() => {
    setEnvironment(environments[0]?.name ?? '');
  }, [environments]);

  const anyEnvHasRuntimeObservability = useMemo(
    () => environments.some(e => e.hasRuntimeObservability),
    [environments],
  );
  const selectedEnvHasRuntimeObservability =
    environments.find(e => e.name === environment)?.hasRuntimeObservability ??
    false;

  // Compute startTime/endTime/step from selected range. Recomputes when refreshNonce changes
  // so the refresh button advances "now" in the window.
  const range = useMemo(() => {
    const preset = TIME_RANGES.find(r => r.value === timeRange);
    if (!preset) return undefined;
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - preset.ms);
    return {
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRange, refreshNonce]);

  const prevRuntimeRef = useRef(runtimeEnabled);
  useEffect(() => {
    if (prevRuntimeRef.current !== runtimeEnabled) {
      prevRuntimeRef.current = runtimeEnabled;
      setCellDiagramData(undefined);
    }
  }, [runtimeEnabled]);

  const observabilityActive =
    runtimeEnabled && selectedEnvHasRuntimeObservability;
  // When observability is off, environment/time-range don't affect the result, so they must not be in
  // the useEffect's dependancies. Use a memoized key that only changes when relevant values change.
  // refreshNonce is included in the arch key so the Retry button can re-trigger the fetch even when
  // observability is off (in obs mode it already flows through `range`).
  const diagramFetchKey = observabilityActive
    ? `obs|${environment}|${range?.startTime ?? ''}|${range?.endTime ?? ''}`
    : `arch|${refreshNonce}`;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const fetchData = async () => {
      try {
        const data = await client.getCellDiagramInfo(entity, {
          environmentName: observabilityActive
            ? environment || undefined
            : undefined,
          startTime: observabilityActive ? range?.startTime : undefined,
          endTime: observabilityActive ? range?.endTime : undefined,
        });
        if (cancelled) return;
        setCellDiagramData(data as Project);
      } catch {
        // swallow — empty-state with Retry surfaces failure in the UI
      } finally {
        if (!cancelled) {
          setLoading(false);
          setHasFetchedOnce(true);
        }
      }
    };
    fetchData();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity, client, diagramFetchKey]);

  const showEmptyHint =
    runtimeEnabled &&
    selectedEnvHasRuntimeObservability &&
    hasFetchedOnce &&
    !loading &&
    cellDiagramData &&
    !hasObservations(cellDiagramData);

  const toggleDisabled =
    !environmentsLoading &&
    environments.length > 0 &&
    !anyEnvHasRuntimeObservability;

  useEffect(() => {
    if (toggleDisabled && runtimeEnabled) {
      setRuntimeEnabled(false);
    }
  }, [toggleDisabled, runtimeEnabled]);

  const toggleControl = (
    <FormControlLabel
      style={{ margin: 0 }}
      control={
        <Switch
          checked={runtimeEnabled}
          onChange={e => setRuntimeEnabled(e.target.checked)}
          color="primary"
          disabled={toggleDisabled || environmentsLoading}
          inputProps={{ 'aria-label': 'Runtime Observability' }}
        />
      }
      label={
        <Typography variant="body2" style={{ fontWeight: 500 }}>
          Runtime Observability
        </Typography>
      }
      labelPlacement="start"
    />
  );

  const hasNoComponents =
    !!cellDiagramData && (cellDiagramData.components?.length ?? 0) === 0;

  return (
    <Box
      sx={{
        height: 'calc(100vh - 146px)',
        width: 'calc(100% + 48px)',
        margin: '-24px -24px -24px -24px',
        bgcolor: 'background.default',
        color: 'text.primary',
        borderTop: 1,
        borderColor: 'divider',
        position: 'relative',
      }}
    >
      {!hasNoComponents && (
        <Box
          style={{
            position: 'absolute',
            top: 16,
            left: 24,
            right: 24,
            zIndex: 10,
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 12,
          }}
        >
          {toggleDisabled ? (
            <Tooltip title="Observability is unavailable in all environments. Configure the Cilium module to enable observability.">
              <span>{toggleControl}</span>
            </Tooltip>
          ) : (
            toggleControl
          )}

          {runtimeEnabled && (
            <>
              <FormControl
                variant="outlined"
                size="small"
                style={{
                  minWidth: 200,
                  backgroundColor: controlBg,
                  borderRadius: 4,
                }}
              >
                <InputLabel id="cell-diagram-env-label">Environment</InputLabel>
                <Select
                  labelId="cell-diagram-env-label"
                  value={environment}
                  label="Environment"
                  onChange={e => setEnvironment(e.target.value as string)}
                  disabled={environments.length === 0}
                >
                  {environments.length === 0 && (
                    <MenuItem value="" disabled>
                      No environments
                    </MenuItem>
                  )}
                  {environments.map(env => (
                    <MenuItem key={env.name} value={env.name}>
                      {env.displayName ?? env.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl
                variant="outlined"
                size="small"
                style={{
                  minWidth: 180,
                  backgroundColor: controlBg,
                  borderRadius: 4,
                }}
              >
                <InputLabel id="cell-diagram-range-label">
                  Time range
                </InputLabel>
                <Select
                  labelId="cell-diagram-range-label"
                  value={timeRange}
                  label="Time range"
                  onChange={e => setTimeRange(e.target.value as string)}
                >
                  {TIME_RANGES.map(r => (
                    <MenuItem key={r.value} value={r.value}>
                      {r.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Tooltip title="Refresh">
                <span>
                  <IconButton
                    size="small"
                    onClick={() => setRefreshNonce(n => n + 1)}
                    disabled={loading || environmentsLoading}
                    style={{
                      backgroundColor: controlBg,
                      borderRadius: 4,
                    }}
                  >
                    {loading ? (
                      <CircularProgress size={18} />
                    ) : (
                      <RefreshIcon fontSize="small" />
                    )}
                  </IconButton>
                </span>
              </Tooltip>

              {environment &&
                !selectedEnvHasRuntimeObservability &&
                !environmentsLoading && (
                  <Typography
                    variant="body2"
                    style={{
                      padding: '6px 12px',
                      backgroundColor: theme.palette.warning.light,
                      color: theme.palette.warning.contrastText,
                      borderRadius: 4,
                    }}
                  >
                    Observability is unavailable in the{' '}
                    <strong>{environment}</strong> environment. Configure the
                    Cilium module to enable observability.
                  </Typography>
                )}

              {showEmptyHint && (
                <Typography
                  variant="caption"
                  style={{
                    padding: '6px 12px',
                    backgroundColor: controlBg,
                    borderRadius: 4,
                    opacity: 0.8,
                  }}
                >
                  No HTTP traffic in selected range
                </Typography>
              )}
            </>
          )}
        </Box>
      )}

      {runtimeEnabled && !hasNoComponents && (
        <Typography
          variant="caption"
          style={{
            position: 'absolute',
            bottom: 16,
            right: 16,
            zIndex: 10,
            padding: '4px 10px',
            backgroundColor: controlBg,
            borderRadius: 4,
            opacity: 0.6,
          }}
        >
          Runtime visibility is limited to HTTP traffic. TCP/UDP traffic is not
          observed.
        </Typography>
      )}
      {cellDiagramData && (cellDiagramData.components?.length ?? 0) > 0 && (
        <Suspense fallback={<Progress />}>
          {(() => {
            const targetLayer =
              runtimeEnabled && hasObservations(cellDiagramData)
                ? DiagramLayer.OBSERVABILITY
                : DiagramLayer.ARCHITECTURE;
            return (
              <MemoCellView
                key={targetLayer}
                project={cellDiagramData}
                mode={mode}
                defaultDiagramLayer={targetLayer}
              />
            );
          })()}
        </Suspense>
      )}
      {cellDiagramData && (cellDiagramData.components?.length ?? 0) === 0 && (
        <Box
          data-testid="cell-diagram-no-components"
          style={{
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <EmptyState
            title="No components yet"
            description="This project does not have any components. Create one to see it on the cell diagram."
          />
        </Box>
      )}
      {!cellDiagramData && loading && <Progress />}
      {!cellDiagramData && !loading && (
        <Box
          style={{
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <EmptyState
            title="Failed to load cell diagram"
            description="Could not load project information. Try again in a moment."
            action={{
              label: 'Retry',
              onClick: () => setRefreshNonce(n => n + 1),
            }}
          />
        </Box>
      )}
    </Box>
  );
};
