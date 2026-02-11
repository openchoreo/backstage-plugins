import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Chip,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { useActions, ClusterRole, NamespaceRole } from '../hooks';
import {
  SCOPE_CLUSTER,
  SCOPE_NAMESPACE,
  type BindingScope,
} from '../constants';
import { ActionSelectionDialog } from './ActionSelectionDialog';
import { getActionDisplayLabel } from './actionUtils';

const useStyles = makeStyles(theme => ({
  formField: {
    marginBottom: theme.spacing(2),
  },
  selectedActions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(0.5),
    marginTop: theme.spacing(1),
  },
  templateSection: {
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(2),
  },
  templateButton: {
    marginRight: theme.spacing(1),
    marginBottom: theme.spacing(1),
  },
  actionsSection: {
    marginBottom: theme.spacing(2),
  },
  selectActionsButton: {
    marginTop: theme.spacing(1),
  },
  noActionsText: {
    color: theme.palette.text.secondary,
    fontStyle: 'italic',
    marginTop: theme.spacing(1),
  },
}));

const ROLE_TEMPLATES = {
  developer: {
    name: 'developer',
    label: 'Developer',
    actions: [
      'component:view',
      'component:create',
      'component:update',
      'component:deploy',
      'namespace:view',
      'environment:view',
      'project:view',
    ],
  },
  viewer: {
    name: 'viewer',
    label: 'Viewer',
    actions: ['component:view', 'project:view', 'namespace:view'],
  },
  admin: {
    name: 'admin',
    label: 'Admin (All)',
    actions: ['*'],
  },
};

export type RoleScope = BindingScope;
export type RoleInput = ClusterRole | NamespaceRole;

interface RoleDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (role: RoleInput) => Promise<void>;
  editingRole?: RoleInput;
  scope?: RoleScope;
  namespace?: string;
}

export const RoleDialog = ({
  open,
  onClose,
  onSave,
  editingRole,
  scope = SCOPE_CLUSTER,
  namespace,
}: RoleDialogProps) => {
  const classes = useStyles();
  const { actions: availableActions, loading: actionsLoading } = useActions();

  const [name, setName] = useState('');
  const [selectedActions, setSelectedActions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);

  useEffect(() => {
    if (editingRole) {
      setName(editingRole.name);
      setSelectedActions(editingRole.actions);
    } else {
      setName('');
      setSelectedActions([]);
    }
    setError(null);
  }, [editingRole, open]);

  const handleApplyTemplate = (templateKey: keyof typeof ROLE_TEMPLATES) => {
    const template = ROLE_TEMPLATES[templateKey];
    if (!editingRole) {
      setName(template.name);
    }
    setSelectedActions(template.actions);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Role name is required');
      return;
    }

    if (selectedActions.length === 0) {
      setError('At least one action must be selected');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      const roleData: RoleInput =
        scope === SCOPE_NAMESPACE && namespace
          ? { name: name.trim(), actions: selectedActions, namespace }
          : { name: name.trim(), actions: selectedActions };
      await onSave(roleData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save role');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveAction = (action: string) => {
    setSelectedActions(prev => prev.filter(a => a !== action));
  };

  const handleActionSelectionConfirm = (actions: string[]) => {
    setSelectedActions(actions);
    setActionDialogOpen(false);
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle disableTypography>
          <Typography variant="h4">
            {editingRole
              ? `Edit ${
                  scope === SCOPE_CLUSTER ? 'Cluster' : 'Namespace'
                } Role: ${editingRole.name}`
              : `Create New ${
                  scope === SCOPE_CLUSTER ? 'Cluster' : 'Namespace'
                } Role`}
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Box className={classes.templateSection}>
            <Typography variant="subtitle2" gutterBottom>
              Quick Start Templates
            </Typography>
            {(
              Object.keys(ROLE_TEMPLATES) as (keyof typeof ROLE_TEMPLATES)[]
            ).map(key => (
              <Button
                key={key}
                variant="outlined"
                size="small"
                className={classes.templateButton}
                onClick={() => handleApplyTemplate(key)}
              >
                {ROLE_TEMPLATES[key].label}
              </Button>
            ))}
          </Box>

          <TextField
            className={classes.formField}
            label="Role Name"
            value={name}
            onChange={e => setName(e.target.value)}
            fullWidth
            required
            disabled={!!editingRole}
            helperText={editingRole ? 'Role name cannot be changed' : undefined}
          />

          <Box className={classes.actionsSection}>
            <Typography variant="subtitle2" gutterBottom>
              Actions
            </Typography>

            <Button
              variant="outlined"
              className={classes.selectActionsButton}
              onClick={() => setActionDialogOpen(true)}
              disabled={actionsLoading}
            >
              {actionsLoading
                ? 'Loading actions...'
                : `Select Actions (${selectedActions.length} selected)`}
            </Button>

            {selectedActions.length > 0 ? (
              <Box className={classes.selectedActions}>
                {selectedActions.map(action => (
                  <Chip
                    key={action}
                    label={getActionDisplayLabel(action)}
                    size="small"
                    onDelete={() => handleRemoveAction(action)}
                  />
                ))}
              </Box>
            ) : (
              <Typography variant="body2" className={classes.noActionsText}>
                No actions selected. Click the button above to select actions.
              </Typography>
            )}
          </Box>

          {error && (
            <Typography color="error" variant="body2">
              {error}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            color="primary"
            variant="contained"
            disabled={saving}
          >
            {saving && 'Saving...'}
            {!saving && editingRole && 'Update'}
            {!saving && !editingRole && 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      <ActionSelectionDialog
        open={actionDialogOpen}
        onClose={() => setActionDialogOpen(false)}
        onConfirm={handleActionSelectionConfirm}
        availableActions={availableActions}
        selectedActions={selectedActions}
      />
    </>
  );
};
