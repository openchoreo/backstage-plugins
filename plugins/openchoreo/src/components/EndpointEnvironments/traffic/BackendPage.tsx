import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  InputAdornment,
  MenuItem,
  TextField,
  Tooltip,
  Typography,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import {
  Alert,
  Skeleton,
  ToggleButton,
  ToggleButtonGroup,
} from '@material-ui/lab';
import AddIcon from '@material-ui/icons/Add';
import CloseIcon from '@material-ui/icons/Close';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useApi } from '@backstage/core-plugin-api';
import { useAsyncEntity, useEntity } from '@backstage/plugin-catalog-react';
import {
  DetailPageLayout,
  UnsavedChangesDialog,
} from '@openchoreo/backstage-plugin-react';
import {
  CHOREO_ANNOTATIONS,
  capabilityProblems,
  isMirror,
  matchProblem,
  splitOf,
  splitProblem,
  trafficOf,
  uniqueBackendName,
  type BackendTraffic,
  type EndpointBackendMatch,
  type EndpointCapability,
  type EndpointTrafficBackend,
} from '@openchoreo/backstage-plugin-common';
import { openChoreoClientApiRef } from '../../../api/OpenChoreoClientApi';
import { useProjectWorkloadEndpoints } from '../../../scaffolder/EndpointBackendsField/useProjectWorkloadEndpoints';
import { getErrorMessage, isForbiddenError } from '../../../utils/errorUtils';
import { useBackendColors } from './TrafficSplitBar';
import { RequestFlow } from './RequestFlow';
import { TrafficCard, TrafficSection } from './trafficLayout';
import { useEndpointTraffic } from './useEndpointTraffic';
import { useUnsavedGuard } from './useUnsavedGuard';
import { draftSplit, ShareFields, type ShareDraft } from './ShareFields';
import type { EndpointBackendChange } from '../useAwaitEndpointRelease';

type Kind = BackendTraffic['kind'];

/** One condition row: a header, a cookie or the path. */
export interface ConditionRow {
  type: 'header' | 'cookie' | 'path';
  name: string;
  compare: 'Exact' | 'RegularExpression' | 'PathPrefix';
  value: string;
}

const KIND_LABEL: Record<Kind, string> = {
  weight: 'By weight',
  match: 'By condition',
  mirror: 'Mirror',
};

const KIND_HELP: Record<Kind, string> = {
  weight:
    'It gets a share of the requests no condition takes. A new backend starts at 0%, so nothing moves until you give it a share below or in one environment.',
  match:
    'Every request that meets all the conditions reaches it, such as testers or one user group. It can also have a share of the rest below.',
  mirror:
    'It gets a copy of this share of requests. Its answers are dropped, so callers never see them.',
};

/** Why an EndpointType can't render a choice, or ''. */
function kindUnsupported(
  kind: Kind,
  capabilities: EndpointCapability[] | undefined,
  typeName: string,
): string {
  if (!capabilities) return '';
  if (kind === 'match' && !capabilities.includes('Match')) {
    return `The ${typeName} EndpointType can’t route requests by condition.`;
  }
  if (kind === 'mirror' && !capabilities.includes('Mirror')) {
    return `The ${typeName} EndpointType can’t copy requests.`;
  }
  return '';
}

/**
 * Condition rows to a match, dropping untouched rows. A row with a name but
 * no value stays, so its problem shows instead of the condition vanishing.
 */
export function toMatch(rows: ConditionRow[]): EndpointBackendMatch {
  const filled = rows.filter(
    r => r.value.trim() !== '' || (r.type !== 'path' && r.name.trim() !== ''),
  );
  const path = filled.find(r => r.type === 'path');
  const headers = filled.filter(r => r.type === 'header');
  const cookies = filled.filter(r => r.type === 'cookie');
  return {
    ...(path && {
      path: {
        type: path.compare === 'Exact' ? 'Exact' : 'PathPrefix',
        value: path.value.trim(),
      },
    }),
    ...(headers.length > 0 && {
      headers: headers.map(h => ({
        name: h.name.trim(),
        type: h.compare === 'RegularExpression' ? 'RegularExpression' : 'Exact',
        value: h.value,
      })),
    }),
    ...(cookies.length > 0 && {
      cookies: cookies.map(c => ({ name: c.name.trim(), value: c.value })),
    }),
  };
}

/** A match back to condition rows. */
export function toRows(
  match: EndpointBackendMatch | undefined,
): ConditionRow[] {
  if (!match)
    return [{ type: 'header', name: '', compare: 'Exact', value: '' }];
  return [
    ...(match.headers ?? []).map(h => ({
      type: 'header' as const,
      name: h.name,
      compare: h.type ?? 'Exact',
      value: h.value,
    })),
    ...(match.cookies ?? []).map(c => ({
      type: 'cookie' as const,
      name: c.name,
      compare: 'Exact' as const,
      value: c.value,
    })),
    ...(match.path
      ? [
          {
            type: 'path' as const,
            name: '',
            compare:
              match.path.type === 'Exact'
                ? ('Exact' as const)
                : ('PathPrefix' as const),
            value: match.path.value,
          },
        ]
      : []),
  ];
}

const optionKey = (component: string, endpoint: string, releaseLine?: string) =>
  `${component}@${releaseLine ?? ''}/${endpoint}`;

const useStyles = makeStyles(theme => ({
  page: { display: 'flex', flexDirection: 'column', gap: theme.spacing(2) },
  condition: {
    display: 'grid',
    gridTemplateColumns: '130px minmax(0, 1fr) 170px minmax(0, 1fr) 40px',
    gap: theme.spacing(1.5),
    alignItems: 'center',
    [theme.breakpoints.down('sm')]: {
      gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
    },
  },
  copy: { width: 160 },
  segmented: { alignSelf: 'flex-start' },
}));

/** Condition rows: header, cookie or path, each matched exactly or otherwise. */
export const ConditionFields = ({
  rows,
  onChange,
  regex,
  disabled,
}: {
  rows: ConditionRow[];
  onChange: (rows: ConditionRow[]) => void;
  regex: boolean;
  disabled?: boolean;
}) => {
  const classes = useStyles();
  const set = (i: number, patch: Partial<ConditionRow>) =>
    onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const hasPath = rows.some(r => r.type === 'path');
  return (
    <>
      {rows.map((r, i) => (
        <Box key={i} className={classes.condition}>
          <TextField
            select
            variant="outlined"
            size="small"
            label="Type"
            value={r.type}
            disabled={disabled}
            onChange={e => {
              const type = e.target.value as ConditionRow['type'];
              set(i, {
                type,
                compare: type === 'path' ? 'PathPrefix' : 'Exact',
                ...(type === 'path' && { name: '' }),
              });
            }}
            inputProps={{ 'aria-label': `Condition ${i + 1} type` }}
          >
            <MenuItem value="header">Header</MenuItem>
            <MenuItem value="cookie" disabled={!regex && r.type !== 'cookie'}>
              {regex
                ? 'Cookie'
                : 'Cookie (the EndpointType can’t match cookies: it needs RegularExpression)'}
            </MenuItem>
            <MenuItem value="path" disabled={hasPath && r.type !== 'path'}>
              Path
            </MenuItem>
          </TextField>
          {r.type === 'path' ? (
            <span />
          ) : (
            <TextField
              variant="outlined"
              size="small"
              label="Name"
              value={r.name}
              disabled={disabled}
              placeholder={r.type === 'header' ? 'x-preview' : 'group'}
              onChange={e => set(i, { name: e.target.value })}
              inputProps={{ 'aria-label': `Condition ${i + 1} name` }}
            />
          )}
          <TextField
            select
            variant="outlined"
            size="small"
            label="Compare"
            value={r.compare}
            disabled={disabled || r.type === 'cookie'}
            onChange={e =>
              set(i, { compare: e.target.value as ConditionRow['compare'] })
            }
            inputProps={{ 'aria-label': `Condition ${i + 1} compare` }}
          >
            {r.type === 'path'
              ? [
                  <MenuItem key="p" value="PathPrefix">
                    Starts with
                  </MenuItem>,
                  <MenuItem key="e" value="Exact">
                    Exact
                  </MenuItem>,
                ]
              : [
                  <MenuItem key="e" value="Exact">
                    Exact
                  </MenuItem>,
                  ...(r.type === 'header' && regex
                    ? [
                        <MenuItem key="r" value="RegularExpression">
                          Regular expression
                        </MenuItem>,
                      ]
                    : []),
                ]}
          </TextField>
          <TextField
            variant="outlined"
            size="small"
            label="Value"
            value={r.value}
            disabled={disabled}
            placeholder={r.type === 'path' ? '/next' : 'true'}
            onChange={e => set(i, { value: e.target.value })}
            inputProps={{ 'aria-label': `Condition ${i + 1} value` }}
          />
          <IconButton
            size="small"
            aria-label={`Remove condition ${i + 1}`}
            disabled={disabled || rows.length === 1}
            onClick={() => onChange(rows.filter((_, j) => j !== i))}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      ))}
      <Box>
        <Button
          size="small"
          color="primary"
          startIcon={<AddIcon />}
          disabled={disabled}
          onClick={() =>
            onChange([
              ...rows,
              { type: 'header', name: '', compare: 'Exact', value: '' },
            ])
          }
        >
          Add condition
        </Button>
      </Box>
    </>
  );
};

/**
 * Adds a backend to the Endpoint, or changes how one gets traffic: by
 * weight, by condition or as a mirror, and the default split. A backend by
 * weight starts at 0%, so saving never moves traffic until it gets a share.
 * One save cuts one release.
 */
export const BackendPage = ({
  editing,
  focusShare,
  onBack,
}: {
  editing?: string;
  /** Focus this backend's share field. */
  focusShare?: boolean;
  /** Leaves the page, with the saved change when there is one. */
  onBack: (change?: EndpointBackendChange, baseline?: string) => void;
}) => {
  const classes = useStyles();
  const { entity } = useEntity();
  const { refresh } = useAsyncEntity();
  const client = useApi(openChoreoClientApiRef);
  const { info, loading, error: loadError } = useEndpointTraffic(entity);
  const project = entity.metadata.annotations?.[CHOREO_ANNOTATIONS.PROJECT];
  const typeName =
    entity.metadata.annotations?.[CHOREO_ANNOTATIONS.ENDPOINTTYPE] ?? 'this';
  const managedBy = (entity.spec as { managedByComponent?: string } | undefined)
    ?.managedByComponent;
  const existing = editing
    ? info?.backends.find(b => b.name === editing)
    : undefined;

  const workloads = useProjectWorkloadEndpoints(
    editing ? undefined : entity.metadata.namespace,
    project,
    { includeReleaseLines: true },
  );
  const available = useMemo(() => {
    const taken = new Set(
      (info?.backends ?? []).map(b =>
        optionKey(b.componentName, b.endpoint, b.releaseLine),
      ),
    );
    return workloads.options.filter(
      o => !taken.has(optionKey(o.component, o.endpoint, o.releaseLine)),
    );
  }, [workloads.options, info]);

  const [selected, setSelected] = useState('');
  const [kind, setKind] = useState<Kind>('weight');
  const [rows, setRows] = useState<ConditionRow[]>(toRows(undefined));
  const [copy, setCopy] = useState('10');
  const [shareDraft, setShareDraft] = useState<ShareDraft>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!existing) return;
    const traffic = trafficOf(existing);
    setKind(traffic.kind);
    if (traffic.kind === 'match') setRows(toRows(traffic.match));
    if (traffic.kind === 'mirror') setCopy(String(traffic.percent));
  }, [existing]);

  const option = available.find(
    o => optionKey(o.component, o.endpoint, o.releaseLine) === selected,
  );
  const target = existing
    ? {
        componentName: existing.componentName,
        endpoint: existing.endpoint,
        releaseLine: existing.releaseLine,
      }
    : option && {
        componentName: option.component,
        endpoint: option.endpoint,
        releaseLine: option.releaseLine,
      };
  const backends = info?.backends ?? [];
  const name =
    existing?.name ?? (target ? uniqueBackendName(backends, target) : '');
  const match = toMatch(rows);
  const copyValue = Number(copy);
  const mirrorPercentOff =
    info?.capabilities && !info.capabilities.includes('MirrorPercent');

  let problem = '';
  if (!target) problem = 'Pick a workload endpoint';
  else if (kind === 'match') problem = matchProblem(backends, name, match);
  else if (
    kind === 'mirror' &&
    (!Number.isInteger(copyValue) || copyValue < 0 || copyValue > 100)
  ) {
    problem = 'Give the copy as a whole percentage from 0 to 100';
  }
  const unsupported = kindUnsupported(kind, info?.capabilities, typeName);
  if (unsupported) problem = unsupported;
  if (!problem && kind === 'match') {
    problem =
      capabilityProblems(
        [
          {
            ...(target ?? { componentName: '', endpoint: '' }),
            name,
            weight: 0,
            match,
          },
        ],
        info?.capabilities,
      )[0] ?? '';
  }

  // A type without MirrorPercent copies every request or none.
  const allOrNone = copyValue === 0 ? 0 : 100;
  let traffic: BackendTraffic = { kind: 'weight' };
  if (kind === 'match') traffic = { kind, match };
  if (kind === 'mirror') {
    traffic = { kind, percent: mirrorPercentOff ? allOrNone : copyValue };
  }

  // The default split before and after: this backend joins the shares
  // unless it is a mirror; a new one starts at 0%.
  const initialShares = useMemo(() => splitOf(info?.backends ?? []), [info]);
  const changed: EndpointTrafficBackend | undefined = target && {
    ...target,
    name,
    weight: 0,
    ...(kind === 'match' && { match }),
    ...(kind === 'mirror' && {
      mirror: { percent: traffic.kind === 'mirror' ? traffic.percent : 0 },
    }),
  };
  const order = backends.map(b => b.name);
  const listed = changed
    ? [...backends.filter(b => b.name !== name), changed].sort((a, b) => {
        const ia = order.indexOf(a.name);
        const ib = order.indexOf(b.name);
        return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
      })
    : backends;
  const sharedAfter = listed.filter(b => !isMirror(b));
  // A backend's share before this change: 0 for one joining the shares,
  // a former mirror included.
  const baseShare = (n: string) =>
    backends.some(b => b.name === n && !isMirror(b))
      ? initialShares[n] ?? 0
      : 0;
  const shareValue = (b: EndpointTrafficBackend) =>
    shareDraft[b.name] ?? String(baseShare(b.name));
  const shareFields: ShareDraft = Object.fromEntries(
    sharedAfter.map(b => [b.name, shareValue(b)]),
  );
  const split = draftSplit(shareFields);
  const after: EndpointTrafficBackend[] = listed.map(b =>
    isMirror(b) ? b : { ...b, weight: split[b.name] || 0 },
  );
  // Sent only when someone changed an allocation, or a backend that had a
  // share left the shares; a backend joining at 0% keeps the saved weights.
  const sharesChanged =
    sharedAfter.some(b => split[b.name] !== baseShare(b.name)) ||
    backends.some(
      b => !isMirror(b) && !sharedAfter.some(x => x.name === b.name),
    );
  if (!problem && target && sharedAfter.length > 0) {
    problem = splitProblem(sharedAfter, split);
  }

  const initialKind = existing ? trafficOf(existing).kind : 'weight';
  const dirty = existing
    ? kind !== initialKind ||
      (kind === 'match' &&
        JSON.stringify(match) !== JSON.stringify(existing.match ?? {})) ||
      (kind === 'mirror' && copyValue !== existing.mirror?.percent) ||
      sharesChanged
    : Boolean(selected);
  const guard = useUnsavedGuard(dirty && !saving);
  const colors = useBackendColors(after);
  const moves =
    !existing && managedBy && target && target.componentName !== managedBy;

  const save = async () => {
    if (!target) return;
    setSaving(true);
    setError(null);
    try {
      // The release before saving: the Deploy tab waits until it moves on.
      const baseline = await client
        .fetchEndpointEnvironmentInfo(entity)
        .then(envs => envs[0]?.latestRelease)
        .catch(() => undefined);
      const { backendName } = await client.saveEndpointBackend(entity, {
        ...target,
        traffic,
        ...(existing && { editing: existing.name }),
        ...(sharesChanged && { split }),
      });
      refresh?.();
      // Waiting for the backend to be listed and a new release cut covers
      // an edit too: the backend is listed already, so only the release counts.
      guard.pass(() => onBack({ kind: 'add', backendName }, baseline));
    } catch (e: unknown) {
      setError(
        isForbiddenError(e)
          ? 'You do not have permission to change this Endpoint. Contact your administrator.'
          : getErrorMessage(e),
      );
    } finally {
      setSaving(false);
    }
  };

  const title = existing ? `Edit ${existing.name}` : 'Add Backend';
  const subtitle = existing
    ? 'Change how this backend gets traffic. Saving cuts a release.'
    : 'Route traffic to another workload endpoint. Saving cuts a release.';

  if (loading) {
    return (
      <DetailPageLayout
        title={title}
        subtitle={subtitle}
        onBack={() => onBack()}
      >
        <Skeleton variant="rect" height={320} />
      </DetailPageLayout>
    );
  }
  if (loadError || (editing && !existing)) {
    return (
      <DetailPageLayout
        title={title}
        subtitle={subtitle}
        onBack={() => onBack()}
      >
        <Alert severity="error">
          {loadError
            ? `Could not load the Endpoint: ${getErrorMessage(loadError)}`
            : `${editing} is not a backend of this Endpoint.`}
        </Alert>
      </DetailPageLayout>
    );
  }

  const actions = (
    <Tooltip title={problem || (dirty ? '' : 'Nothing to save')}>
      <span>
        <Button
          variant="contained"
          color="primary"
          disabled={Boolean(problem) || !dirty || saving}
          onClick={() => void save()}
          startIcon={
            saving ? <CircularProgress size={20} color="inherit" /> : undefined
          }
        >
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </span>
    </Tooltip>
  );

  let picker = (
    <TextField
      id="traffic-backend-workload-endpoint"
      select
      fullWidth
      variant="outlined"
      label="Workload endpoint"
      value={selected}
      onChange={e => setSelected(e.target.value as string)}
      disabled={saving}
      helperText={
        available.length === 0
          ? `No other workload endpoint in project ${project} to route to.`
          : 'A component’s main line or one of its release lines.'
      }
    >
      {available.map(o => (
        <MenuItem
          key={optionKey(o.component, o.endpoint, o.releaseLine)}
          value={optionKey(o.component, o.endpoint, o.releaseLine)}
        >
          {o.releaseLine
            ? `${o.component} @ ${o.releaseLine} / ${o.endpoint}`
            : `${o.component} / ${o.endpoint}`}
        </MenuItem>
      ))}
    </TextField>
  );
  if (existing) {
    picker = (
      <TextField
        fullWidth
        variant="outlined"
        label="Workload endpoint"
        value={`${existing.componentName}${
          existing.releaseLine ? ` @ ${existing.releaseLine}` : ''
        } / ${existing.endpoint}`}
        disabled
      />
    );
  } else if (workloads.loading) {
    picker = <CircularProgress size={24} />;
  } else if (workloads.error) {
    picker = (
      <Alert severity="error">
        Could not load the project’s workload endpoints:{' '}
        {getErrorMessage(workloads.error)}
      </Alert>
    );
  }

  return (
    <DetailPageLayout
      title={title}
      subtitle={subtitle}
      onBack={() => guard.leave(() => onBack())}
      actions={actions}
    >
      <Box className={classes.page}>
        {error && (
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        <TrafficCard title={existing ? existing.name : 'New backend'}>
          <TrafficSection
            heading="Backend"
            helper="The workload endpoint that serves these requests."
          >
            {picker}
            {name && (
              <Typography variant="body2" color="textSecondary">
                Backend name: <strong>{name}</strong>
              </Typography>
            )}
            {moves && (
              <Alert severity="info">
                {entity.metadata.title ?? entity.metadata.name} is managed by{' '}
                {managedBy}. Saving moves it to project {project}: it is listed
                in the project’s contents and deployed on its own, not with{' '}
                {managedBy}.
              </Alert>
            )}
          </TrafficSection>

          <TrafficSection
            heading="How it gets traffic"
            helper="You can change this later."
          >
            <ToggleButtonGroup
              className={classes.segmented}
              exclusive
              size="small"
              value={kind}
              onChange={(_e, v: Kind | null) => v && setKind(v)}
              aria-label="How it gets traffic"
            >
              {(['weight', 'match', 'mirror'] as Kind[]).map(k => {
                const off = kindUnsupported(k, info?.capabilities, typeName);
                return (
                  <ToggleButton
                    key={k}
                    value={k}
                    disabled={Boolean(off)}
                    aria-label={KIND_LABEL[k]}
                  >
                    <Tooltip title={off}>
                      <span>{KIND_LABEL[k]}</span>
                    </Tooltip>
                  </ToggleButton>
                );
              })}
            </ToggleButtonGroup>
            <Typography variant="body2" color="textSecondary">
              {KIND_HELP[kind]}
            </Typography>
            {kind === 'match' && (
              <ConditionFields
                rows={rows}
                onChange={setRows}
                regex={
                  !info?.capabilities ||
                  info.capabilities.includes('RegularExpression')
                }
                disabled={saving}
              />
            )}
            {kind === 'mirror' && (
              <TextField
                id="traffic-backend-copy"
                className={classes.copy}
                variant="outlined"
                size="small"
                label="Copy"
                {...(mirrorPercentOff
                  ? { select: true, value: String(allOrNone) }
                  : { type: 'number', value: copy })}
                disabled={saving}
                helperText={
                  mirrorPercentOff
                    ? `The ${typeName} EndpointType copies every request or none.`
                    : undefined
                }
                onChange={e => setCopy(e.target.value)}
                inputProps={{ min: 0, max: 100, step: 1 }}
                InputProps={
                  mirrorPercentOff
                    ? undefined
                    : {
                        endAdornment: (
                          <InputAdornment position="end">%</InputAdornment>
                        ),
                      }
                }
              >
                {mirrorPercentOff && <MenuItem value="0">None</MenuItem>}
                {mirrorPercentOff && <MenuItem value="100">All</MenuItem>}
              </TextField>
            )}
            {problem && target && (
              <Typography variant="body2" color="error">
                {problem}
              </Typography>
            )}
          </TrafficSection>

          {target && sharedAfter.length > 0 && (
            <TrafficSection
              heading="Shares"
              helper="The default split, of the requests no condition takes. They add up to 100%; each environment gets it with the release unless it has its own split."
            >
              <ShareFields
                backends={sharedAfter}
                draft={shareFields}
                initial={initialShares}
                onChange={d => setShareDraft(prev => ({ ...prev, ...d }))}
                colors={colors}
                highlight={name}
                focus={focusShare ? name : undefined}
                disabled={saving}
              />
            </TrafficSection>
          )}
          <TrafficSection
            heading="How requests flow"
            helper="The default split once this release reaches an environment. Environments with their own split keep it."
          >
            <RequestFlow backends={after} colors={colors} />
          </TrafficSection>
        </TrafficCard>
      </Box>
      <UnsavedChangesDialog {...guard.dialog} changeCount={1} />
    </DetailPageLayout>
  );
};

/** Routing wrapper: `add-backend` adds a backend, `backend/:name` edits one. */
export const BackendPageRoute = () => {
  const navigate = useNavigate();
  const { name: editing } = useParams<{ name: string }>();
  const [search] = useSearchParams();
  return (
    <BackendPage
      editing={editing}
      focusShare={search.get('focus') === 'share'}
      onBack={(change, baseline) =>
        navigate(editing ? '../..' : '..', {
          relative: 'path',
          // The Deploy tab waits for the release this change cuts.
          state: change ? { backendChange: change, baseline } : undefined,
        })
      }
    />
  );
};
