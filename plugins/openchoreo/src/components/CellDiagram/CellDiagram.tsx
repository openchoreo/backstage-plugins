import { lazy, memo, Suspense, useEffect, useMemo, useState } from 'react';
import { Progress } from '@backstage/core-components';
import Box from '@material-ui/core/Box';
import CircularProgress from '@material-ui/core/CircularProgress';
import FormControl from '@material-ui/core/FormControl';
import IconButton from '@material-ui/core/IconButton';
import InputLabel from '@material-ui/core/InputLabel';
import MenuItem from '@material-ui/core/MenuItem';
import Select from '@material-ui/core/Select';
import Tooltip from '@material-ui/core/Tooltip';
import Typography from '@material-ui/core/Typography';
import RefreshIcon from '@material-ui/icons/Refresh';
import { useEntity } from '@backstage/plugin-catalog-react';
import { useApi } from '@backstage/core-plugin-api';
import { useTheme } from '@material-ui/core/styles';
import { openChoreoClientApiRef } from '../../api/OpenChoreoClientApi';
import { Project } from '@wso2/cell-diagram';
import { useChoreoTokens } from '@openchoreo/backstage-design-system';

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
  step: string;
}[] = [
  { label: 'Last 10 minutes', value: '10m', ms: 10 * 60 * 1000, step: '15s' },
  { label: 'Last 30 minutes', value: '30m', ms: 30 * 60 * 1000, step: '30s' },
  { label: 'Last 1 hour', value: '1h', ms: 60 * 60 * 1000, step: '1m' },
  { label: 'Last 24 hours', value: '24h', ms: 24 * 60 * 60 * 1000, step: '5m' },
  {
    label: 'Last 7 days',
    value: '7d',
    ms: 7 * 24 * 60 * 60 * 1000,
    step: '30m',
  },
  {
    label: 'Last 14 days',
    value: '14d',
    ms: 14 * 24 * 60 * 60 * 1000,
    step: '1h',
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
  const [environments, setEnvironments] = useState<string[]>([]);
  const [environment, setEnvironment] = useState<string>('');
  const [environmentsLoaded, setEnvironmentsLoaded] = useState(false);
  const [timeRange, setTimeRange] = useState<string>('1h');
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasFetchedOnce, setHasFetchedOnce] = useState(false);
  const client = useApi(openChoreoClientApiRef);
  const { mode } = useChoreoTokens();
  const theme = useTheme();
  const controlBg = theme.palette.background.paper;

  // Load environments once per entity
  useEffect(() => {
    let cancelled = false;
    client.getCellDiagramEnvironments(entity).then(envs => {
      if (cancelled) return;
      setEnvironments(envs);
      setEnvironment(envs[0] ?? '');
      setEnvironmentsLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [entity, client]);

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
      step: preset.step,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRange, refreshNonce]);

  useEffect(() => {
    if (!environmentsLoaded) return undefined;
    let cancelled = false;
    setLoading(true);
    const fetchData = async () => {
      try {
        const data = await client.getCellDiagramInfo(entity, {
          environmentName: environment || undefined,
          startTime: range?.startTime,
          endTime: range?.endTime,
          step: range?.step,
        });
        if (cancelled) return;
        setCellDiagramData(data as Project);
        setHasFetchedOnce(true);
      } catch {
        // swallow — diagram falls back to undefined
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchData();
    return () => {
      cancelled = true;
    };
  }, [entity, client, environment, range, environmentsLoaded]);

  const showEmptyHint =
    hasFetchedOnce &&
    !loading &&
    cellDiagramData &&
    !hasObservations(cellDiagramData);

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
      <Box
        style={{
          position: 'absolute',
          top: 16,
          left: 24,
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <FormControl
          variant="outlined"
          size="small"
          style={{
            minWidth: 200,
            marginRight: 12,
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
              <MenuItem key={env} value={env}>
                {env}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl
          variant="outlined"
          size="small"
          style={{
            minWidth: 180,
            marginRight: 8,
            backgroundColor: controlBg,
            borderRadius: 4,
          }}
        >
          <InputLabel id="cell-diagram-range-label">Time range</InputLabel>
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
              disabled={loading || !environmentsLoaded}
              style={{
                backgroundColor: controlBg,
                borderRadius: 4,
                marginRight: 12,
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
      </Box>

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
      {cellDiagramData ? (
        <Suspense fallback={<Progress />}>
          <MemoCellView project={cellDiagramData} mode={mode} />
        </Suspense>
      ) : (
        <Progress />
      )}
    </Box>
  );
};
