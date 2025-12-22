import {
  Box,
  Typography,
  TextField,
  Paper,
  Radio,
  RadioGroup,
  FormControlLabel,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import PersonIcon from '@material-ui/icons/Person';
import SettingsIcon from '@material-ui/icons/Settings';
import { WizardStepProps } from './types';
import { getEntitlementClaim } from '../../hooks';

const useStyles = makeStyles(theme => ({
  root: {
    minHeight: 350,
  },
  title: {
    marginBottom: theme.spacing(2),
  },
  subtitle: {
    marginBottom: theme.spacing(3),
    color: theme.palette.text.secondary,
  },
  typeCards: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    marginBottom: theme.spacing(3),
  },
  typeCard: {
    padding: theme.spacing(2),
    cursor: 'pointer',
    transition: 'all 0.2s',
    display: 'flex',
    alignItems: 'flex-start',
    gap: theme.spacing(2),
    '&:hover': {
      backgroundColor: theme.palette.action.hover,
    },
  },
  typeCardSelected: {
    backgroundColor: theme.palette.action.selected,
    borderColor: theme.palette.primary.main,
    borderWidth: 2,
  },
  typeIcon: {
    marginTop: theme.spacing(0.5),
    color: theme.palette.text.secondary,
  },
  typeContent: {
    flex: 1,
  },
  typeName: {
    fontWeight: 500,
  },
  typeDescription: {
    color: theme.palette.text.secondary,
    fontSize: '0.875rem',
  },
  valueSection: {
    marginTop: theme.spacing(3),
  },
  valueLabel: {
    marginBottom: theme.spacing(1),
  },
  claimHint: {
    marginTop: theme.spacing(0.5),
    color: theme.palette.text.secondary,
    fontSize: '0.75rem',
  },
  infoBox: {
    marginTop: theme.spacing(3),
    padding: theme.spacing(2),
    backgroundColor: theme.palette.info.light,
    borderRadius: theme.shape.borderRadius,
    '& p': {
      margin: 0,
      color: theme.palette.info.contrastText,
      fontSize: '0.875rem',
    },
  },
}));

/**
 * Get icon for user type
 */
function getTypeIcon(type: string) {
  switch (type) {
    case 'user':
      return <PersonIcon />;
    case 'service_account':
    default:
      return <SettingsIcon />;
  }
}

/**
 * Get description for user type
 */
function getTypeDescription(type: string): string {
  switch (type) {
    case 'user':
      return 'Human users authenticated via identity provider';
    case 'service_account':
      return 'Service accounts, bots, and automated processes';
    default:
      return '';
  }
}

export const SubjectStep = ({
  state,
  onChange,
  userTypes,
}: WizardStepProps) => {
  const classes = useStyles();

  const selectedUserTypeInfo = userTypes.find(
    ut => ut.type === state.subjectType,
  );
  const entitlementClaim = getEntitlementClaim(selectedUserTypeInfo);

  const handleTypeChange = (type: string) => {
    onChange({ subjectType: type });
  };

  const handleValueChange = (value: string) => {
    onChange({ entitlementValue: value });
  };

  const getPlaceholder = () => {
    switch (state.subjectType) {
      case 'user':
        return 'e.g., platform-team';
      case 'service_account':
        return 'e.g., ci-bot-123';
      default:
        return 'Enter value';
    }
  };

  const getValueLabel = () => {
    if (selectedUserTypeInfo) {
      return `${selectedUserTypeInfo.displayName} Identifier`;
    }
    return 'Identifier';
  };

  return (
    <Box className={classes.root}>
      <Typography variant="h6" className={classes.title}>
        Who should receive the "{state.selectedRole}" role?
      </Typography>

      <Typography variant="body2" className={classes.subtitle}>
        Select the type of subject and provide their identifier
      </Typography>

      <Typography variant="subtitle2" gutterBottom>
        Subject Type
      </Typography>

      <RadioGroup
        value={state.subjectType}
        onChange={e => handleTypeChange(e.target.value)}
      >
        <Box className={classes.typeCards}>
          {userTypes.map(userType => (
            <Paper
              key={userType.type}
              variant="outlined"
              className={`${classes.typeCard} ${
                state.subjectType === userType.type
                  ? classes.typeCardSelected
                  : ''
              }`}
              onClick={() => handleTypeChange(userType.type)}
            >
              <Box className={classes.typeIcon}>
                {getTypeIcon(userType.type)}
              </Box>
              <Box className={classes.typeContent}>
                <FormControlLabel
                  value={userType.type}
                  control={<Radio color="primary" size="small" />}
                  label={
                    <Box>
                      <Typography className={classes.typeName}>
                        {userType.displayName}
                      </Typography>
                      <Typography className={classes.typeDescription}>
                        {getTypeDescription(userType.type)}
                      </Typography>
                    </Box>
                  }
                />
              </Box>
            </Paper>
          ))}
        </Box>
      </RadioGroup>

      <Box className={classes.valueSection}>
        <Typography variant="subtitle2" className={classes.valueLabel}>
          {getValueLabel()}
        </Typography>

        <TextField
          fullWidth
          variant="outlined"
          size="small"
          value={state.entitlementValue}
          onChange={e => handleValueChange(e.target.value)}
          placeholder={getPlaceholder()}
        />

        {entitlementClaim && (
          <Typography className={classes.claimHint}>
            JWT claim: <code>{entitlementClaim}</code>
          </Typography>
        )}
      </Box>

      {state.subjectType && state.entitlementValue && (
        <Box className={classes.infoBox}>
          <Typography>
            This will map the "{state.selectedRole}" role to any request where{' '}
            <strong>
              {entitlementClaim} = "{state.entitlementValue}"
            </strong>
          </Typography>
        </Box>
      )}
    </Box>
  );
};
