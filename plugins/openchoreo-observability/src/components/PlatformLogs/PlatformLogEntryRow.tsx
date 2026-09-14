import { FC, MouseEvent, useMemo, useState } from 'react';
import {
  Typography,
  Chip,
  Box,
  Collapse,
  IconButton,
  Tooltip,
} from '@material-ui/core';
import FileCopyOutlined from '@material-ui/icons/FileCopyOutlined';
import { useLogEntryStyles } from '../RuntimeLogs/styles';
import { getPlatformColumnStyle } from './columns';
import { PlatformLogEntry, PlatformLogField } from './types';

interface PlatformLogEntryRowProps {
  log: PlatformLogEntry;
  selectedFields: PlatformLogField[];
  /**
   * Whether this row is expanded. Controlled by the parent so expansion survives the
   * virtualizer unmounting the row off-screen.
   */
  expanded: boolean;
  onToggleExpand: () => void;
}

const LEVEL_CHIP_CLASS_KEY: Record<
  string,
  'errorChip' | 'warnChip' | 'infoChip' | 'debugChip' | 'undefinedChip'
> = {
  ERROR: 'errorChip',
  WARN: 'warnChip',
  INFO: 'infoChip',
  DEBUG: 'debugChip',
  UNDEFINED: 'undefinedChip',
};

/**
 * The pod coordinates shown in the expanded panel, in the order an operator reads them:
 * where it ran, then what ran. A field with no value is omitted rather than shown empty
 * - records collected before the cluster stamp landed have no clusterInstance, and not
 * every backend supplies every field.
 */
const METADATA_FIELDS: Array<{
  label: string;
  get: (log: PlatformLogEntry) => string | undefined;
}> = [
  { label: 'Cluster', get: log => log.clusterInstance },
  { label: 'Node', get: log => log.nodeName },
  { label: 'Namespace', get: log => log.namespaceName },
  { label: 'Pod', get: log => log.podName },
  { label: 'Pod IP', get: log => log.podIp },
  { label: 'Container', get: log => log.containerName },
  { label: 'Image', get: log => log.containerImage },
];

export const PlatformLogEntryRow: FC<PlatformLogEntryRowProps> = ({
  log,
  selectedFields,
  expanded,
  onToggleExpand,
}) => {
  const classes = useLogEntryStyles();
  const [copySuccess, setCopySuccess] = useState(false);

  // Sorted so a pod's labels appear in the same order on every row, which makes them
  // scannable when comparing two records.
  const labelEntries = useMemo(
    () =>
      Object.entries(log.labels ?? {}).sort(([a], [b]) => a.localeCompare(b)),
    [log.labels],
  );

  const handleCopyLog = async (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (!navigator.clipboard?.writeText) {
      return;
    }
    try {
      await navigator.clipboard.writeText(log.log ?? '');
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch {
      // Silent fail — clipboard permissions or a non-secure context.
    }
  };

  const plainCell = (field: PlatformLogField, value: string | undefined) => (
    <Box
      key={field}
      style={getPlatformColumnStyle(field)}
      className={`${classes.cell} ${classes.monospaceCell}`}
      title={value || undefined}
    >
      {value ?? ''}
    </Box>
  );

  return (
    <Box
      className={`${classes.logRow} ${expanded ? classes.expandedRow : ''}`}
      role="row"
    >
      <Box className={classes.logRowMain} onClick={onToggleExpand}>
        {selectedFields.map(field => {
          switch (field) {
            case PlatformLogField.Timestamp:
              return plainCell(
                field,
                log.timestamp ? new Date(log.timestamp).toLocaleString() : '',
              );
            case PlatformLogField.Cluster:
              return plainCell(field, log.clusterInstance);
            case PlatformLogField.Namespace:
              return plainCell(field, log.namespaceName);
            case PlatformLogField.Pod:
              return plainCell(field, log.podName);
            case PlatformLogField.Container:
              return plainCell(field, log.containerName);
            case PlatformLogField.LogLevel:
              return (
                <Box
                  key={field}
                  style={getPlatformColumnStyle(field)}
                  className={classes.cell}
                >
                  {log.level && (
                    <Chip
                      label={log.level}
                      size="small"
                      className={`${classes.logLevelChip} ${
                        classes[LEVEL_CHIP_CLASS_KEY[log.level]] ?? ''
                      }`}
                    />
                  )}
                </Box>
              );
            default:
              return (
                <Box
                  key={field}
                  style={getPlatformColumnStyle(field)}
                  className={`${classes.cell} ${classes.logCell}`}
                >
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
                      <Tooltip
                        title={copySuccess ? 'Copied!' : 'Copy log message'}
                      >
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
                </Box>
              );
          }
        })}
      </Box>

      {expanded && (
        <Collapse in={expanded} timeout="auto" unmountOnExit>
          <Box className={classes.expandedContent}>
            <Typography className={classes.expandedSectionTitle} gutterBottom>
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
                  {METADATA_FIELDS.map(({ label, get }) => {
                    const value = get(log);
                    return value ? (
                      <Box key={label} className={classes.metadataItem}>
                        <span className={classes.metadataKey}>{label}:</span>
                        <span className={classes.metadataValue}>{value}</span>
                      </Box>
                    ) : null;
                  })}
                </Box>
              </Box>
            </Box>

            {labelEntries.length > 0 && (
              <Box className={classes.metadataSection}>
                <Typography
                  className={`${classes.metadataTitle} ${classes.expandedSectionTitle}`}
                >
                  Pod Labels
                </Typography>
                <Box className={classes.metadataBox}>
                  <Box className={classes.metadataGrid}>
                    {labelEntries.map(([key, value]) => (
                      <Box key={key} className={classes.metadataItem}>
                        <span className={classes.metadataKey}>{key}:</span>
                        <span className={classes.metadataValue}>{value}</span>
                      </Box>
                    ))}
                  </Box>
                </Box>
              </Box>
            )}
          </Box>
        </Collapse>
      )}
    </Box>
  );
};
