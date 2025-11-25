import {
  TextField,
  Button,
  Card,
  CardContent,
  CardHeader,
  IconButton,
  Grid,
  Typography,
  Box,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import DeleteIcon from '@material-ui/icons/Delete';
import AddIcon from '@material-ui/icons/Add';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import { Container, EnvVar } from '@openchoreo/backstage-plugin-common';
import { useBuilds } from '../WorkloadContext';
import { ImageSelector } from './ImageSelector';
import { EnvVarRow } from './EnvVarRow';

interface ContainerSectionProps {
  containers: { [key: string]: Container };
  onContainerChange: (
    containerName: string,
    field: keyof Container,
    value: string | string[],
  ) => void;
  onEnvVarChange: (
    containerName: string,
    envIndex: number,
    field: keyof EnvVar,
    value: string,
  ) => void;
  onAddContainer: () => void;
  onRemoveContainer: (containerName: string) => void;
  onAddEnvVar: (containerName: string) => void;
  onRemoveEnvVar: (containerName: string, envIndex: number) => void;
  onArrayFieldChange: (
    containerName: string,
    field: 'command' | 'args',
    value: string,
  ) => void;
  disabled: boolean;
  singleContainerMode: boolean;
}

const useStyles = makeStyles(theme => ({
  accordion: {
    border: 'none',
    marginBottom: theme.spacing(0),
    borderRadius: 8,
    boxShadow: 'none',
    backgroundColor: 'transparent',
    '&:before': { backgroundColor: 'transparent' },
  },
  containerCard: {
    padding: theme.spacing(0),
    marginBottom: theme.spacing(2),
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 8,
    backgroundColor: theme.palette.background.paper,
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  },
  addButton: {
    marginTop: theme.spacing(1),
  },
  envVarContainer: {
    padding: theme.spacing(1.5),
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 6,
    marginBottom: theme.spacing(1),
    backgroundColor: theme.palette.background.default,
  },
}));

export function ContainerSection({
  containers,
  onContainerChange,
  onEnvVarChange,
  onAddContainer,
  onRemoveContainer,
  onAddEnvVar,
  onRemoveEnvVar,
  onArrayFieldChange,
  disabled,
  singleContainerMode,
}: ContainerSectionProps) {
  const classes = useStyles();
  const { builds } = useBuilds();

  const containerEntries = Object.entries(containers);
  const showAddButton = !singleContainerMode || containerEntries.length === 0;

  return (
    <Accordion className={classes.accordion} defaultExpanded>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="h6">
          Containers ({containerEntries.length})
        </Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Box width="100%">
          {containerEntries.map(([containerName, container]) => (
            <Card key={containerName} className={classes.containerCard}>
              <CardHeader
                style={{ paddingBottom: 8 }}
                title={
                  <Box
                    display="flex"
                    alignItems="center"
                    justifyContent="space-between"
                  >
                    <Typography variant="subtitle1" style={{ fontWeight: 600 }}>
                      {containerName === 'main' ? 'app' : containerName}
                    </Typography>
                    <IconButton
                      onClick={() => onRemoveContainer(containerName)}
                      color="secondary"
                      size="small"
                      disabled={disabled}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                }
              />
              <CardContent style={{ paddingTop: 8 }}>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <Box mb={2}>
                      <ImageSelector
                        image={container.image}
                        builds={builds}
                        disabled={disabled}
                        onChange={value =>
                          onContainerChange(containerName, 'image', value)
                        }
                      />
                    </Box>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      label="Command"
                      value={container.command?.join(', ') || ''}
                      onChange={e =>
                        onArrayFieldChange(
                          containerName,
                          'command',
                          e.target.value,
                        )
                      }
                      fullWidth
                      variant="outlined"
                      placeholder="Comma-separated commands"
                      helperText="Separate multiple commands with commas"
                      disabled={disabled}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      label="Arguments"
                      value={container.args?.join(', ') || ''}
                      onChange={e =>
                        onArrayFieldChange(
                          containerName,
                          'args',
                          e.target.value,
                        )
                      }
                      fullWidth
                      variant="outlined"
                      placeholder="Comma-separated arguments"
                      helperText="Separate multiple arguments with commas"
                      disabled={disabled}
                    />
                  </Grid>
                </Grid>

                {/* Environment Variables */}
                <Box mt={3}>
                  <Typography
                    variant="subtitle2"
                    gutterBottom
                    style={{ fontWeight: 600 }}
                  >
                    Environment Variables
                  </Typography>
                  {container.env?.map((envVar, index) => (
                    <EnvVarRow
                      key={index}
                      envVar={envVar}
                      index={index}
                      containerName={containerName}
                      disabled={disabled}
                      className={classes.envVarContainer}
                      onEnvVarChange={onEnvVarChange}
                      onRemoveEnvVar={onRemoveEnvVar}
                    />
                  ))}
                  <Button
                    startIcon={<AddIcon />}
                    onClick={() => onAddEnvVar(containerName)}
                    variant="outlined"
                    size="small"
                    className={classes.addButton}
                    disabled={disabled}
                    color="primary"
                  >
                    Add Environment Variable
                  </Button>
                </Box>
              </CardContent>
            </Card>
          ))}

          {showAddButton && (
            <Button
              startIcon={<AddIcon />}
              onClick={onAddContainer}
              variant="contained"
              color="primary"
              className={classes.addButton}
              disabled={disabled}
            >
              Add Container
            </Button>
          )}
        </Box>
      </AccordionDetails>
    </Accordion>
  );
}
