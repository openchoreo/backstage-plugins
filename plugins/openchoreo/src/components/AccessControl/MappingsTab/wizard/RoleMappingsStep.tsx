import { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  IconButton,
  Paper,
  Chip,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import AddIcon from '@material-ui/icons/Add';
import DeleteIcon from '@material-ui/icons/DeleteOutlined';
import EditIcon from '@material-ui/icons/EditOutlined';
import InfoOutlinedIcon from '@material-ui/icons/InfoOutlined';
import { Tooltip } from '@material-ui/core';
import { WizardStepProps, WizardRoleMapping } from './types';
import { RoleMappingDialog } from './RoleMappingDialog';
import { BindingScope, SCOPE_CLUSTER, SCOPE_NAMESPACE } from '../../constants';
import { useSharedStyles } from '../styles';
import { buildScopePath } from './utils';

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
    flex: '0 0 35%',
    minWidth: 0,
  },
  scopeColumn: {
    flex: '0 0 40%',
    minWidth: 0,
  },
  conditionsColumn: {
    flex: '0 0 15%',
    minWidth: 0,
  },
  actionsColumn: {
    flex: '0 0 10%',
    minWidth: 0,
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
  roleText: {
    fontWeight: 500,
    fontSize: '0.95rem',
  },
  scopePath: {
    fontFamily: 'monospace',
    fontSize: '0.875rem',
    color: theme.palette.text.secondary,
    overflowWrap: 'anywhere',
  },
  emptyState: {
    textAlign: 'center',
    padding: theme.spacing(4),
    color: theme.palette.text.secondary,
  },
  conditionsChip: {
    fontSize: '0.7rem',
    height: 22,
  },
  actionButtons: {
    display: 'flex',
    gap: theme.spacing(0.5),
    alignItems: 'center',
  },
}));

interface RoleMappingsStepProps extends WizardStepProps {
  bindingType?: BindingScope;
  namespace?: string;
}

/**
 * Step 2: define one or more role mappings.
 * editing happens in a modal so role + scope + conditions can be set together.
 */
export const RoleMappingsStep = ({
  state,
  onChange,
  availableRoles,
  bindingType,
  namespace,
}: RoleMappingsStepProps) => {
  const classes = useStyles();
  const sharedClasses = useSharedStyles();

  /**
   * Dialog state. `editingIndex === -1` means we're creating a brand-new
   * mapping; non-negative means editing the row at that index. `null` means
   * the dialog is closed.
   */
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const handleOpenAdd = () => setEditingIndex(-1);
  const handleOpenEdit = (index: number) => setEditingIndex(index);
  const handleCancel = () => setEditingIndex(null);

  const handleSave = (mapping: WizardRoleMapping) => {
    const updated = [...state.roleMappings];
    if (editingIndex === -1 || editingIndex === null) {
      updated.push(mapping);
    } else {
      updated[editingIndex] = mapping;
    }
    onChange({ roleMappings: updated });
    setEditingIndex(null);
  };

  const handleDelete = (index: number) => {
    const updated = state.roleMappings.filter((_, i) => i !== index);
    onChange({ roleMappings: updated });
  };

  const dialogOpen = editingIndex !== null;
  const dialogInitial =
    editingIndex !== null && editingIndex >= 0
      ? state.roleMappings[editingIndex]
      : undefined;

  const visibleRows = state.roleMappings.filter(rm => rm.confirmed);

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
          onClick={handleOpenAdd}
          className={classes.addButton}
        >
          Add Mapping
        </Button>
      </Box>

      {visibleRows.length === 0 ? (
        <Paper variant="outlined" className={classes.emptyState}>
          <Typography variant="body1">
            No role mappings yet — click <strong>Add Mapping</strong> to grant a
            role.
          </Typography>
        </Paper>
      ) : (
        <Paper variant="outlined" className={classes.tableContainer}>
          <Box className={classes.tableHeader}>
            <Box className={classes.roleColumn}>
              <Typography className={classes.headerLabel}>Role</Typography>
            </Box>
            <Box
              className={classes.scopeColumn}
              style={{ display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <Typography className={classes.headerLabel}>Scope</Typography>
              <Tooltip
                title="Scope defines the boundary where the role applies. A wildcard (*) means the role applies to all resources at that level and below."
                arrow
                placement="top"
              >
                <InfoOutlinedIcon
                  style={{
                    fontSize: 16,
                    opacity: 0.6,
                    cursor: 'help',
                  }}
                />
              </Tooltip>
            </Box>
            <Box className={classes.conditionsColumn}>
              <Typography className={classes.headerLabel}>
                Conditions
              </Typography>
            </Box>
            <Box className={classes.actionsColumn} />
          </Box>

          {state.roleMappings.map((mapping, index) => {
            if (!mapping.confirmed) return null;
            const scopePath = buildScopePath(mapping, bindingType, namespace);
            const conditionCount = mapping.conditions.length;

            return (
              <Box key={index} className={classes.row}>
                <Box className={classes.roleColumn}>
                  <Typography className={classes.roleText}>
                    {mapping.role}
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
                <Box className={classes.conditionsColumn}>
                  {conditionCount === 0 ? (
                    <Typography variant="body2" color="textSecondary">
                      —
                    </Typography>
                  ) : (
                    <Chip
                      size="small"
                      variant="outlined"
                      label={`${conditionCount} condition${
                        conditionCount === 1 ? '' : 's'
                      }`}
                      className={classes.conditionsChip}
                    />
                  )}
                </Box>
                <Box className={classes.actionsColumn}>
                  <Box className={classes.actionButtons}>
                    <IconButton
                      size="small"
                      onClick={() => handleOpenEdit(index)}
                      title="Edit"
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleDelete(index)}
                      title="Delete"
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </Box>
              </Box>
            );
          })}
        </Paper>
      )}

      <RoleMappingDialog
        open={dialogOpen}
        initial={dialogInitial}
        bindingType={bindingType ?? SCOPE_CLUSTER}
        namespace={namespace}
        availableRoles={availableRoles}
        existingMappings={state.roleMappings}
        editingIndex={
          editingIndex !== null && editingIndex >= 0 ? editingIndex : undefined
        }
        onSave={handleSave}
        onCancel={handleCancel}
      />
    </Box>
  );
};
