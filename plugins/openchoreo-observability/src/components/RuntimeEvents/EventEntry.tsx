import { FC, MouseEvent, useState } from 'react';
import {
  TableRow,
  TableCell,
  Typography,
  Chip,
  Box,
  Collapse,
  IconButton,
  Tooltip,
} from '@material-ui/core';
import FileCopyOutlined from '@material-ui/icons/FileCopyOutlined';
import { EventEntry as EventEntryType, EventEntryField } from './types';
import { useEventEntryStyles } from './styles';

interface EventEntryProps {
  event: EventEntryType;
  selectedFields: EventEntryField[];
  environmentName?: string;
  projectName?: string;
  componentName?: string;
}

export const EventEntry: FC<EventEntryProps> = ({
  event,
  selectedFields,
  environmentName,
  projectName,
  componentName,
}) => {
  const classes = useEventEntryStyles();
  const [expanded, setExpanded] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  const handleRowClick = () => {
    setExpanded(!expanded);
  };

  const handleCopyEvent = async (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();

    if (!navigator.clipboard?.writeText) {
      return;
    }

    try {
      await navigator.clipboard.writeText(event.message ?? '');
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      // Silent fail - clipboard operation failed
    }
  };

  const getTypeChipClass = () =>
    event.type === 'Warning' ? classes.warnChip : classes.infoChip;

  const formatTimestamp = (timestamp: string): string => {
    return new Date(timestamp).toLocaleString();
  };

  const objectRef = [event.metadata?.objectKind, event.metadata?.objectName]
    .filter(Boolean)
    .join('/');

  return (
    <>
      <TableRow
        className={`${classes.eventRow} ${expanded ? classes.expandedRow : ''}`}
        onClick={handleRowClick}
      >
        {selectedFields.map(field => {
          if (field === EventEntryField.Timestamp) {
            return (
              <TableCell key={field} className={classes.monospaceCell}>
                {formatTimestamp(event.timestamp ?? '')}
              </TableCell>
            );
          }

          if (field === EventEntryField.Type) {
            return (
              <TableCell key={field}>
                {event.type ? (
                  <Chip
                    label={event.type}
                    size="small"
                    className={`${classes.typeChip} ${getTypeChipClass()}`}
                  />
                ) : null}
              </TableCell>
            );
          }

          if (field === EventEntryField.Reason) {
            return (
              <TableCell key={field} className={classes.monospaceCell}>
                {event.reason}
              </TableCell>
            );
          }

          if (field === EventEntryField.Object) {
            return (
              <TableCell key={field} className={classes.monospaceCell}>
                {objectRef}
              </TableCell>
            );
          }

          return (
            <TableCell key={field} className={classes.messageCell}>
              <Box className={classes.messageCellContent}>
                <Box className={classes.messageTextContainer}>
                  <Typography
                    className={`${classes.eventMessage} ${
                      expanded ? classes.expandedEventMessage : ''
                    }`}
                  >
                    {event.message}
                  </Typography>
                </Box>
                <Box
                  className={`${classes.eventActionColumn} ${classes.hoverActionButton}`}
                >
                  <Tooltip
                    title={copySuccess ? 'Copied!' : 'Copy event message'}
                  >
                    <IconButton
                      className={classes.copyButton}
                      onClick={handleCopyEvent}
                      size="small"
                    >
                      <FileCopyOutlined fontSize="inherit" />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>
            </TableCell>
          );
        })}
      </TableRow>

      {expanded && (
        <TableRow>
          <TableCell
            colSpan={selectedFields.length}
            style={{ paddingBottom: 0, paddingTop: 0 }}
          >
            <Collapse in={expanded} timeout="auto" unmountOnExit>
              <Box className={classes.expandedContent}>
                <Typography
                  className={classes.expandedSectionTitle}
                  gutterBottom
                >
                  Event Message
                </Typography>
                <Box className={classes.fullEventMessage}>{event.message}</Box>

                <Box className={classes.metadataSection}>
                  <Typography
                    className={`${classes.metadataTitle} ${classes.expandedSectionTitle}`}
                  >
                    Metadata
                  </Typography>

                  <Box className={classes.metadataBox}>
                    <Box className={classes.metadataGrid}>
                      <Box className={classes.metadataItem}>
                        <span className={classes.metadataKey}>Type:</span>
                        <span className={classes.metadataValue}>
                          {event.type}
                        </span>
                      </Box>

                      <Box className={classes.metadataItem}>
                        <span className={classes.metadataKey}>Reason:</span>
                        <span className={classes.metadataValue}>
                          {event.reason}
                        </span>
                      </Box>

                      <Box className={classes.metadataItem}>
                        <span className={classes.metadataKey}>
                          Object Kind:
                        </span>
                        <span className={classes.metadataValue}>
                          {event.metadata?.objectKind}
                        </span>
                      </Box>

                      <Box className={classes.metadataItem}>
                        <span className={classes.metadataKey}>
                          Object Name:
                        </span>
                        <span className={classes.metadataValue}>
                          {event.metadata?.objectName}
                        </span>
                      </Box>

                      <Box className={classes.metadataItem}>
                        <span className={classes.metadataKey}>
                          Object Namespace:
                        </span>
                        <span className={classes.metadataValue}>
                          {event.metadata?.objectNamespace}
                        </span>
                      </Box>

                      <Box className={classes.metadataItem}>
                        <span className={classes.metadataKey}>
                          Component Name:
                        </span>
                        <span className={classes.metadataValue}>
                          {event.metadata?.componentName ?? componentName}
                        </span>
                      </Box>

                      <Box className={classes.metadataItem}>
                        <span className={classes.metadataKey}>
                          Component UID:
                        </span>
                        <span className={classes.metadataValue}>
                          {event.metadata?.componentUid}
                        </span>
                      </Box>

                      <Box className={classes.metadataItem}>
                        <span className={classes.metadataKey}>
                          Project Name:
                        </span>
                        <span className={classes.metadataValue}>
                          {event.metadata?.projectName ?? projectName}
                        </span>
                      </Box>

                      <Box className={classes.metadataItem}>
                        <span className={classes.metadataKey}>
                          Project UID:
                        </span>
                        <span className={classes.metadataValue}>
                          {event.metadata?.projectUid}
                        </span>
                      </Box>

                      <Box className={classes.metadataItem}>
                        <span className={classes.metadataKey}>
                          Environment Name:
                        </span>
                        <span className={classes.metadataValue}>
                          {event.metadata?.environmentName ?? environmentName}
                        </span>
                      </Box>

                      <Box className={classes.metadataItem}>
                        <span className={classes.metadataKey}>
                          Environment UID:
                        </span>
                        <span className={classes.metadataValue}>
                          {event.metadata?.environmentUid}
                        </span>
                      </Box>

                      <Box className={classes.metadataItem}>
                        <span className={classes.metadataKey}>Namespace:</span>
                        <span className={classes.metadataValue}>
                          {event.metadata?.namespaceName}
                        </span>
                      </Box>
                    </Box>
                  </Box>
                </Box>
              </Box>
            </Collapse>
          </TableCell>
        </TableRow>
      )}
    </>
  );
};
