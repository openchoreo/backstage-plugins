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
  const [copySuccess, setCopySuccess] = useState(false);

  const handleRowClick = () => {
    setExpanded(!expanded);
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
      >
        {selectedFields.map(field => {
          if (field === LogEntryField.Timestamp) {
            return (
              <TableCell key={field} className={classes.monospaceCell}>
                {formatTimestamp(log.timestamp ?? '')}
              </TableCell>
            );
          }

          if (field === LogEntryField.LogLevel) {
            return (
              <TableCell key={field}>
                <Chip
                  label={log.level}
                  size="small"
                  className={`${classes.logLevelChip} ${getLogLevelChipClass(
                    log.level ?? '',
                  )}`}
                />
              </TableCell>
            );
          }

          if (field === LogEntryField.ComponentName) {
            return (
              <TableCell key={field} className={classes.monospaceCell}>
                {log.metadata?.componentName ?? componentName ?? ''}
              </TableCell>
            );
          }

          return (
            <TableCell key={field} className={classes.logCell}>
              <Box className={classes.logCellContent}>
                <Box className={classes.logTextContainer}>
                  <Typography
                    className={`${classes.logMessage} ${
                      expanded ? classes.expandedLogMessage : ''
                    }`}
                  >
                    {log.log}
                  </Typography>
                </Box>
                <Box
                  className={`${classes.logActionColumn} ${classes.hoverActionButton}`}
                >
                  <Tooltip title={copySuccess ? 'Copied!' : 'Copy log message'}>
                    <IconButton
                      className={classes.copyButton}
                      onClick={handleCopyLog}
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
                          {log.metadata?.environmentName ?? environmentName}
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
                          {log.metadata?.projectName ?? projectName}
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
                          {log.metadata?.componentName ?? componentName}
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
