import { useCallback, useEffect, useMemo, useState } from 'react';
import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import Chip from '@material-ui/core/Chip';
import IconButton from '@material-ui/core/IconButton';
import InputAdornment from '@material-ui/core/InputAdornment';
import MenuItem from '@material-ui/core/MenuItem';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableHead from '@material-ui/core/TableHead';
import TablePagination from '@material-ui/core/TablePagination';
import TableRow from '@material-ui/core/TableRow';
import TextField from '@material-ui/core/TextField';
import Tooltip from '@material-ui/core/Tooltip';
import Typography from '@material-ui/core/Typography';
import AddIcon from '@material-ui/icons/Add';
import ClearIcon from '@material-ui/icons/Clear';
import DeleteOutlineIcon from '@material-ui/icons/DeleteOutline';
import EditOutlinedIcon from '@material-ui/icons/EditOutlined';
import PauseCircleOutlineIcon from '@material-ui/icons/PauseCircleOutline';
import PlayCircleOutlineIcon from '@material-ui/icons/PlayCircleOutline';
import RefreshIcon from '@material-ui/icons/Refresh';
import SearchIcon from '@material-ui/icons/Search';
import WarningIcon from '@material-ui/icons/ReportProblemOutlined';
import { makeStyles, Theme } from '@material-ui/core/styles';
import Alert from '@material-ui/lab/Alert';
import {
  InfoCard,
  Progress,
  ResponseErrorPanel,
} from '@backstage/core-components';
import { useApi } from '@backstage/core-plugin-api';
import { toastApiRef } from '@backstage/frontend-plugin-api';
import { dynamicChecksApiRef } from '../../api/DynamicChecksApi';
import type { DynamicCheck, FactSchema } from '../../api/types';
import { CHECK_TIERS } from '../../tierPalette';
import { TierChip } from '../TierChip';
import { useTierLabel } from '../useTierLabel';
import {
  NOT_ALLOWED_TOOLTIP,
  useCheckPermissions,
} from '../useCheckPermissions';
import { CheckFormDialog } from './CheckFormDialog';
import { CheckStatusChip } from './CheckStatusChip';
import { DeleteCheckDialog } from './DeleteCheckDialog';

const PAGE_SIZES = [10, 25, 50];

const TOAST_TIMEOUT_MS = 5000;

const useStyles = makeStyles((theme: Theme) => ({
  toolbar: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    marginBottom: theme.spacing(2),
  },
  search: {
    width: 300,
  },
  filter: {
    minWidth: 160,
  },
  actions: {
    whiteSpace: 'nowrap',
  },
  editableRow: {
    cursor: 'pointer',
  },
  status: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
  },
  problem: {
    color: theme.palette.warning.main,
  },
  deleteButton: {
    '&:hover': {
      color: theme.palette.error.main,
    },
  },
}));

function publishTooltip(published: boolean) {
  return published
    ? 'Unpublish: move back to draft and stop evaluating it'
    : 'Publish: include it in scores';
}

interface CheckPolicyTableProps {
  /**
   * When provided, "New check" calls this instead of opening the built-in
   * CheckFormDialog — lets a host app (which may want its own full-page
   * editor, e.g. matching its own house layout for create/edit flows)
   * take over navigation entirely. factSchemas/existingCategories are
   * passed along so the host doesn't have to re-fetch what this table
   * already loaded. Falls back to the built-in modal when omitted, so this
   * component stays usable standalone.
   */
  onNewCheck?: (
    factSchemas: FactSchema[],
    existingCategories: string[],
  ) => void;
  onEditCheck?: (
    check: DynamicCheck,
    factSchemas: FactSchema[],
    existingCategories: string[],
  ) => void;
  /**
   * Called after a check is published, unpublished or deleted from the
   * table, so the host can refresh anything derived from the evaluated set.
   */
  onChecksChanged?: () => void;
}

/**
 * Check list: search/filter by status, category and tier, a Draft/Published
 * status per check, paged 10 at a time by default, a row click that opens
 * the check for editing, icon row actions (publish or unpublish, edit, delete with
 * confirmation), and a "New check" action that opens CheckFormDialog (or
 * delegates to onNewCheck/onEditCheck, see CheckPolicyTableProps). Actions
 * the user lacks the permission for are disabled.
 */
export function CheckPolicyTable(props: CheckPolicyTableProps) {
  const { onNewCheck, onEditCheck, onChecksChanged } = props;
  const classes = useStyles();
  const api = useApi(dynamicChecksApiRef);
  const toastApi = useApi(toastApiRef);
  const tierLabel = useTierLabel();
  const permissions = useCheckPermissions();

  const [checks, setChecks] = useState<DynamicCheck[]>([]);
  const [factSchemas, setFactSchemas] = useState<FactSchema[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | undefined>();

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [tierFilter, setTierFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<DynamicCheck | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(PAGE_SIZES[0]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogCheck, setDialogCheck] = useState<DynamicCheck | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [checksResult, factSchemasResult] = await Promise.all([
        api.listChecks(),
        api.listFactSchemas(),
      ]);
      setChecks(checksResult);
      setFactSchemas(factSchemasResult);
      setError(undefined);
    } catch (e) {
      setError(e as Error);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const existingCategories = useMemo(
    () =>
      Array.from(
        new Set(
          checks
            .map(c => c.metadata?.category)
            .filter((c): c is string => typeof c === 'string' && c.length > 0),
        ),
      ).sort(),
    [checks],
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const rankOf = (c: DynamicCheck) => Number(c.metadata?.rank ?? 0);
    const byTier = (a: DynamicCheck, b: DynamicCheck) =>
      rankOf(a) - rankOf(b) || a.name.localeCompare(b.name);
    const matching = checks.filter(c => {
      if (query && !c.name.toLowerCase().includes(query)) return false;
      if (categoryFilter && c.metadata?.category !== categoryFilter)
        return false;
      if (tierFilter && String(c.metadata?.rank ?? '') !== tierFilter)
        return false;
      if (statusFilter && c.status !== statusFilter) return false;
      return true;
    });
    return matching.sort(byTier);
  }, [checks, search, categoryFilter, tierFilter, statusFilter]);

  useEffect(() => {
    setPage(0);
  }, [search, categoryFilter, tierFilter, statusFilter]);

  const lastPage = Math.max(0, Math.ceil(filtered.length / rowsPerPage) - 1);
  const currentPage = Math.min(page, lastPage);
  const pageRows = filtered.slice(
    currentPage * rowsPerPage,
    (currentPage + 1) * rowsPerPage,
  );

  async function togglePublished(check: DynamicCheck) {
    const published = check.status === 'published';
    setActionError(null);
    setBusyId(check.id);
    try {
      if (published) {
        await api.unpublishCheck(check.id);
      } else {
        await api.publishCheck(check.id);
      }
      toastApi.post({
        title: published
          ? `Unpublished "${check.name}". It is no longer evaluated.`
          : `Published "${check.name}". It now counts towards scores.`,
        status: 'success',
        timeout: TOAST_TIMEOUT_MS,
      });
      onChecksChanged?.();
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setBusyId(null);
    }
    await refresh();
  }

  async function confirmDelete(check: DynamicCheck) {
    await api.deleteCheck(check.id);
    setDeleting(null);
    toastApi.post({
      title: `Deleted "${check.name}".`,
      status: 'success',
      timeout: TOAST_TIMEOUT_MS,
    });
    onChecksChanged?.();
    await refresh();
  }

  function openNewCheck() {
    if (onNewCheck) {
      onNewCheck(factSchemas, existingCategories);
    } else {
      setDialogCheck(null);
      setDialogOpen(true);
    }
  }

  function openEditCheck(check: DynamicCheck) {
    if (onEditCheck) {
      onEditCheck(check, factSchemas, existingCategories);
    } else {
      setDialogCheck(check);
      setDialogOpen(true);
    }
  }

  async function handleSaved() {
    setDialogOpen(false);
    onChecksChanged?.();
    await refresh();
  }

  async function handlePublished() {
    setDialogOpen(false);
    onChecksChanged?.();
    await refresh();
  }

  if (error) {
    return <ResponseErrorPanel error={error} />;
  }

  return (
    <>
      <InfoCard title="Checks">
        <Box className={classes.toolbar}>
          <TextField
            variant="outlined"
            size="small"
            placeholder="Search checks"
            className={classes.search}
            value={search}
            onChange={e => setSearch(e.target.value)}
            inputProps={{ 'aria-label': 'Search checks' }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
              endAdornment: search ? (
                <InputAdornment position="end">
                  <IconButton
                    size="small"
                    aria-label="Clear search"
                    onClick={() => setSearch('')}
                  >
                    <ClearIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ) : undefined,
            }}
          />
          <TextField
            select
            variant="outlined"
            size="small"
            label="Category"
            className={classes.filter}
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
          >
            <MenuItem value="">All categories</MenuItem>
            {existingCategories.map(c => (
              <MenuItem key={c} value={c}>
                {c}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            variant="outlined"
            size="small"
            label="Tier"
            className={classes.filter}
            value={tierFilter}
            onChange={e => setTierFilter(e.target.value)}
          >
            <MenuItem value="">All tiers</MenuItem>
            {CHECK_TIERS.map(tier => (
              <MenuItem key={tier} value={String(tier)}>
                {tierLabel(tier)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            variant="outlined"
            size="small"
            label="Status"
            className={classes.filter}
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <MenuItem value="">All statuses</MenuItem>
            <MenuItem value="published">Published</MenuItem>
            <MenuItem value="draft">Draft</MenuItem>
          </TextField>
          <Tooltip title="Refresh">
            <IconButton size="small" onClick={refresh} aria-label="Refresh">
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Box flexGrow={1} />
          <Tooltip title={permissions.canManage ? '' : NOT_ALLOWED_TOOLTIP}>
            <span>
              <Button
                variant="contained"
                color="primary"
                size="small"
                startIcon={<AddIcon />}
                disabled={!permissions.canManage}
                onClick={openNewCheck}
              >
                New check
              </Button>
            </span>
          </Tooltip>
        </Box>

        {actionError && (
          <Box mb={2}>
            <Alert severity="error" onClose={() => setActionError(null)}>
              {actionError}
            </Alert>
          </Box>
        )}
        {loading && <Progress />}
        {!loading && filtered.length === 0 && (
          <Box p={3} textAlign="center">
            <Typography variant="body2" color="textSecondary">
              {checks.length === 0
                ? 'No checks yet. Create one with "New check".'
                : 'No checks match the current filters.'}
            </Typography>
          </Box>
        )}
        {!loading && filtered.length > 0 && (
          <>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Tier</TableCell>
                  <TableCell>Check</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {pageRows.map(check => {
                  const rank = check.metadata?.rank as number | undefined;
                  const category = (check.metadata?.category as string) || '—';
                  const published = check.status === 'published';
                  const busy = busyId === check.id;
                  return (
                    <TableRow
                      key={check.id}
                      hover
                      className={
                        permissions.canManage ? classes.editableRow : undefined
                      }
                      onClick={
                        permissions.canManage
                          ? () => openEditCheck(check)
                          : undefined
                      }
                    >
                      <TableCell>
                        {rank !== undefined && <TierChip rank={rank} />}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body1">{check.name}</Typography>
                        {check.description && (
                          <Typography variant="body2" color="textSecondary">
                            {check.description}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={category}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <span className={classes.status}>
                          <CheckStatusChip status={check.status} />
                          {check.problems?.length ? (
                            <Tooltip
                              title={`${
                                published
                                  ? "Not evaluated: it can't run against the current facts."
                                  : "Can't be published yet."
                              } ${check.problems
                                .map(problem => problem.message)
                                .join(' ')}`}
                            >
                              <WarningIcon
                                fontSize="small"
                                className={classes.problem}
                                aria-label={`Problems with check ${check.name}`}
                              />
                            </Tooltip>
                          ) : null}
                        </span>
                      </TableCell>
                      <TableCell
                        align="right"
                        className={classes.actions}
                        onClick={event => event.stopPropagation()}
                      >
                        <Tooltip
                          title={
                            permissions.canManage
                              ? publishTooltip(published)
                              : NOT_ALLOWED_TOOLTIP
                          }
                        >
                          <span>
                            <IconButton
                              size="small"
                              aria-label={`${
                                published ? 'Unpublish' : 'Publish'
                              } check ${check.name}`}
                              disabled={busy || !permissions.canManage}
                              onClick={() => togglePublished(check)}
                            >
                              {published ? (
                                <PauseCircleOutlineIcon fontSize="small" />
                              ) : (
                                <PlayCircleOutlineIcon fontSize="small" />
                              )}
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip
                          title={
                            permissions.canManage ? 'Edit' : NOT_ALLOWED_TOOLTIP
                          }
                        >
                          <span>
                            <IconButton
                              size="small"
                              aria-label={`Edit check ${check.name}`}
                              disabled={busy || !permissions.canManage}
                              onClick={() => openEditCheck(check)}
                            >
                              <EditOutlinedIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip
                          title={
                            permissions.canManage
                              ? 'Delete'
                              : NOT_ALLOWED_TOOLTIP
                          }
                        >
                          <span>
                            <IconButton
                              size="small"
                              aria-label={`Delete check ${check.name}`}
                              className={classes.deleteButton}
                              disabled={busy || !permissions.canManage}
                              onClick={() => setDeleting(check)}
                            >
                              <DeleteOutlineIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {filtered.length > PAGE_SIZES[0] && (
              <TablePagination
                component="div"
                count={filtered.length}
                page={currentPage}
                rowsPerPage={rowsPerPage}
                rowsPerPageOptions={PAGE_SIZES}
                onPageChange={(_, next) => setPage(next)}
                onRowsPerPageChange={e => {
                  setRowsPerPage(Number(e.target.value));
                  setPage(0);
                }}
              />
            )}
          </>
        )}
      </InfoCard>

      <DeleteCheckDialog
        check={deleting}
        onCancel={() => setDeleting(null)}
        onConfirm={confirmDelete}
      />

      <CheckFormDialog
        open={dialogOpen}
        check={dialogCheck}
        factSchemas={factSchemas}
        existingCategories={existingCategories}
        onClose={() => setDialogOpen(false)}
        onSaved={handleSaved}
        onPublished={handlePublished}
      />
    </>
  );
}
