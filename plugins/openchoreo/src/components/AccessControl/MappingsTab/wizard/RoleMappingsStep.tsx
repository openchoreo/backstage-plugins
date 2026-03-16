import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  IconButton,
  Paper,
  FormControl,
  Select,
  MenuItem,
  CircularProgress,
  Chip,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import AddIcon from '@material-ui/icons/Add';
import DeleteIcon from '@material-ui/icons/DeleteOutlined';
import EditIcon from '@material-ui/icons/EditOutlined';
import CheckIcon from '@material-ui/icons/Check';
import CloseIcon from '@material-ui/icons/Close';
import InfoOutlinedIcon from '@material-ui/icons/InfoOutlined';
import { Tooltip } from '@material-ui/core';
import { WizardStepProps, WizardRoleMapping } from './types';
import { BindingType } from '../MappingDialog';
import { SCOPE_CLUSTER, SCOPE_NAMESPACE } from '../../constants';
import { useSharedStyles } from '../styles';
import { useNamespaces, useProjects, useComponents } from '../../hooks';

const useStyles = makeStyles(theme => ({
  root: {
    minHeight: 350,
    marginTop: theme.spacing(2),
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing(2),
  },
  title: {
    fontWeight: 600,
  },
  addButton: {
    textTransform: 'none',
    fontWeight: 600,
  },
  tableContainer: {
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    overflow: 'hidden',
  },
  tableHeader: {
    display: 'flex',
    borderBottom: `2px solid ${theme.palette.divider}`,
    padding: theme.spacing(1.5, 2),
    backgroundColor: theme.palette.background.default,
  },
  headerLabel: {
    fontWeight: 600,
    color: theme.palette.text.secondary,
    fontSize: '0.8rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  roleColumn: {
    flex: '0 0 45%',
  },
  scopeColumn: {
    flex: '0 0 45%',
  },
  actionsColumn: {
    flex: '0 0 10%',
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    padding: theme.spacing(1.5, 2),
    borderBottom: `1px solid ${theme.palette.divider}`,
    '&:last-child': {
      borderBottom: 'none',
    },
  },
  editingRow: {
    padding: theme.spacing(2),
    backgroundColor: theme.palette.background.default,
  },
  confirmedText: {
    fontWeight: 500,
    fontSize: '0.95rem',
  },
  scopePath: {
    fontFamily: 'monospace',
    fontSize: '0.875rem',
    color: theme.palette.text.secondary,
  },
  editingFields: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
  },
  fieldSelect: {
    width: '100%',
  },
  actionButtons: {
    display: 'flex',
    gap: theme.spacing(0.5),
    alignItems: 'center',
  },
  confirmButton: {
    color: theme.palette.primary.main,
  },
  cancelButton: {
    color: theme.palette.text.secondary,
  },
  editButton: {
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    padding: theme.spacing(0.5, 1.5),
    fontSize: '0.8rem',
    textTransform: 'none',
  },
  duplicateWarning: {
    color: theme.palette.error.main,
    fontSize: '0.75rem',
    marginTop: theme.spacing(0.5),
  },
  emptyState: {
    textAlign: 'center',
    padding: theme.spacing(4),
    color: theme.palette.text.secondary,
  },
}));

interface RoleMappingsStepProps extends WizardStepProps {
  bindingType?: BindingType;
  namespace?: string;
}

/** Build scope path string like `ns:default/proj:myproj/*` */
function buildScopePath(
  rm: WizardRoleMapping,
  bindingType?: BindingType,
  namespace?: string,
): string {
  if (bindingType === SCOPE_CLUSTER) {
    if (!rm.namespace && !rm.project && !rm.component) return 'cluster:*';
    const parts: string[] = [];
    if (rm.namespace) {
      parts.push(`ns:${rm.namespace}`);
      if (rm.project) {
        parts.push(`proj:${rm.project}`);
        if (rm.component) {
          parts.push(`comp:${rm.component}`);
        } else {
          parts.push('*');
        }
      } else {
        parts.push('*');
      }
    }
    return parts.join('/');
  }
  // namespace binding
  const ns = namespace || '*';
  if (!rm.project && !rm.component) return `ns:${ns}/*`;
  const parts: string[] = [`ns:${ns}`];
  if (rm.project) {
    parts.push(`proj:${rm.project}`);
    if (rm.component) {
      parts.push(`comp:${rm.component}`);
    } else {
      parts.push('*');
    }
  }
  return parts.join('/');
}

/** Check if a mapping duplicates another in the list (same role + scope) */
function isDuplicateMapping(
  mapping: WizardRoleMapping,
  index: number,
  allMappings: WizardRoleMapping[],
  bindingType?: BindingType,
): boolean {
  if (!mapping.role) return false;
  return allMappings.some(
    (other, i) =>
      i !== index &&
      other.role === mapping.role &&
      other.namespace === mapping.namespace &&
      other.project === mapping.project &&
      other.component === mapping.component &&
      (bindingType === SCOPE_CLUSTER ||
        other.roleNamespace === mapping.roleNamespace),
  );
}

/** Inline scope editor for a single mapping row */
const ScopeEditor = ({
  mapping,
  bindingType,
  namespace,
  availableNamespaces,
  namespacesLoading,
  onUpdate,
}: {
  mapping: WizardRoleMapping;
  bindingType?: BindingType;
  namespace?: string;
  availableNamespaces: Array<{ name: string }>;
  namespacesLoading: boolean;
  onUpdate: (updates: Partial<WizardRoleMapping>) => void;
}) => {
  const classes = useStyles();

  const effectiveNamespace =
    bindingType === SCOPE_NAMESPACE ? namespace : mapping.namespace;

  const { projects, loading: projectsLoading } = useProjects(
    effectiveNamespace || undefined,
  );
  const { components, loading: componentsLoading } = useComponents(
    effectiveNamespace || undefined,
    mapping.project || undefined,
  );

  return (
    <Box className={classes.editingFields}>
      {bindingType === SCOPE_CLUSTER && (
        <FormControl
          size="small"
          variant="outlined"
          className={classes.fieldSelect}
        >
          <Select
            value={mapping.namespace || '_all'}
            onChange={e => {
              const val = e.target.value as string;
              onUpdate({
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
            {availableNamespaces.map(ns => (
              <MenuItem key={ns.name} value={ns.name}>
                {ns.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      )}

      {effectiveNamespace && (
        <FormControl
          size="small"
          variant="outlined"
          className={classes.fieldSelect}
        >
          <Select
            value={mapping.project || '_all'}
            onChange={e => {
              const val = e.target.value as string;
              onUpdate({
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
      )}

      {mapping.project && (
        <FormControl
          size="small"
          variant="outlined"
          className={classes.fieldSelect}
        >
          <Select
            value={mapping.component || '_all'}
            onChange={e => {
              const val = e.target.value as string;
              onUpdate({ component: val === '_all' ? '' : val });
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
      )}
    </Box>
  );
};

export const RoleMappingsStep = ({
  state,
  onChange,
  availableRoles,
  bindingType,
  namespace,
}: RoleMappingsStepProps) => {
  const classes = useStyles();
  const sharedClasses = useSharedStyles();

  const { namespaces, loading: namespacesLoading } = useNamespaces();

  // Track which row is being edited and a draft copy for cancel
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState<WizardRoleMapping | null>(null);

  // For namespace bindings, split roles into groups
  const clusterRoles = availableRoles.filter(r => !r.namespace);
  const namespaceRoles = availableRoles.filter(r => !!r.namespace);

  const handleAddMapping = () => {
    const newMapping: WizardRoleMapping = {
      role: '',
      roleNamespace: '',
      namespace: '',
      project: '',
      component: '',
      confirmed: false,
    };
    const updated = [...state.roleMappings, newMapping];
    onChange({ roleMappings: updated });
    // Auto-enter editing for the new row
    setEditingIndex(updated.length - 1);
    setDraft({ ...newMapping });
  };

  const handleRemoveMapping = (index: number) => {
    if (editingIndex === index) {
      setEditingIndex(null);
      setDraft(null);
    }
    const updated = state.roleMappings.filter((_, i) => i !== index);
    onChange({
      roleMappings:
        updated.length > 0
          ? updated
          : [
              {
                role: '',
                roleNamespace: '',
                namespace: '',
                project: '',
                component: '',
                confirmed: false,
              },
            ],
    });
    // Adjust editingIndex if needed
    if (editingIndex !== null && editingIndex > index) {
      setEditingIndex(editingIndex - 1);
    }
  };

  const handleStartEdit = (index: number) => {
    setEditingIndex(index);
    setDraft({ ...state.roleMappings[index] });
  };

  const handleConfirm = (index: number) => {
    const updated = [...state.roleMappings];
    updated[index] = { ...updated[index], confirmed: true };
    onChange({ roleMappings: updated });
    setEditingIndex(null);
    setDraft(null);
  };

  const handleCancel = (index: number) => {
    if (draft) {
      // If this was a new empty row that was never confirmed, remove it
      if (!draft.confirmed && !draft.role) {
        const updated = state.roleMappings.filter((_, i) => i !== index);
        if (updated.length > 0) {
          onChange({ roleMappings: updated });
        }
      } else {
        // Restore draft
        const updated = [...state.roleMappings];
        updated[index] = draft;
        onChange({ roleMappings: updated });
      }
    }
    setEditingIndex(null);
    setDraft(null);
  };

  const getRoleKey = (role: { name: string; namespace?: string }) =>
    `${role.name}|${role.namespace || ''}`;

  const getMappingRoleKey = (rm: WizardRoleMapping) =>
    `${rm.role}|${rm.roleNamespace || ''}`;

  const handleRoleChange = (index: number, compositeKey: string) => {
    const [roleName, roleNamespace] = compositeKey.split('|');
    const updated = [...state.roleMappings];
    updated[index] = {
      ...updated[index],
      role: roleName,
      roleNamespace: roleNamespace || '',
    };
    onChange({ roleMappings: updated });
  };

  const handleScopeUpdate = (
    index: number,
    updates: Partial<WizardRoleMapping>,
  ) => {
    const updated = [...state.roleMappings];
    updated[index] = { ...updated[index], ...updates };
    onChange({ roleMappings: updated });
  };

  const renderRoleSelect = (mapping: WizardRoleMapping, index: number) => (
    <FormControl
      size="small"
      variant="outlined"
      className={classes.fieldSelect}
    >
      <Select
        value={mapping.role ? getMappingRoleKey(mapping) : ''}
        onChange={e => handleRoleChange(index, e.target.value as string)}
        displayEmpty
        renderValue={selected =>
          selected ? (
            String(selected).split('|')[0]
          ) : (
            <span style={{ color: '#9e9e9e' }}>Select a role...</span>
          )
        }
      >
        <MenuItem value="" disabled>
          Select a role...
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
  );

  // Auto-open first row for editing if it's the initial empty state
  useEffect(() => {
    if (
      editingIndex === null &&
      state.roleMappings.length === 1 &&
      !state.roleMappings[0].role &&
      !state.roleMappings[0].confirmed
    ) {
      setEditingIndex(0);
      setDraft({ ...state.roleMappings[0] });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Box className={classes.root}>
      <Box className={classes.header}>
        <Typography variant="h5" className={classes.title}>
          Role Mappings
        </Typography>
        <Button
          variant="outlined"
          color="primary"
          startIcon={<AddIcon />}
          onClick={handleAddMapping}
          className={classes.addButton}
          disabled={editingIndex !== null}
        >
          Add
        </Button>
      </Box>

      <Paper variant="outlined" className={classes.tableContainer}>
        <Box className={classes.tableHeader}>
          <Box className={classes.roleColumn}>
            <Typography className={classes.headerLabel}>Roles</Typography>
          </Box>
          <Box
            className={classes.scopeColumn}
            style={{ display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <Typography className={classes.headerLabel}>Scope</Typography>
            <Tooltip
              title="Scope defines the boundary where the role applies. It can be at cluster, namespace, project, or component level. A wildcard (*) means the role applies to all resources at that level and below."
              arrow
              placement="top"
            >
              <InfoOutlinedIcon
                style={{
                  fontSize: 16,
                  color: 'inherit',
                  opacity: 0.6,
                  cursor: 'help',
                }}
              />
            </Tooltip>
          </Box>
          <Box className={classes.actionsColumn} />
        </Box>

        {state.roleMappings.map((mapping, index) => {
          const isEditing = editingIndex === index;
          const scopePath = buildScopePath(mapping, bindingType, namespace);

          if (isEditing) {
            const isDuplicate = isDuplicateMapping(
              mapping,
              index,
              state.roleMappings,
              bindingType,
            );

            return (
              <Box
                key={index}
                className={`${classes.row} ${classes.editingRow}`}
              >
                <Box
                  className={classes.roleColumn}
                  style={{ paddingRight: 16 }}
                >
                  {renderRoleSelect(mapping, index)}
                  {isDuplicate && (
                    <Typography className={classes.duplicateWarning}>
                      Duplicate role and scope combination
                    </Typography>
                  )}
                </Box>
                <Box
                  className={classes.scopeColumn}
                  style={{ paddingRight: 16 }}
                >
                  <ScopeEditor
                    mapping={mapping}
                    bindingType={bindingType}
                    namespace={namespace}
                    availableNamespaces={namespaces}
                    namespacesLoading={namespacesLoading}
                    onUpdate={updates => handleScopeUpdate(index, updates)}
                  />
                </Box>
                <Box className={classes.actionsColumn}>
                  <Box className={classes.actionButtons}>
                    <IconButton
                      size="small"
                      className={classes.confirmButton}
                      onClick={() => handleConfirm(index)}
                      disabled={!mapping.role || isDuplicate}
                      title="Confirm"
                    >
                      <CheckIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      className={classes.cancelButton}
                      onClick={() => handleCancel(index)}
                      title="Cancel"
                    >
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </Box>
              </Box>
            );
          }

          // Confirmed / read-only row
          return (
            <Box key={index} className={classes.row}>
              <Box className={classes.roleColumn}>
                <Typography className={classes.confirmedText}>
                  {mapping.role || '\u2014'}
                  {bindingType === SCOPE_NAMESPACE &&
                    !mapping.roleNamespace &&
                    mapping.role && (
                      <Chip
                        label="Cluster"
                        size="small"
                        variant="outlined"
                        className={sharedClasses.clusterRoleChip}
                      />
                    )}
                </Typography>
              </Box>
              <Box className={classes.scopeColumn}>
                <Typography className={classes.scopePath}>
                  {scopePath}
                </Typography>
              </Box>
              <Box className={classes.actionsColumn}>
                <Box className={classes.actionButtons}>
                  <IconButton
                    size="small"
                    onClick={() => handleStartEdit(index)}
                    disabled={editingIndex !== null}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => handleRemoveMapping(index)}
                    disabled={
                      state.roleMappings.length <= 1 || editingIndex !== null
                    }
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              </Box>
            </Box>
          );
        })}
      </Paper>
    </Box>
  );
};
