import { FC } from 'react';
import {
  Button,
  Typography,
  Box,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@material-ui/core';
import AddIcon from '@material-ui/icons/Add';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import { Connection } from '@openchoreo/backstage-plugin-api';
import { ConnectionItem } from './ConnectionItem';
import { useWorkloadEditorStyles } from './styles';

interface ConnectionSectionProps {
  connections: { [key: string]: Connection };
  onConnectionChange: (connectionName: string, connection: Connection) => void;
  onAddConnection: () => void;
  onRemoveConnection: (connectionName: string) => void;
  disabled: boolean;
}

export const ConnectionSection: FC<ConnectionSectionProps> = ({
  connections,
  onConnectionChange,
  onAddConnection,
  onRemoveConnection,
  disabled,
}) => {
  const classes = useWorkloadEditorStyles();

  return (
    <Accordion className={classes.accordion} variant="outlined">
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="body1">
          Connections ({Object.keys(connections).length})
        </Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Box width="100%">
          {Object.entries(connections).map(([connectionName, connection]) => (
            <ConnectionItem
              key={connectionName}
              connectionName={connectionName}
              connection={connection}
              onConnectionChange={onConnectionChange}
              onRemoveConnection={onRemoveConnection}
              disabled={disabled}
            />
          ))}
          <Button
            startIcon={<AddIcon />}
            onClick={onAddConnection}
            variant="contained"
            color="primary"
            className={classes.addButton}
            disabled={disabled}
          >
            Add Connection
          </Button>
        </Box>
      </AccordionDetails>
    </Accordion>
  );
};
