import { FC, useState } from 'react';
import {
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
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
  FormControlLabel,
  Checkbox,
} from '@material-ui/core';
import DeleteIcon from '@material-ui/icons/Delete';
import AddIcon from '@material-ui/icons/Add';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import { WorkloadEndpoint } from '@openchoreo/backstage-plugin-api';
import { useWorkloadEditorStyles } from './styles';

interface EndpointSectionProps {
  endpoints: { [key: string]: WorkloadEndpoint };
  onEndpointChange: (
    endpointName: string,
    field: keyof WorkloadEndpoint,
    value: any,
  ) => void;
  onAddEndpoint: () => void;
  onRemoveEndpoint: (endpointName: string) => void;
  disabled: boolean;
}

const protocolTypes = [
  'TCP',
  'UDP',
  'HTTP',
  'REST',
  'gRPC',
  'Websocket',
  'GraphQL',
];

export const EndpointSection: FC<EndpointSectionProps> = ({
  endpoints,
  onEndpointChange,
  onAddEndpoint,
  onRemoveEndpoint,
  disabled,
}) => {
  const classes = useWorkloadEditorStyles();
  const [showSchemaFor, setShowSchemaFor] = useState<{ [key: string]: boolean }>({});

  const handleShowSchemaChange = (endpointName: string, show: boolean) => {
    setShowSchemaFor(prev => ({
      ...prev,
      [endpointName]: show,
    }));
  };

  return (
    <Accordion className={classes.accordion} variant="outlined">
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="body1">
          Endpoints & API Specification ({Object.keys(endpoints).length})
        </Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Box width="100%">
          {Object.entries(endpoints).map(([endpointName, endpoint]) => (
            <Card key={endpointName} className={classes.dynamicFieldContainer}>
              <CardHeader
                title={
                  <Box className={classes.flexBetween}>
                    <Typography variant="subtitle1">{endpointName}</Typography>
                    <IconButton
                      onClick={() => onRemoveEndpoint(endpointName)}
                      color="secondary"
                      size="small"
                      disabled={disabled}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                }
              />
              <CardContent>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth variant="outlined">
                      <InputLabel>Type</InputLabel>
                      <Select
                        disabled={disabled}
                        value={endpoint.type}
                        onChange={e =>
                          onEndpointChange(endpointName, 'type', e.target.value)
                        }
                        label="Type"
                      >
                        {protocolTypes.map(type => (
                          <MenuItem key={type} value={type}>
                            {type}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      label="Port"
                      type="number"
                      value={endpoint.port}
                      onChange={e =>
                        onEndpointChange(
                          endpointName,
                          'port',
                          parseInt(e.target.value, 10),
                        )
                      }
                      fullWidth
                      variant="outlined"
                      required
                      disabled={disabled}
                    />
                  </Grid>
                  {(endpoint?.type === 'REST' || endpoint?.type === 'gRPC') && (
                    <Grid item xs={12}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={showSchemaFor[endpointName] || false}
                            onChange={e =>
                              handleShowSchemaChange(endpointName, e.target.checked)
                            }
                            disabled={disabled}
                            color="primary"
                          />
                        }
                        label="Show API Specification"
                      />
                    </Grid>
                  )}
                  {(endpoint?.type === 'REST' || endpoint?.type === 'gRPC') && 
                   showSchemaFor[endpointName] && (
                    <Grid item xs={12}>
                      <TextField
                        label="Schema Content"
                        value={endpoint.schema?.content || ''}
                        onChange={e =>
                          onEndpointChange(endpointName, 'schema', {
                            ...endpoint.schema,
                            content: e.target.value,
                            type: endpoint.type,
                          })
                        }
                        fullWidth
                        variant="outlined"
                        multiline
                        placeholder="Enter schema definition (OpenAPI, GraphQL schema, protobuf, etc.)"
                        helperText="Optional: Provide the actual schema definition"
                        disabled={disabled}
                        inputProps={{
                          style: {
                            fontFamily: 'monospace',

                          },
                        }}
                      />
                    </Grid>
                  )}
                </Grid>
              </CardContent>
            </Card>
          ))}
          <Button
            startIcon={<AddIcon />}
            onClick={onAddEndpoint}
            variant="contained"
            color="primary"
            className={classes.addButton}
            disabled={disabled}
          >
            Add Endpoint
          </Button>
        </Box>
      </AccordionDetails>
    </Accordion>
  );
};
