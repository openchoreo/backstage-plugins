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
    backgroundColor: theme.palette.action.selected,
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

export const RoleStep = ({
  state,
  onChange,
  availableRoles,
}: WizardStepProps) => {
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

  const handleRoleSelect = (roleName: string) => {
    onChange({ selectedRole: roleName });
  };

  const selectedRoleData = availableRoles.find(
    r => r.name === state.selectedRole,
  );

  return (
    <Box className={classes.root}>
      <Typography variant="h6" className={classes.title}>
        Which role do you want to assign?
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

      <RadioGroup
        value={state.selectedRole}
        onChange={e => handleRoleSelect(e.target.value)}
      >
        <Box className={classes.roleList}>
          {filteredRoles.length === 0 ? (
            <Box className={classes.noRoles}>
              <Typography>
                {searchQuery
                  ? 'No roles match your search'
                  : 'No roles available'}
              </Typography>
            </Box>
          ) : (
            filteredRoles.map(role => (
              <Paper
                key={role.name}
                className={`${classes.roleItem} ${
                  state.selectedRole === role.name
                    ? classes.roleItemSelected
                    : ''
                }`}
                onClick={() => handleRoleSelect(role.name)}
                elevation={0}
                variant="outlined"
              >
                <FormControlLabel
                  value={role.name}
                  control={<Radio color="primary" size="small" />}
                  label={
                    <Box>
                      <Typography className={classes.roleName}>
                        {role.name}
                      </Typography>
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
            ))
          )}
        </Box>
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
