import { FC } from 'react';
import { Button, Box } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import AddIcon from '@material-ui/icons/Add';
import { Connection } from '@openchoreo/backstage-plugin-common';
import { ConnectionItem } from './ConnectionItem';

interface ConnectionContentProps {
  connections: { [key: string]: Connection };
  onConnectionChange: (connectionName: string, connection: Connection) => void;
  onAddConnection: () => void;
  onRemoveConnection: (connectionName: string) => void;
  disabled: boolean;
}

const useStyles = makeStyles(theme => ({
  addButton: {
    marginTop: theme.spacing(1),
  },
}));

export const ConnectionContent: FC<ConnectionContentProps> = ({
  connections,
  onConnectionChange,
  onAddConnection,
  onRemoveConnection,
  disabled,
}) => {
  const classes = useStyles();

  return (
    <Box>
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
        variant="outlined"
        color="primary"
        className={classes.addButton}
        disabled={disabled}
      >
        Add Connection
      </Button>
    </Box>
  );
};
