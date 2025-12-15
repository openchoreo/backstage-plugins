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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormLabel,
  Divider,
  IconButton,
  CircularProgress,
} from '@material-ui/core';
import { Autocomplete } from '@material-ui/lab';
import { makeStyles } from '@material-ui/core/styles';
import AddIcon from '@material-ui/icons/Add';
import RemoveIcon from '@material-ui/icons/Remove';
import {
  useUserTypes,
  useOrganizations,
  useProjects,
  useComponents,
  Role,
  RoleEntitlementMapping,
  PolicyEffect,
} from '../hooks';

const useStyles = makeStyles(theme => ({
  section: {
    marginBottom: theme.spacing(3),
  },
  sectionTitle: {
    marginBottom: theme.spacing(1),
  },
  formField: {
    marginBottom: theme.spacing(2),
  },
  hierarchySection: {
    padding: theme.spacing(2),
    backgroundColor: theme.palette.background.default,
    borderRadius: theme.shape.borderRadius,
  },
  orgUnitsContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
  },
  orgUnitRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  addOrgUnitButton: {
    marginTop: theme.spacing(1),
  },
  conditionsSection: {
    padding: theme.spacing(2),
    backgroundColor: theme.palette.background.default,
    borderRadius: theme.shape.borderRadius,
  },
  conditionRow: {
    display: 'flex',
    gap: theme.spacing(1),
    marginBottom: theme.spacing(1),
    alignItems: 'center',
  },
  effectSection: {
    marginTop: theme.spacing(2),
  },
}));

interface Condition {
  key: string;
  operator: string;
  value: string;
}

interface MappingDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (mapping: RoleEntitlementMapping) => Promise<void>;
  availableRoles: Role[];
}

export const MappingDialog = ({
  open,
  onClose,
  onSave,
  availableRoles,
}: MappingDialogProps) => {
  const classes = useStyles();
  const { userTypes } = useUserTypes();

  // Form state
  const [selectedRole, setSelectedRole] = useState('');
  const [selectedUserType, setSelectedUserType] = useState('');
  const [entitlementValue, setEntitlementValue] = useState('');
  const [organization, setOrganization] = useState('');
  const [orgUnits, setOrgUnits] = useState<string[]>([]);
  const [project, setProject] = useState('');
  const [component, setComponent] = useState('');
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [effect, setEffect] = useState<PolicyEffect>('allow');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hierarchy data hooks (after state so we can use org/project values)
  const { organizations, loading: orgsLoading } = useOrganizations();
  const { projects, loading: projectsLoading } = useProjects(
    organization || undefined,
  );
  const { components, loading: componentsLoading } = useComponents(
    organization || undefined,
    project || undefined,
  );

  // Get the entitlement claim based on selected user type
  const selectedUserTypeInfo = userTypes.find(
    ut => ut.type === selectedUserType,
  );
  const entitlementClaim = selectedUserTypeInfo?.entitlement.name || '';

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedRole('');
      setSelectedUserType(userTypes[0]?.type || '');
      setEntitlementValue('');
      setOrganization('');
      setOrgUnits([]);
      setProject('');
      setComponent('');
      setConditions([]);
      setEffect('allow');
      setError(null);
    }
  }, [open, userTypes]);

  // Cascade handlers - clear dependent fields when parent changes
  const handleOrganizationChange = (value: string | null) => {
    setOrganization(value || '');
    setProject(''); // Reset project when org changes
    setComponent(''); // Reset component when org changes
  };

  const handleProjectChange = (value: string | null) => {
    setProject(value || '');
    setComponent(''); // Reset component when project changes
  };

  const handleAddOrgUnit = () => {
    setOrgUnits([...orgUnits, '']);
  };

  const handleRemoveOrgUnit = (index: number) => {
    setOrgUnits(orgUnits.filter((_, i) => i !== index));
  };

  const handleOrgUnitChange = (index: number, value: string) => {
    const updated = [...orgUnits];
    updated[index] = value;
    setOrgUnits(updated);
  };

  const handleAddCondition = () => {
    setConditions([...conditions, { key: '', operator: '==', value: '' }]);
  };

  const handleRemoveCondition = (index: number) => {
    setConditions(conditions.filter((_, i) => i !== index));
  };

  const handleConditionChange = (
    index: number,
    field: keyof Condition,
    value: string,
  ) => {
    const updated = [...conditions];
    updated[index] = { ...updated[index], [field]: value };
    setConditions(updated);
  };

  const handleSave = async () => {
    if (!selectedRole) {
      setError('Please select a role');
      return;
    }

    if (!entitlementClaim || !entitlementValue.trim()) {
      setError('Please provide an entitlement value');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const mapping: RoleEntitlementMapping = {
        role_name: selectedRole,
        entitlement: {
          claim: entitlementClaim,
          value: entitlementValue.trim(),
        },
        hierarchy: {
          organization: organization || undefined,
          organization_units: orgUnits.filter(u => u.trim()) || undefined,
          project: project || undefined,
          component: component || undefined,
        },
        effect,
        context:
          conditions.length > 0
            ? conditions.reduce(
                (acc, cond) => ({
                  ...acc,
                  [cond.key]: { [cond.operator]: cond.value },
                }),
                {},
              )
            : undefined,
      };

      await onSave(mapping);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save mapping');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Create Role Mapping</DialogTitle>
      <DialogContent>
        {/* Role Selection */}
        <Box className={classes.section}>
          <FormControl fullWidth className={classes.formField}>
            <InputLabel>Role</InputLabel>
            <Select
              value={selectedRole}
              onChange={e => setSelectedRole(e.target.value as string)}
              label="Role"
            >
              {availableRoles.map(role => (
                <MenuItem key={role.name} value={role.name}>
                  {role.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        <Divider />

        {/* Entitlement Section */}
        <Box className={classes.section}>
          <Typography variant="subtitle1" className={classes.sectionTitle}>
            Entitlement (Who gets this role?)
          </Typography>

          <FormControl fullWidth className={classes.formField}>
            <InputLabel>Subject Type</InputLabel>
            <Select
              value={selectedUserType}
              onChange={e => setSelectedUserType(e.target.value as string)}
              label="Subject Type"
            >
              {userTypes.map(ut => (
                <MenuItem key={ut.type} value={ut.type}>
                  {ut.display_name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            fullWidth
            className={classes.formField}
            label={`${entitlementClaim || 'Entitlement'} Value`}
            value={entitlementValue}
            onChange={e => setEntitlementValue(e.target.value)}
            placeholder={
              selectedUserType === 'user'
                ? 'e.g., platform-team'
                : 'e.g., ci-bot-123'
            }
            helperText={
              selectedUserTypeInfo
                ? `JWT claim: ${entitlementClaim}`
                : 'Select a subject type first'
            }
          />
        </Box>

        <Divider />

        {/* Hierarchy Section */}
        <Box className={classes.section}>
          <Typography variant="subtitle1" className={classes.sectionTitle}>
            Scope (Where does this apply?)
          </Typography>

          <Box className={classes.hierarchySection}>
            <Autocomplete
              freeSolo
              options={organizations.map(o => o.name)}
              value={organization}
              onChange={(_, value) => handleOrganizationChange(value)}
              onInputChange={(_, value, reason) => {
                if (reason === 'input') {
                  handleOrganizationChange(value);
                }
              }}
              loading={orgsLoading}
              renderInput={params => (
                <TextField
                  {...params}
                  fullWidth
                  className={classes.formField}
                  label="Organization"
                  placeholder="Leave empty for default organization"
                  size="small"
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {orgsLoading ? (
                          <CircularProgress color="inherit" size={20} />
                        ) : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
            />

            <Typography variant="body2" color="textSecondary" gutterBottom>
              Organization Units (multi-level hierarchy):
            </Typography>
            <Box className={classes.orgUnitsContainer}>
              {orgUnits.map((unit, index) => (
                <Box key={index} className={classes.orgUnitRow}>
                  <TextField
                    size="small"
                    value={unit}
                    onChange={e => handleOrgUnitChange(index, e.target.value)}
                    placeholder={`Level ${index + 1}`}
                    fullWidth
                  />
                  <IconButton
                    size="small"
                    onClick={() => handleRemoveOrgUnit(index)}
                  >
                    <RemoveIcon />
                  </IconButton>
                </Box>
              ))}
              <Button
                size="small"
                startIcon={<AddIcon />}
                onClick={handleAddOrgUnit}
                className={classes.addOrgUnitButton}
              >
                Add Org Unit
              </Button>
            </Box>

            <Autocomplete
              freeSolo
              options={projects.map(p => p.name)}
              value={project}
              onChange={(_, value) => handleProjectChange(value)}
              onInputChange={(_, value, reason) => {
                if (reason === 'input') {
                  handleProjectChange(value);
                }
              }}
              disabled={!organization}
              loading={projectsLoading}
              renderInput={params => (
                <TextField
                  {...params}
                  fullWidth
                  className={classes.formField}
                  label="Project"
                  placeholder={
                    organization
                      ? 'Leave empty to apply to all projects'
                      : 'Select an organization first'
                  }
                  size="small"
                  style={{ marginTop: 16 }}
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {projectsLoading ? (
                          <CircularProgress color="inherit" size={20} />
                        ) : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
            />

            <Autocomplete
              freeSolo
              options={components.map(c => c.name)}
              value={component}
              onChange={(_, value) => setComponent(value || '')}
              onInputChange={(_, value, reason) => {
                if (reason === 'input') {
                  setComponent(value);
                }
              }}
              disabled={!project}
              loading={componentsLoading}
              renderInput={params => (
                <TextField
                  {...params}
                  fullWidth
                  className={classes.formField}
                  label="Component"
                  placeholder={
                    project
                      ? 'Leave empty to apply to all components'
                      : 'Select a project first'
                  }
                  size="small"
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {componentsLoading ? (
                          <CircularProgress color="inherit" size={20} />
                        ) : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
            />
          </Box>
        </Box>

        <Divider />

        {/* Conditions Section */}
        <Box className={classes.section}>
          <Typography variant="subtitle1" className={classes.sectionTitle}>
            Conditions (Optional instance-level constraints)
          </Typography>

          <Box className={classes.conditionsSection}>
            {conditions.map((condition, index) => (
              <Box key={index} className={classes.conditionRow}>
                <TextField
                  size="small"
                  value={condition.key}
                  onChange={e =>
                    handleConditionChange(index, 'key', e.target.value)
                  }
                  placeholder="resource.env"
                  style={{ flex: 2 }}
                />
                <Select
                  value={condition.operator}
                  onChange={e =>
                    handleConditionChange(
                      index,
                      'operator',
                      e.target.value as string,
                    )
                  }
                  style={{ flex: 1 }}
                  variant="outlined"
                >
                  <MenuItem value="==">==</MenuItem>
                  <MenuItem value="!=">!=</MenuItem>
                  <MenuItem value="in">in</MenuItem>
                </Select>
                <TextField
                  size="small"
                  value={condition.value}
                  onChange={e =>
                    handleConditionChange(index, 'value', e.target.value)
                  }
                  placeholder="dev"
                  style={{ flex: 2 }}
                />
                <IconButton
                  size="small"
                  onClick={() => handleRemoveCondition(index)}
                >
                  <RemoveIcon />
                </IconButton>
              </Box>
            ))}
            <Button
              size="small"
              startIcon={<AddIcon />}
              onClick={handleAddCondition}
            >
              Add Condition
            </Button>
          </Box>
        </Box>

        <Divider />

        {/* Effect Section */}
        <Box className={classes.effectSection}>
          <FormControl component="fieldset">
            <FormLabel component="legend">Effect</FormLabel>
            <RadioGroup
              row
              value={effect}
              onChange={e => setEffect(e.target.value as PolicyEffect)}
            >
              <FormControlLabel
                value="allow"
                control={<Radio />}
                label="Allow"
              />
              <FormControlLabel value="deny" control={<Radio />} label="Deny" />
            </RadioGroup>
          </FormControl>
        </Box>

        {error && (
          <Typography color="error" variant="body2" style={{ marginTop: 16 }}>
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
          {saving ? 'Creating...' : 'Create Mapping'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
