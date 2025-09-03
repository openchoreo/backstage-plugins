import { FC, MouseEvent, useState } from 'react';
import {
  TableRow,
  TableCell,
  Typography,
  Box,
  Collapse,
  IconButton,
  Tooltip,
  Chip,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import ExpandMore from '@material-ui/icons/ExpandMore';
import ExpandLess from '@material-ui/icons/ExpandLess';
import FileCopy from '@material-ui/icons/FileCopyOutlined';
import { LogEntry as LogEntryType } from './types';

const useStyles = makeStyles(theme => ({
  logRow: {
    '&:hover': {
      backgroundColor: theme.palette.action.hover,
    },
    cursor: 'pointer',
  },
  cellText: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    width: theme.spacing(9),
    display: 'block',
    fontFamily: 'monospace',
    fontSize: '0.8rem',
  },
  expandedRow: {
    backgroundColor: theme.palette.action.selected,
  },
  errorRow: {
    color: theme.palette.error.dark,
  },
  warnRow: {
    color: theme.palette.warning.dark,
  },
  infoRow: {
    color: theme.palette.info.dark,
  },
  debugRow: {
    color: theme.palette.text.primary,
  },
  undefinedRow: {
    color: theme.palette.text.secondary,
  },
  timestampCell: {
    fontFamily: 'monospace',
    whiteSpace: 'nowrap',
    fontSize: '0.8rem',
    width: '140px',
  },

  logMessage: {
    fontFamily: 'monospace',
    fontSize: '0.8rem',
    wordBreak: 'break-word',
    maxWidth: 'calc(100vw - 920px)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  expandedLogMessage: {
    whiteSpace: 'pre-wrap',
    maxWidth: 'none',
    overflow: 'visible',
  },
  podCell: {
    fontFamily: 'monospace',
    fontSize: '0.8rem',
  },
  expandButton: {
    padding: theme.spacing(0.5),
  },
  expandedContent: {
    padding: theme.spacing(2, 0),
  },
  metadataSection: {
    marginTop: theme.spacing(2),
  },
  metadataTitle: {
    fontWeight: 'bold',
    marginBottom: theme.spacing(1),
  },
  metadataItem: {
    display: 'flex',
    marginBottom: theme.spacing(0.5),
  },
  metadataKey: {
    fontWeight: 'bold',
    minWidth: '120px',
    marginRight: theme.spacing(1),
  },
  metadataValue: {
    fontFamily: 'monospace',
    fontSize: '0.8rem',
  },
  copyButton: {
    padding: theme.spacing(0.5),
    marginLeft: theme.spacing(1),
    color: theme.palette.text.hint,
  },
  fullLogMessage: {
    fontFamily: 'monospace',
    fontSize: '0.8rem',
    whiteSpace: 'pre-wrap',
    backgroundColor: theme.palette.background.paper,
    padding: theme.spacing(1),
    borderRadius: theme.shape.borderRadius,
    border: `1px solid ${theme.palette.divider}`,
    maxHeight: '200px',
    overflow: 'auto',
  },
}));

interface LogEntryProps {
  log: LogEntryType;
}

export const LogEntry: FC<LogEntryProps> = ({ log }) => {
  const classes = useStyles();
  const [expanded, setExpanded] = useState(false);
  const getLogLevelRowClass = (level: string) => {
    switch (level) {
      case 'ERROR':
        return classes.errorRow;
      case 'WARN':
        return classes.warnRow;
      case 'INFO':
        return classes.infoRow;
      case 'DEBUG':
        return classes.debugRow;
      case 'UNDEFINED':
        return classes.undefinedRow;
      default:
        return '';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
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

  return (
    <>
      <TableRow
        className={`${classes.logRow} ${expanded ? classes.expandedRow : ''}`}
        onClick={handleRowClick}
      >
        <TableCell
          padding="default"
          className={`${classes.timestampCell} ${getLogLevelRowClass(
            log.logLevel,
          )}`}
        >
          {formatTimestamp(log.timestamp)}
        </TableCell>
        <TableCell
          padding="none"
          className={getLogLevelRowClass(log.logLevel)}
          width={120}
          align="center"
        >
          <Typography component="span" className={classes.cellText}>
            {log.containerName}
          </Typography>
        </TableCell>
        <TableCell
          padding="none"
          className={`${classes.podCell} ${getLogLevelRowClass(log.logLevel)}`}
          width={80}
        >
          <Tooltip title={log.podId}>
            <Typography className={classes.cellText}>{log.podId}</Typography>
          </Tooltip>
        </TableCell>
        <TableCell padding="none" className={getLogLevelRowClass(log.logLevel)}>
          <Box display="flex" alignItems="center">
            <Typography className={classes.logMessage}>{log.log}</Typography>
            <Tooltip title="Copy log message">
              <IconButton
                className={classes.copyButton}
                onClick={handleCopyLog}
                size="small"
              >
                <FileCopy fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </TableCell>
        <TableCell padding="none" align="center">
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
      <TableRow>
        <TableCell colSpan={5} style={{ paddingBottom: 0, paddingTop: 0 }}>
          <Collapse in={expanded} timeout="auto" unmountOnExit component={Box}>
            <Box className={classes.expandedContent}>
              <Box pt={1} display="flex" flexDirection="column" gridGap={1}>
                <Typography variant="caption" gutterBottom>
                  Full Log Message
                </Typography>

                <Box className={classes.fullLogMessage}>{log.log}</Box>
              </Box>

              <Box className={classes.metadataSection}>
                <Typography variant="caption">Metadata</Typography>
                <Box className={classes.metadataItem}>
                  <Typography variant="caption" className={classes.metadataKey}>
                    Log Level:
                  </Typography>
                  <Typography
                    variant="caption"
                    className={`${classes.metadataValue} ${getLogLevelRowClass(
                      log.logLevel,
                    )}`}
                  >
                    {log.logLevel}
                  </Typography>
                </Box>
                <Box className={classes.metadataItem}>
                  <Typography variant="caption" className={classes.metadataKey}>
                    Component:
                  </Typography>
                  <Typography
                    variant="caption"
                    className={classes.metadataValue}
                  >
                    {log.componentId}
                  </Typography>
                </Box>
                <Box className={classes.metadataItem}>
                  <Typography variant="caption" className={classes.metadataKey}>
                    Environment:
                  </Typography>
                  <Typography
                    variant="caption"
                    className={classes.metadataValue}
                  >
                    {log.environmentId}
                  </Typography>
                </Box>

                <Box className={classes.metadataItem}>
                  <Typography variant="caption" className={classes.metadataKey}>
                    Project:
                  </Typography>
                  <Typography
                    variant="caption"
                    className={classes.metadataValue}
                  >
                    {log.projectId}
                  </Typography>
                </Box>

                <Box className={classes.metadataItem}>
                  <Typography variant="caption" className={classes.metadataKey}>
                    Namespace:
                  </Typography>
                  <Typography
                    variant="caption"
                    className={classes.metadataValue}
                  >
                    {log.namespace}
                  </Typography>
                </Box>

                <Box className={classes.metadataItem}>
                  <Typography variant="caption" className={classes.metadataKey}>
                    Pod ID:
                  </Typography>
                  <Typography
                    variant="caption"
                    className={classes.metadataValue}
                  >
                    {log.podId}
                  </Typography>
                </Box>

                <Box className={classes.metadataItem}>
                  <Typography variant="caption" className={classes.metadataKey}>
                    Container:
                  </Typography>
                  <Typography
                    variant="caption"
                    className={classes.metadataValue}
                  >
                    {log.containerName}
                  </Typography>
                </Box>

                {log.version && (
                  <Box className={classes.metadataItem}>
                    <Typography
                      variant="caption"
                      className={classes.metadataKey}
                    >
                      Version:
                    </Typography>
                    <Typography
                      variant="caption"
                      className={classes.metadataValue}
                    >
                      {log.version}
                    </Typography>
                  </Box>
                )}

                {Object.keys(log.labels).length > 0 && (
                  <Box className={classes.expandedContent}>
                    <Typography variant="caption" gutterBottom>
                      Labels
                    </Typography>
                    <Box display="flex" flexWrap="wrap" pt={0.5}>
                      {Object.entries(log.labels).map(([key, value]) => (
                        <Chip
                          key={key}
                          size="small"
                          variant="outlined"
                          color="default"
                          label={
                            <Typography
                              variant="caption"
                              className={classes.metadataValue}
                            >
                              <Typography
                                variant="caption"
                                className={classes.metadataKey}
                              >
                                {key}:
                              </Typography>
                              <Typography variant="caption">{value}</Typography>
                            </Typography>
                          }
                        />
                      ))}
                    </Box>
                  </Box>
                )}
              </Box>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
};
