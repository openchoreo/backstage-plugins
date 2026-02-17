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
import { LogEntry as LogEntryType, LogEntryField } from './types';
import { useLogEntryStyles } from './styles';

interface LogEntryProps {
  log: LogEntryType;
  selectedFields: LogEntryField[];
}

export const LogEntry: FC<LogEntryProps> = ({ log, selectedFields }) => {
  const classes = useLogEntryStyles();
  const [expanded, setExpanded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  const handleRowClick = () => {
    setExpanded(!expanded);
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  const handleCopyLog = async (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();

    // Check if clipboard API is available
    if (!navigator.clipboard?.writeText) {
      // Clipboard API not supported or not in secure context
      return;
    }

    try {
      await navigator.clipboard.writeText(log.log);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      // Silent fail - clipboard operation failed
      // Could be due to permissions or other issues
    }
  };

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

  const formatTimestamp = (timestamp: string): string => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <>
      <TableRow
        className={`${classes.logRow} ${expanded ? classes.expandedRow : ''}`}
        onClick={handleRowClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {selectedFields.includes(LogEntryField.Timestamp) && (
          <TableCell className={classes.timestampCell}>
            {formatTimestamp(log.timestamp)}
          </TableCell>
        )}
        {selectedFields.includes(LogEntryField.LogLevel) && (
          <TableCell>
            <Chip
              label={log.logLevel}
              size="small"
              className={`${classes.logLevelChip} ${getLogLevelChipClass(
                log.logLevel,
              )}`}
            />
          </TableCell>
        )}
        {selectedFields.includes(LogEntryField.Log) && (
          <TableCell className={classes.logCell}>
            <Box display="flex" alignItems="center">
              <Typography
                className={`${classes.logMessage} ${
                  expanded ? classes.expandedLogMessage : ''
                }`}
              >
                {log.log}
              </Typography>
              {isHovered && (
                <Tooltip title={copySuccess ? 'Copied!' : 'Copy log message'}>
                  <IconButton
                    className={classes.copyButton}
                    onClick={handleCopyLog}
                    size="small"
                  >
                    <FileCopyOutlined fontSize="inherit" />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          </TableCell>
        )}
      </TableRow>

      {expanded && (
        <TableRow>
          <TableCell
            colSpan={selectedFields.length}
            style={{ paddingBottom: 0, paddingTop: 0 }}
          >
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
