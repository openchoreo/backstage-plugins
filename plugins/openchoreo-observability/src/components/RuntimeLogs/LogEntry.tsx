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
  environmentName?: string;
  projectName?: string;
  componentName?: string;
}

export const LogEntry: FC<LogEntryProps> = ({
  log,
  selectedFields,
  environmentName,
  projectName,
  componentName,
}) => {
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
      await navigator.clipboard.writeText(log.log ?? '');
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
            {formatTimestamp(log.timestamp ?? '')}
          </TableCell>
        )}
        {selectedFields.includes(LogEntryField.LogLevel) && (
          <TableCell>
            <Chip
              label={log.level}
              size="small"
              className={`${classes.logLevelChip} ${getLogLevelChipClass(
                log.level ?? '',
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
                <Typography
                  className={classes.expandedSectionTitle}
                  gutterBottom
                >
                  Full Log Message
                </Typography>
                <Box className={classes.fullLogMessage}>{log.log}</Box>

                <Box className={classes.metadataSection}>
                  <Typography
                    className={`${classes.metadataTitle} ${classes.expandedSectionTitle}`}
                  >
                    Metadata
                  </Typography>

                  <Box className={classes.metadataBox}>
                    <Box className={classes.metadataGrid}>
                      <Box className={classes.metadataItem}>
                        <span className={classes.metadataKey}>
                          Environment Name:
                        </span>
                        <span className={classes.metadataValue}>
                          {environmentName}
                        </span>
                      </Box>

                      <Box className={classes.metadataItem}>
                        <span className={classes.metadataKey}>
                          Environment UID:
                        </span>
                        <span className={classes.metadataValue}>
                          {log.metadata?.environmentUid}
                        </span>
                      </Box>

                      <Box className={classes.metadataItem}>
                        <span className={classes.metadataKey}>
                          Project Name:
                        </span>
                        <span className={classes.metadataValue}>
                          {projectName}
                        </span>
                      </Box>

                      <Box className={classes.metadataItem}>
                        <span className={classes.metadataKey}>
                          Project UID:
                        </span>
                        <span className={classes.metadataValue}>
                          {log.metadata?.projectUid}
                        </span>
                      </Box>

                      <Box className={classes.metadataItem}>
                        <span className={classes.metadataKey}>
                          Component Name:
                        </span>
                        <span className={classes.metadataValue}>
                          {componentName}
                        </span>
                      </Box>

                      <Box className={classes.metadataItem}>
                        <span className={classes.metadataKey}>
                          Component UID:
                        </span>
                        <span className={classes.metadataValue}>
                          {log.metadata?.componentUid}
                        </span>
                      </Box>

                      <Box className={classes.metadataItem}>
                        <span className={classes.metadataKey}>Pod Name:</span>
                        <span className={classes.metadataValue}>
                          {log.metadata?.podName}
                        </span>
                      </Box>

                      <Box className={classes.metadataItem}>
                        <span className={classes.metadataKey}>
                          Pod Namespace:
                        </span>
                        <span className={classes.metadataValue}>
                          {log.metadata?.podNamespace}
                        </span>
                      </Box>

                      <Box className={classes.metadataItem}>
                        <span className={classes.metadataKey}>Namespace:</span>
                        <span className={classes.metadataValue}>
                          {log.metadata?.namespaceName}
                        </span>
                      </Box>

                      <Box className={classes.metadataItem}>
                        <span className={classes.metadataKey}>Container:</span>
                        <span className={classes.metadataValue}>
                          {log.metadata?.containerName}
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
