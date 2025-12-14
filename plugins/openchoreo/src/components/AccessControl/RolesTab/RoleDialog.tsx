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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  ListItemText,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { useActions, Role } from '../hooks';

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
  actionsSelect: {
    minWidth: '100%',
  },
  menuItem: {
    padding: theme.spacing(0.5, 2),
  },
}));

const ROLE_TEMPLATES = {
  developer: {
    name: 'developer',
    actions: [
      'component:view',
      'component:create',
      'component:update',
      'component:deploy',
      'project:view',
    ],
  },
  viewer: {
    name: 'viewer',
    actions: ['component:view', 'project:view', 'organization:view'],
  },
  admin: {
    name: 'admin',
    actions: ['*'],
  },
};

interface RoleDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (role: Role) => Promise<void>;
  editingRole?: Role;
}

export const RoleDialog = ({
  open,
  onClose,
  onSave,
  editingRole,
}: RoleDialogProps) => {
  const classes = useStyles();
  const { actions: availableActions, loading: actionsLoading } = useActions();

  const [name, setName] = useState('');
  const [selectedActions, setSelectedActions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      await onSave({ name: name.trim(), actions: selectedActions });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save role');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveAction = (action: string) => {
    setSelectedActions(prev => prev.filter(a => a !== action));
  };

  // Group actions by resource type for better organization
  const groupedActions = availableActions.reduce(
    (groups, action) => {
      const [resource] = action.split(':');
      if (!groups[resource]) {
        groups[resource] = [];
      }
      groups[resource].push(action);
      return groups;
    },
    {} as Record<string, string[]>,
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {editingRole ? `Edit Role: ${editingRole.name}` : 'Create New Role'}
      </DialogTitle>
      <DialogContent>
        <Box className={classes.templateSection}>
          <Typography variant="subtitle2" gutterBottom>
            Quick Start Templates:
          </Typography>
          <Button
            variant="outlined"
            size="small"
            className={classes.templateButton}
            onClick={() => handleApplyTemplate('developer')}
          >
            Developer
          </Button>
          <Button
            variant="outlined"
            size="small"
            className={classes.templateButton}
            onClick={() => handleApplyTemplate('viewer')}
          >
            Viewer
          </Button>
          <Button
            variant="outlined"
            size="small"
            className={classes.templateButton}
            onClick={() => handleApplyTemplate('admin')}
          >
            Admin (All)
          </Button>
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

        <FormControl
          fullWidth
          className={classes.formField}
          disabled={actionsLoading}
        >
          <InputLabel>Select Actions</InputLabel>
          <Select
            multiple
            value={selectedActions}
            onChange={e => setSelectedActions(e.target.value as string[])}
            renderValue={() =>
              `${selectedActions.length} action(s) selected`
            }
            className={classes.actionsSelect}
          >
            {Object.entries(groupedActions).map(([resource, resourceActions]) => [
              <MenuItem key={`header-${resource}`} disabled>
                <Typography variant="subtitle2" color="primary">
                  {resource.toUpperCase()}
                </Typography>
              </MenuItem>,
              ...resourceActions.map(action => (
                <MenuItem
                  key={action}
                  value={action}
                  className={classes.menuItem}
                >
                  <Checkbox checked={selectedActions.includes(action)} />
                  <ListItemText primary={action} />
                </MenuItem>
              )),
            ])}
          </Select>
        </FormControl>

        {selectedActions.length > 0 && (
          <Box className={classes.selectedActions}>
            {selectedActions.map(action => (
              <Chip
                key={action}
                label={action}
                size="small"
                onDelete={() => handleRemoveAction(action)}
              />
            ))}
          </Box>
        )}

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
          {saving ? 'Saving...' : editingRole ? 'Update' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
