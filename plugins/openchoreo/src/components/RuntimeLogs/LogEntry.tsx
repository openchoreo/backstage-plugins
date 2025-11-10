import React, { FC, MouseEvent, useState } from 'react';
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
import ExpandMore from '@material-ui/icons/ExpandMore';
import ExpandLess from '@material-ui/icons/ExpandLess';
import FileCopy from '@material-ui/icons/FileCopy';
import { LogEntry as LogEntryType, LogEntryField } from './types';
import { useLogEntryStyles } from './styles';

interface LogEntryProps {
  log: LogEntryType;
  selectedFields: LogEntryField[];
}

export const LogEntry: FC<LogEntryProps> = ({ log, selectedFields }) => {
  const classes = useLogEntryStyles();
  const [expanded, setExpanded] = useState(false);

  const getLogLevelChipClass = (level: string) => {
    switch (level) {
      case 'ERROR':
        return classes.errorChip;
      case 'WARN':
        return classes.warnChip;
      case 'INFO':
        return classes.infoChip;
      case 'DEBUG':
        return classes.debugChip;
      case 'UNDEFINED':
        return classes.undefinedChip;
      default:
        return '';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const truncatePodId = (podId: string) => {
    return podId.length > 8 ? `${podId.substring(0, 8)}...` : podId;
  };

  const handleCopyLog = (event: MouseEvent) => {
    event.stopPropagation();
    navigator.clipboard.writeText(log.log).catch(_ => {
      // TODO: Add error handling
    });
  };

  const handleRowClick = () => {
    setExpanded(!expanded);
  };

  const renderFieldCell = (field: LogEntryField) => {
    switch (field) {
      case LogEntryField.Timestamp:
        return (
          <TableCell className={classes.timestampCell}>
            {formatTimestamp(log.timestamp)}
          </TableCell>
        );

      case LogEntryField.LogLevel:
        return (
          <TableCell>
            <Chip
              label={log.logLevel}
              size="small"
              className={`${classes.logLevelChip} ${getLogLevelChipClass(
                log.logLevel,
              )}`}
            />
          </TableCell>
        );

      case LogEntryField.Log:
        return (
          <TableCell className={classes.logCell}>
            <Box display="flex" alignItems="center">
              <Typography
                className={`${classes.logMessage} ${
                  expanded ? classes.expandedLogMessage : ''
                }`}
              >
                {log.log}
              </Typography>
              <Tooltip title="Copy log message">
                <IconButton
                  className={classes.copyButton}
                  onClick={handleCopyLog}
                  size="small"
                >
                  <FileCopy fontSize="inherit" />
                </IconButton>
              </Tooltip>
            </Box>
          </TableCell>
        );

      case LogEntryField.Container:
        return (
          <TableCell className={classes.containerCell}>
            {log.containerName}
          </TableCell>
        );

      case LogEntryField.Pod:
        return (
          <TableCell className={classes.podCell}>
            <Tooltip title={log.podId}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
                {truncatePodId(log.podId)}
              </span>
            </Tooltip>
          </TableCell>
        );

      default:
        return <TableCell />;
    }
  };

  const totalColumns = selectedFields.length + 1; // +1 for Details column

  return (
    <>
      <TableRow
        className={`${classes.logRow} ${expanded ? classes.expandedRow : ''}`}
        onClick={handleRowClick}
      >
        {selectedFields.map((field) => (
          <React.Fragment key={field}>
            {renderFieldCell(field)}
          </React.Fragment>
        ))}
        <TableCell>
          <IconButton
            className={classes.expandButton}
            size="small"
            onClick={e => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
          >
            {expanded ? <ExpandLess /> : <ExpandMore />}
          </IconButton>
        </TableCell>
      </TableRow>

      {expanded && (
        <TableRow>
          <TableCell colSpan={totalColumns} style={{ paddingBottom: 0, paddingTop: 0 }}>
            <Collapse in={expanded} timeout="auto" unmountOnExit>
              <Box className={classes.expandedContent}>
                <Typography variant="h6" gutterBottom>
                  Full Log Message
                </Typography>
                <Box className={classes.fullLogMessage}>{log.log}</Box>

                <Box className={classes.metadataSection}>
                  <Typography variant="h6" className={classes.metadataTitle}>
                    Metadata
                  </Typography>

                  <Box className={classes.metadataItem}>
                    <span className={classes.metadataKey}>Component:</span>
                    <span className={classes.metadataValue}>
                      {log.componentId}
                    </span>
                  </Box>

                  <Box className={classes.metadataItem}>
                    <span className={classes.metadataKey}>Environment:</span>
                    <span className={classes.metadataValue}>
                      {log.environmentId}
                    </span>
                  </Box>

                  <Box className={classes.metadataItem}>
                    <span className={classes.metadataKey}>Project:</span>
                    <span className={classes.metadataValue}>
                      {log.projectId}
                    </span>
                  </Box>

                  <Box className={classes.metadataItem}>
                    <span className={classes.metadataKey}>Namespace:</span>
                    <span className={classes.metadataValue}>
                      {log.namespace}
                    </span>
                  </Box>

                  <Box className={classes.metadataItem}>
                    <span className={classes.metadataKey}>Pod ID:</span>
                    <span className={classes.metadataValue}>{log.podId}</span>
                  </Box>

                  <Box className={classes.metadataItem}>
                    <span className={classes.metadataKey}>Container:</span>
                    <span className={classes.metadataValue}>
                      {log.containerName}
                    </span>
                  </Box>

                  {log.version && (
                    <Box className={classes.metadataItem}>
                      <span className={classes.metadataKey}>Version:</span>
                      <span className={classes.metadataValue}>
                        {log.version}
                      </span>
                    </Box>
                  )}

                  {Object.keys(log.labels).length > 0 && (
                    <>
                      <Typography
                        variant="subtitle1"
                        className={classes.metadataTitle}
                        style={{ marginTop: 16 }}
                      >
                        Labels
                      </Typography>
                      {Object.entries(log.labels).map(([key, value]) => (
                        <Box key={key} className={classes.metadataItem}>
                          <span className={classes.metadataKey}>{key}:</span>
                          <span className={classes.metadataValue}>{value}</span>
                        </Box>
                      ))}
                    </>
                  )}
                </Box>
              </Box>
            </Collapse>
          </TableCell>
        </TableRow>
      )}
    </>
  );
};
