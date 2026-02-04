import { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  TextField,
  InputAdornment,
  Radio,
  RadioGroup,
  FormControlLabel,
  Paper,
  Chip,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import SearchIcon from '@material-ui/icons/Search';
import { WizardStepProps } from './types';
import { BindingType } from '../MappingDialog';
import { SCOPE_CLUSTER, SCOPE_NAMESPACE } from '../../constants';

const useStyles = makeStyles(theme => ({
  root: {
    minHeight: 350,
  },
  title: {
    marginBottom: theme.spacing(2),
  },
  searchField: {
    marginBottom: theme.spacing(2),
  },
  roleList: {
    maxHeight: 300,
    overflow: 'auto',
  },
  roleItem: {
    padding: theme.spacing(1.5, 2),
    marginBottom: theme.spacing(1),
    cursor: 'pointer',
    transition: 'background-color 0.2s',
    '&:hover': {
      backgroundColor: theme.palette.action.hover,
    },
  },
  roleItemSelected: {
    backgroundColor: theme.palette.primary.light,
    borderLeft: `3px solid ${theme.palette.primary.main}`,
  },
  roleName: {
    fontWeight: 500,
  },
  roleActions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(0.5),
    marginTop: theme.spacing(0.5),
  },
  actionChip: {
    height: 20,
    fontSize: '0.7rem',
  },
  noRoles: {
    textAlign: 'center',
    padding: theme.spacing(4),
    color: theme.palette.text.secondary,
  },
  sectionLabel: {
    fontWeight: 600,
    fontSize: '0.8rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: theme.palette.text.secondary,
    marginBottom: theme.spacing(1),
    marginTop: theme.spacing(1.5),
    '&:first-child': {
      marginTop: 0,
    },
  },
  selectedIndicator: {
    marginTop: theme.spacing(2),
    padding: theme.spacing(1),
    backgroundColor: theme.palette.background.default,
    borderRadius: theme.shape.borderRadius,
  },
}));

/**
 * Format action for display (handle wildcards)
 */
function formatAction(action: string): string {
  if (action === '*') return 'All';
  if (action.endsWith(':*')) {
    const category = action.slice(0, -2);
    return `${category}:*`;
  }
  return action;
}

interface RoleStepProps extends WizardStepProps {
  bindingType?: BindingType;
}

export const RoleStep = ({
  state,
  onChange,
  availableRoles,
  bindingType,
}: RoleStepProps) => {
  const classes = useStyles();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredRoles = useMemo(() => {
    if (!searchQuery) return availableRoles;
    const query = searchQuery.toLowerCase();
    return availableRoles.filter(
      role =>
        role.name.toLowerCase().includes(query) ||
        role.actions.some(a => a.toLowerCase().includes(query)),
    );
  }, [availableRoles, searchQuery]);

  const getRoleKey = (role: (typeof availableRoles)[0]) =>
    `${role.name}\0${role.namespace || ''}`;

  const selectedRoleKey = `${state.selectedRole}\0${state.selectedRoleNamespace}`;

  const handleRoleSelect = (role: (typeof availableRoles)[0]) => {
    onChange({
      selectedRole: role.name,
      selectedRoleNamespace: role.namespace || '',
    });
  };

  const selectedRoleData = availableRoles.find(
    r => getRoleKey(r) === selectedRoleKey,
  );

  const title =
    bindingType === SCOPE_CLUSTER
      ? 'Which cluster role do you want to assign?'
      : 'Which role do you want to assign?';

  // For namespace bindings, split into cluster and namespace role groups.
  // namespace present = namespace-scoped; absent/empty = cluster-scoped.
  const clusterRoles = useMemo(
    () => filteredRoles.filter(r => !r.namespace),
    [filteredRoles],
  );
  const namespaceRoles = useMemo(
    () => filteredRoles.filter(r => !!r.namespace),
    [filteredRoles],
  );

  const renderRoleCard = (role: (typeof availableRoles)[0]) => (
    <Paper
      key={getRoleKey(role)}
      className={`${classes.roleItem} ${
        getRoleKey(role) === selectedRoleKey ? classes.roleItemSelected : ''
      }`}
      onClick={() => handleRoleSelect(role)}
      elevation={0}
      variant="outlined"
    >
      <FormControlLabel
        value={getRoleKey(role)}
        control={<Radio color="primary" size="small" />}
        label={
          <Box>
            <Typography className={classes.roleName}>{role.name}</Typography>
            <Box className={classes.roleActions}>
              {role.actions.slice(0, 5).map(action => (
                <Chip
                  key={action}
                  label={formatAction(action)}
                  size="small"
                  variant="outlined"
                  className={classes.actionChip}
                />
              ))}
              {role.actions.length > 5 && (
                <Chip
                  label={`+${role.actions.length - 5} more`}
                  size="small"
                  className={classes.actionChip}
                />
              )}
            </Box>
          </Box>
        }
      />
    </Paper>
  );

  const renderGrouped = () => (
    <Box className={classes.roleList}>
      {clusterRoles.length === 0 && namespaceRoles.length === 0 ? (
        <Box className={classes.noRoles}>
          <Typography>
            {searchQuery ? 'No roles match your search' : 'No roles available'}
          </Typography>
        </Box>
      ) : (
        <>
          {namespaceRoles.length > 0 && (
            <>
              <Typography className={classes.sectionLabel}>
                Namespace Roles
              </Typography>
              {namespaceRoles.map(renderRoleCard)}
            </>
          )}
          {clusterRoles.length > 0 && (
            <>
              <Typography className={classes.sectionLabel}>
                Cluster Roles
              </Typography>
              {clusterRoles.map(renderRoleCard)}
            </>
          )}
        </>
      )}
    </Box>
  );

  const renderFlat = () => (
    <Box className={classes.roleList}>
      {filteredRoles.length === 0 ? (
        <Box className={classes.noRoles}>
          <Typography>
            {searchQuery ? 'No roles match your search' : 'No roles available'}
          </Typography>
        </Box>
      ) : (
        filteredRoles.map(renderRoleCard)
      )}
    </Box>
  );

  return (
    <Box className={classes.root}>
      <Typography variant="h6" className={classes.title}>
        {title}
      </Typography>

      <TextField
        className={classes.searchField}
        placeholder="Search roles..."
        variant="outlined"
        size="small"
        fullWidth
        value={searchQuery}
        onChange={e => setSearchQuery(e.target.value)}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon />
            </InputAdornment>
          ),
        }}
      />

      <RadioGroup value={selectedRoleKey}>
        {bindingType === SCOPE_NAMESPACE ? renderGrouped() : renderFlat()}
      </RadioGroup>

      {selectedRoleData && (
        <Box className={classes.selectedIndicator}>
          <Typography variant="body2" color="textSecondary">
            Selected: <strong>{selectedRoleData.name}</strong>
          </Typography>
        </Box>
      )}
    </Box>
  );
};
