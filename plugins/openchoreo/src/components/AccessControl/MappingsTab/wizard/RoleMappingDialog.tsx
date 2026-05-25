import { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  FormControl,
  Select,
  MenuItem,
  CircularProgress,
  Tooltip,
  Grid,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import CloseIcon from '@material-ui/icons/Close';
import InfoOutlinedIcon from '@material-ui/icons/InfoOutlined';
import AddIcon from '@material-ui/icons/Add';
import { ClusterRole } from '../../hooks';
import { WizardRoleMapping } from './types';
import {
  ConditionsEditor,
  NO_CONDITIONABLE_ACTIONS_MSG,
} from './ConditionsEditor';
import { BindingScope, SCOPE_CLUSTER, SCOPE_NAMESPACE } from '../../constants';
import { buildScopePath, getConditionableActions } from './utils';
import {
  useNamespaces,
  useProjects,
  useComponents,
  useActions,
} from '../../hooks';

const useStyles = makeStyles(theme => ({
  dialogTitle: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 0,
  },
  closeButton: {
    marginRight: -theme.spacing(1),
  },
  dialogPaper: {
    height: '85vh',
  },
  dialogContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    overflowY: 'auto',
  },
  scopeRow: {
    display: 'flex',
    gap: theme.spacing(2),
  },
  scopeField: {
    flex: '1 1 0',
    minWidth: 0,
  },
  sectionDivider: {
    borderTop: `1px solid ${theme.palette.divider}`,
    margin: theme.spacing(1, 0),
  },
  conditionsHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(0.5, 0),
  },
  conditionsLabel: {
    fontSize: '0.8rem',
    fontWeight: 600,
    color: theme.palette.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  flexSpacer: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: '0.8rem',
    fontWeight: 600,
    color: theme.palette.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: theme.spacing(0.5),
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  fieldSelect: {
    width: '100%',
  },
  scopeFields: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
  },
  duplicateWarning: {
    color: theme.palette.error.main,
    fontSize: '0.75rem',
    marginTop: theme.spacing(0.5),
  },
  roleHelpText: {
    fontSize: '0.75rem',
    color: theme.palette.text.secondary,
    marginTop: theme.spacing(0.5),
  },
  scopePreview: {
    marginBottom: theme.spacing(1.5),
    fontFamily: 'monospace',
    fontSize: '0.9rem',
    color: theme.palette.text.primary,
    overflowWrap: 'anywhere',
  },
}));

interface RoleMappingDialogProps {
  open: boolean;
  /** When provided, dialog runs in edit mode for this mapping */
  initial?: WizardRoleMapping;
  bindingType: BindingScope;
  /** Required for namespace bindings */
  namespace?: string;
  availableRoles: ClusterRole[];
  /** Called with the full mapping (confirmed=true) on Save */
  onSave: (mapping: WizardRoleMapping) => void;
  onCancel: () => void;
  /** Used to detect duplicate role+scope combinations across the parent list */
  existingMappings: WizardRoleMapping[];
  /** Index of the mapping being edited, so we exclude it from the duplicate check */
  editingIndex?: number;
}

const blankMapping = (): WizardRoleMapping => ({
  role: '',
  roleNamespace: '',
  namespace: '',
  project: '',
  component: '',
  confirmed: false,
  conditions: [],
});

function isDuplicate(
  draft: WizardRoleMapping,
  others: WizardRoleMapping[],
  editingIndex: number | undefined,
  bindingType: BindingScope,
): boolean {
  if (!draft.role) return false;
  return others.some((other, i) => {
    if (editingIndex !== undefined && i === editingIndex) return false;
    return (
      other.role === draft.role &&
      other.namespace === draft.namespace &&
      other.project === draft.project &&
      other.component === draft.component &&
      (bindingType === SCOPE_CLUSTER ||
        other.roleNamespace === draft.roleNamespace)
    );
  });
}

export const RoleMappingDialog = ({
  open,
  initial,
  bindingType,
  namespace,
  availableRoles,
  onSave,
  onCancel,
  existingMappings,
  editingIndex,
}: RoleMappingDialogProps) => {
  const classes = useStyles();
  const isEdit = !!initial;
  const [draft, setDraft] = useState<WizardRoleMapping>(
    () => initial ?? blankMapping(),
  );
  const [conditionEditing, setConditionEditing] = useState(false);

  // Reset draft whenever the dialog reopens
  useEffect(() => {
    if (open) {
      setDraft(initial ?? blankMapping());
      setConditionEditing(false);
    }
  }, [open, initial]);

  const { namespaces, loading: namespacesLoading } = useNamespaces();
  const { actions: actionCatalog } = useActions();

  const effectiveNamespace =
    bindingType === SCOPE_NAMESPACE ? namespace : draft.namespace;
  const { projects, loading: projectsLoading } = useProjects(
    effectiveNamespace || undefined,
  );
  const { components, loading: componentsLoading } = useComponents(
    effectiveNamespace || undefined,
    draft.project || undefined,
  );

  // Roles split for namespace bindings (which can target either kind)
  const clusterRoles = availableRoles.filter(r => !r.namespace);
  const namespaceRoles = availableRoles.filter(r => !!r.namespace);

  const getRoleKey = (role: { name: string; namespace?: string }) =>
    `${role.name}|${role.namespace || ''}`;
  const draftRoleKey = draft.role ? `${draft.role}|${draft.roleNamespace}` : '';

  const handleRoleChange = (compositeKey: string) => {
    const [roleName, roleNamespace] = compositeKey.split('|');
    setDraft(d => ({
      ...d,
      role: roleName,
      roleNamespace: roleNamespace || '',
      // Conditions reference actions specific to a role; reset on role swap
      conditions: [],
    }));
  };

  const handleScopeUpdate = (patch: Partial<WizardRoleMapping>) => {
    setDraft(d => ({ ...d, ...patch }));
  };

  const handleConditionsChange = (
    conditions: WizardRoleMapping['conditions'],
  ) => {
    setDraft(d => ({ ...d, conditions }));
  };

  // Compute the actions a chosen role grants — used to scope condition action picker
  const roleActions = (() => {
    if (!draft.role) return [] as string[];
    const role = availableRoles.find(
      r =>
        r.name === draft.role &&
        (r.namespace ?? '') === (draft.roleNamespace ?? ''),
    );
    return role?.actions ?? [];
  })();

  const hasConditionableActions =
    getConditionableActions(roleActions, actionCatalog).length > 0;

  const duplicate = isDuplicate(
    draft,
    existingMappings,
    editingIndex,
    bindingType,
  );
  const conditionsValid = draft.conditions.every(
    c => c.confirmed && c.actions.length > 0 && c.expression.trim().length > 0,
  );
  const canSave =
    !!draft.role && !duplicate && conditionsValid && !conditionEditing;

  const handleSave = () => {
    if (!canSave) return;
    onSave({ ...draft, confirmed: true });
  };

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      maxWidth="md"
      fullWidth
      classes={{ paper: classes.dialogPaper }}
      aria-labelledby="role-mapping-dialog-title"
    >
      <DialogTitle
        disableTypography
        className={classes.dialogTitle}
        id="role-mapping-dialog-title"
      >
        <Typography variant="h4">
          {isEdit ? 'Edit Role Mapping' : 'Add Role Mapping'}
        </Typography>
        <IconButton className={classes.closeButton} onClick={onCancel}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent className={classes.dialogContent}>
        <Grid container>
          <Grid item xs={12} sm={8}>
            <Typography className={classes.fieldLabel}>Role *</Typography>
            <FormControl
              size="small"
              variant="outlined"
              className={classes.fieldSelect}
            >
              <Select
                value={draftRoleKey}
                onChange={e => handleRoleChange(e.target.value as string)}
                displayEmpty
                renderValue={selected =>
                  selected ? (
                    String(selected).split('|')[0]
                  ) : (
                    <span style={{ color: '#9e9e9e' }}>Select a role…</span>
                  )
                }
              >
                <MenuItem value="" disabled>
                  Select a role…
                </MenuItem>
                {bindingType === SCOPE_NAMESPACE
                  ? [
                      namespaceRoles.length > 0 && (
                        <MenuItem disabled key="__ns_header">
                          <Typography variant="caption" color="textSecondary">
                            Namespace Roles
                          </Typography>
                        </MenuItem>
                      ),
                      ...namespaceRoles.map(role => (
                        <MenuItem
                          key={`ns-${getRoleKey(role)}`}
                          value={getRoleKey(role)}
                        >
                          {role.name}
                        </MenuItem>
                      )),
                      clusterRoles.length > 0 && (
                        <MenuItem disabled key="__cr_header">
                          <Typography variant="caption" color="textSecondary">
                            Cluster Roles
                          </Typography>
                        </MenuItem>
                      ),
                      ...clusterRoles.map(role => (
                        <MenuItem
                          key={`cr-${getRoleKey(role)}`}
                          value={getRoleKey(role)}
                        >
                          {role.name}
                        </MenuItem>
                      )),
                    ]
                  : availableRoles.map(role => (
                      <MenuItem key={getRoleKey(role)} value={getRoleKey(role)}>
                        {role.name}
                      </MenuItem>
                    ))}
              </Select>
            </FormControl>
            {duplicate && (
              <Typography className={classes.duplicateWarning}>
                A mapping with this role and scope already exists
              </Typography>
            )}
          </Grid>
        </Grid>

        <Grid container>
          <Grid item xs={12} sm={8}>
            <Typography className={classes.fieldLabel}>
              Scope
              <Tooltip
                title="Scope defines the boundary where the role applies. Wildcards mean the role applies to all resources at that level and below."
                arrow
                placement="top"
              >
                <InfoOutlinedIcon
                  style={{ fontSize: 14, opacity: 0.6, cursor: 'help' }}
                />
              </Tooltip>
            </Typography>
            <Typography className={classes.scopePreview}>
              {buildScopePath(draft, bindingType, namespace)}
            </Typography>
            <Box className={classes.scopeRow}>
              {bindingType === SCOPE_CLUSTER && (
                <Box className={classes.scopeField}>
                  <Typography
                    variant="caption"
                    color="textSecondary"
                    display="block"
                    gutterBottom
                  >
                    Namespace
                  </Typography>
                  <FormControl
                    size="small"
                    variant="outlined"
                    className={classes.fieldSelect}
                  >
                    <Select
                      value={draft.namespace || '_all'}
                      onChange={e => {
                        const val = e.target.value as string;
                        handleScopeUpdate({
                          namespace: val === '_all' ? '' : val,
                          project: '',
                          component: '',
                        });
                      }}
                    >
                      <MenuItem value="_all">All Namespaces</MenuItem>
                      {namespacesLoading && (
                        <MenuItem disabled>
                          <CircularProgress size={16} />
                        </MenuItem>
                      )}
                      {namespaces.map(ns => (
                        <MenuItem key={ns.name} value={ns.name}>
                          {ns.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>
              )}

              {effectiveNamespace && (
                <Box className={classes.scopeField}>
                  <Typography
                    variant="caption"
                    color="textSecondary"
                    display="block"
                    gutterBottom
                  >
                    Project
                  </Typography>
                  <FormControl
                    size="small"
                    variant="outlined"
                    className={classes.fieldSelect}
                  >
                    <Select
                      value={draft.project || '_all'}
                      onChange={e => {
                        const val = e.target.value as string;
                        handleScopeUpdate({
                          project: val === '_all' ? '' : val,
                          component: '',
                        });
                      }}
                    >
                      <MenuItem value="_all">All Projects</MenuItem>
                      {projectsLoading && (
                        <MenuItem disabled>
                          <CircularProgress size={16} />
                        </MenuItem>
                      )}
                      {projects.map(p => (
                        <MenuItem key={p.name} value={p.name}>
                          {p.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>
              )}

              {draft.project && (
                <Box className={classes.scopeField}>
                  <Typography
                    variant="caption"
                    color="textSecondary"
                    display="block"
                    gutterBottom
                  >
                    Component
                  </Typography>
                  <FormControl
                    size="small"
                    variant="outlined"
                    className={classes.fieldSelect}
                  >
                    <Select
                      value={draft.component || '_all'}
                      onChange={e => {
                        const val = e.target.value as string;
                        handleScopeUpdate({
                          component: val === '_all' ? '' : val,
                        });
                      }}
                    >
                      <MenuItem value="_all">All Components</MenuItem>
                      {componentsLoading && (
                        <MenuItem disabled>
                          <CircularProgress size={16} />
                        </MenuItem>
                      )}
                      {components.map(c => (
                        <MenuItem key={c.name} value={c.name}>
                          {c.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>
              )}
            </Box>
          </Grid>
        </Grid>

        <Box className={classes.sectionDivider} />

        <Box>
          <Box className={classes.conditionsHeader}>
            <Typography className={classes.conditionsLabel}>
              Conditions ({draft.conditions.length})
            </Typography>
            <Box className={classes.flexSpacer} />
            <Tooltip
              title={(() => {
                if (!draft.role) return 'Select a role first to add conditions';
                if (conditionEditing)
                  return 'Finish editing the current condition first';
                if (!hasConditionableActions)
                  return NO_CONDITIONABLE_ACTIONS_MSG;
                return '';
              })()}
            >
              <span>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<AddIcon />}
                  disabled={
                    !draft.role || conditionEditing || !hasConditionableActions
                  }
                  onClick={() =>
                    handleConditionsChange([
                      ...draft.conditions,
                      {
                        id: `c-${Date.now()}-${Math.random()
                          .toString(36)
                          .slice(2, 8)}`,
                        actions: [],
                        expression: '',
                        confirmed: false,
                      },
                    ])
                  }
                >
                  Add condition
                </Button>
              </span>
            </Tooltip>
          </Box>
          <ConditionsEditor
            conditions={draft.conditions}
            roleActions={roleActions}
            actionCatalog={actionCatalog}
            onChange={handleConditionsChange}
            onEditingChange={setConditionEditing}
            hideHeader
          />
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
        <Tooltip
          title={
            conditionEditing ? 'Finish editing the current condition first' : ''
          }
        >
          <span>
            <Button
              variant="contained"
              color="primary"
              onClick={handleSave}
              disabled={!canSave}
            >
              {isEdit ? 'Save Mapping' : 'Add Mapping'}
            </Button>
          </span>
        </Tooltip>
      </DialogActions>
    </Dialog>
  );
};
