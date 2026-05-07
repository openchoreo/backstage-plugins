import { useState, useEffect, useMemo } from 'react';
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
import { Alert } from '@material-ui/lab';
import { useActions, ClusterRole, NamespaceRole } from '../hooks';
import {
  SCOPE_CLUSTER,
  SCOPE_NAMESPACE,
  type BindingScope,
} from '../constants';
import { CHOREO_LABELS } from '@openchoreo/backstage-plugin-common';
import { isForbiddenError, getErrorMessage } from '../../../utils/errorUtils';
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
  admin: {
    name: 'admin',
    label: 'Admin',
    actions: ['*'],
  },
  platformEngineer: {
    name: 'platform-engineer',
    label: 'Platform Engineer',
    actions: [
      'namespace:view',
      'namespace:create',
      'namespace:update',
      'namespace:delete',
      'project:view',
      'project:create',
      'project:update',
      'project:delete',
      'component:view',
      'component:create',
      'component:update',
      'component:delete',
      'componentrelease:view',
      'componentrelease:create',
      'componentrelease:delete',
      'releasebinding:view',
      'releasebinding:create',
      'releasebinding:update',
      'releasebinding:delete',
      'environment:view',
      'environment:create',
      'environment:update',
      'environment:delete',
      'dataplane:view',
      'dataplane:create',
      'dataplane:update',
      'dataplane:delete',
      'workflowplane:view',
      'workflowplane:create',
      'workflowplane:update',
      'workflowplane:delete',
      'observabilityplane:view',
      'observabilityplane:create',
      'observabilityplane:update',
      'observabilityplane:delete',
      'componenttype:view',
      'componenttype:create',
      'componenttype:update',
      'componenttype:delete',
      'trait:view',
      'trait:create',
      'trait:update',
      'trait:delete',
      'workflow:view',
      'workflow:create',
      'workflow:update',
      'workflow:delete',
      'workflowrun:view',
      'workflowrun:create',
      'deploymentpipeline:view',
      'deploymentpipeline:create',
      'deploymentpipeline:update',
      'deploymentpipeline:delete',
      'secretreference:view',
      'secretreference:create',
      'secretreference:update',
      'secretreference:delete',
      'workload:view',
      'workload:create',
      'workload:update',
      'workload:delete',
      'logs:view',
      'metrics:view',
      'traces:view',
      'alerts:view',
      'incidents:view',
      'rcareport:view',
      'rcareport:update',
      'observabilityalertsnotificationchannel:view',
      'observabilityalertsnotificationchannel:create',
      'observabilityalertsnotificationchannel:update',
      'observabilityalertsnotificationchannel:delete',
      'clusterdataplane:view',
      'clusterdataplane:create',
      'clusterdataplane:update',
      'clusterdataplane:delete',
      'clusterworkflowplane:view',
      'clusterworkflowplane:create',
      'clusterworkflowplane:update',
      'clusterworkflowplane:delete',
      'clusterobservabilityplane:view',
      'clusterobservabilityplane:create',
      'clusterobservabilityplane:update',
      'clusterobservabilityplane:delete',
      'clustercomponenttype:view',
      'clustercomponenttype:create',
      'clustercomponenttype:update',
      'clustercomponenttype:delete',
      'clustertrait:view',
      'clustertrait:create',
      'clustertrait:update',
      'clustertrait:delete',
      'clusterworkflow:view',
      'clusterworkflow:create',
      'clusterworkflow:update',
      'clusterworkflow:delete',
    ],
  },
  developer: {
    name: 'developer',
    label: 'Developer',
    actions: [
      'clusterdataplane:view',
      'clusterworkflowplane:view',
      'clusterobservabilityplane:view',
      'clustercomponenttype:view',
      'clustertrait:view',
      'clusterworkflow:view',
      'namespace:view',
      'environment:view',
      'deploymentpipeline:view',
      'dataplane:view',
      'workflowplane:view',
      'observabilityplane:view',
      'componenttype:view',
      'trait:view',
      'workflow:view',
      'project:view',
      'component:view',
      'component:create',
      'component:update',
      'component:delete',
      'componentrelease:view',
      'componentrelease:create',
      'componentrelease:delete',
      'releasebinding:view',
      'releasebinding:create',
      'releasebinding:update',
      'workflowrun:view',
      'workflowrun:create',
      'secretreference:view',
      'secretreference:create',
      'secretreference:update',
      'secretreference:delete',
      'workload:view',
      'workload:create',
      'workload:update',
      'workload:delete',
      'logs:view',
      'metrics:view',
      'traces:view',
      'alerts:view',
      'rcareport:view',
    ],
  },
  sre: {
    name: 'sre',
    label: 'SRE',
    actions: [
      'clusterdataplane:view',
      'clusterworkflowplane:view',
      'clusterobservabilityplane:view',
      'clustercomponenttype:view',
      'clustertrait:view',
      'clusterworkflow:view',
      'namespace:view',
      'environment:view',
      'deploymentpipeline:view',
      'dataplane:view',
      'workflowplane:view',
      'observabilityplane:view',
      'componenttype:view',
      'trait:view',
      'workflow:view',
      'project:view',
      'component:view',
      'componentrelease:view',
      'componentrelease:create',
      'componentrelease:delete',
      'releasebinding:view',
      'releasebinding:create',
      'releasebinding:update',
      'workflowrun:view',
      'workflowrun:create',
      'workload:view',
      'workload:create',
      'secretreference:view',
      'secretreference:update',
      'logs:view',
      'metrics:view',
      'traces:view',
      'alerts:view',
      'incidents:view',
      'incidents:update',
      'rcareport:view',
      'rcareport:update',
    ],
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
  const { actions: availableActionInfos, loading: actionsLoading } =
    useActions();
  const availableActions = useMemo(
    () => availableActionInfos.map(a => a.name),
    [availableActionInfos],
  );

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
      if (isForbiddenError(err)) {
        setError(
          'You do not have permission to save this role. Contact your administrator.',
        );
      } else {
        setError(getErrorMessage(err));
      }
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
            {editingRole ? (
              <>
                Edit {scope === SCOPE_CLUSTER ? 'Cluster' : 'Namespace'} Role:{' '}
                {editingRole.name}
                {editingRole.labels?.[CHOREO_LABELS.SYSTEM] === 'true' && (
                  <Chip
                    label="System"
                    size="small"
                    variant="outlined"
                    style={{
                      marginLeft: 8,
                      fontSize: '0.7rem',
                      height: 20,
                      verticalAlign: 'middle',
                    }}
                  />
                )}
              </>
            ) : (
              `Create New ${
                scope === SCOPE_CLUSTER ? 'Cluster' : 'Namespace'
              } Role`
            )}
          </Typography>
        </DialogTitle>
        <DialogContent>
          {error && (
            <Alert
              severity="error"
              style={{ marginBottom: 16 }}
              onClose={() => setError(null)}
            >
              {error}
            </Alert>
          )}
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
