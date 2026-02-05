import { FieldExtensionComponentProps } from '@backstage/plugin-scaffolder-react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Radio,
  makeStyles,
  alpha,
} from '@material-ui/core';
import CodeIcon from '@material-ui/icons/Code';
import ImageIcon from '@material-ui/icons/Image';
import SettingsInputComponentIcon from '@material-ui/icons/SettingsInputComponent';

const useStyles = makeStyles(theme => ({
  container: {
    display: 'flex',
    gap: theme.spacing(2),
    marginTop: theme.spacing(1),
  },
  card: {
    flex: 1,
    cursor: 'pointer',
    transition: 'border-color 0.2s ease, background-color 0.2s ease',
    '&:hover': {
      borderColor: theme.palette.primary.light,
    },
  },
  cardSelected: {
    borderColor: theme.palette.primary.main,
    borderWidth: 2,
    backgroundColor: alpha(theme.palette.primary.main, 0.04),
  },
  cardContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    padding: theme.spacing(2),
    '&:last-child': {
      paddingBottom: theme.spacing(2),
    },
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    marginBottom: theme.spacing(1),
  },
  icon: {
    fontSize: 28,
    marginRight: theme.spacing(1.5),
    color: theme.palette.text.secondary,
  },
  iconSelected: {
    color: theme.palette.primary.main,
  },
  radio: {
    padding: 0,
    marginLeft: 'auto',
  },
  title: {
    fontWeight: 500,
  },
  description: {
    color: theme.palette.text.secondary,
    lineHeight: 1.4,
  },
}));

interface SourceOption {
  value: string;
  label: string;
  description: string;
  icon: React.ReactNode;
}

/**
 * Valid deployment source values
 */
export const DEPLOYMENT_SOURCE_VALUES: string[] = [
  'build-from-source',
  'deploy-from-image',
  'external-ci',
];

/**
 * Schema for the Deployment Source Picker Field
 */
export const DeploymentSourcePickerSchema = {
  returnValue: {
    type: 'string' as const,
    enum: DEPLOYMENT_SOURCE_VALUES,
  },
};

/**
 * DeploymentSourcePicker component
 * Allows users to choose between building from source or deploying from a pre-built image
 */
export const DeploymentSourcePicker = ({
  onChange,
  formData,
  schema,
}: FieldExtensionComponentProps<string>) => {
  const classes = useStyles();

  const sourceOptions: SourceOption[] = [
    {
      value: 'build-from-source',
      label: 'Build from Source',
      description:
        "Connect a git repository and build your application using OpenChoreo's built-in CI",
      icon: <CodeIcon className={classes.icon} />,
    },
    {
      value: 'deploy-from-image',
      label: 'Deploy from Image',
      description: 'Use an existing container image from a registry',
      icon: <ImageIcon className={classes.icon} />,
    },
    {
      value: 'external-ci',
      label: 'External CI',
      description:
        'Use Jenkins, GitHub Actions, or other CI platforms to build and deploy',
      icon: <SettingsInputComponentIcon className={classes.icon} />,
    },
  ];

  const selectedValue = formData || 'build-from-source';

  return (
    <Box>
      {schema.title && (
        <Typography variant="body1" gutterBottom>
          {schema.title}
        </Typography>
      )}
      <Box className={classes.container}>
        {sourceOptions.map(option => {
          const isSelected = selectedValue === option.value;
          return (
            <Card
              key={option.value}
              variant="outlined"
              className={`${classes.card} ${
                isSelected ? classes.cardSelected : ''
              }`}
              onClick={() => onChange(option.value)}
            >
              <CardContent className={classes.cardContent}>
                <Box className={classes.header}>
                  <Box
                    className={`${classes.icon} ${
                      isSelected ? classes.iconSelected : ''
                    }`}
                  >
                    {option.icon}
                  </Box>
                  <Typography variant="subtitle1" className={classes.title}>
                    {option.label}
                  </Typography>
                  <Radio
                    checked={isSelected}
                    className={classes.radio}
                    color="primary"
                    size="small"
                  />
                </Box>
                <Typography variant="body2" className={classes.description}>
                  {option.description}
                </Typography>
              </CardContent>
            </Card>
          );
        })}
      </Box>
    </Box>
  );
};
