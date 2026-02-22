import { useState, useEffect, type FC } from 'react';
import {
  Box,
  Tabs,
  Tab,
  Typography,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@material-ui/core';
import YAML from 'yaml';
import { YamlViewer } from '@openchoreo/backstage-design-system';
import { useTreeStyles } from './treeStyles';
import { useReleaseInfoStyles } from '../styles';
import { formatTimestamp, getHealthChipClass } from '../utils';
import type { ReleaseData } from '../types';

/** Helper to extract a field from either flat (legacy) or nested (new API) format */
function getBindingField(
  binding: Record<string, unknown>,
  field: string,
): unknown {
  // Legacy flat format: binding.environment, binding.releaseName, etc.
  if (field in binding) return binding[field];
  // New K8s format: binding.spec.environment, binding.spec.releaseName, etc.
  const spec = binding.spec as Record<string, unknown> | undefined;
  return spec?.[field];
}

function getBindingName(binding: Record<string, unknown>): string | undefined {
  // Legacy: binding.name, New: binding.metadata.name
  if (typeof binding.name === 'string') return binding.name;
  const metadata = binding.metadata as Record<string, unknown> | undefined;
  return metadata?.name as string | undefined;
}

function getBindingStatus(
  binding: Record<string, unknown>,
): string | undefined {
  // Legacy: binding.status is a string, New: binding.spec.state
  if (typeof binding.status === 'string') return binding.status;
  const spec = binding.spec as Record<string, unknown> | undefined;
  return spec?.state as string | undefined;
}

function getBindingConditions(binding: Record<string, unknown>): any[] {
  // New API: binding.status.conditions
  const status = binding.status as Record<string, unknown> | undefined;
  if (status && Array.isArray(status.conditions)) return status.conditions;
  return [];
}

interface ReleaseBindingDetailTabsProps {
  releaseData: ReleaseData;
  releaseBindingData: Record<string, unknown> | null;
}

export const ReleaseBindingDetailTabs: FC<ReleaseBindingDetailTabsProps> = ({
  releaseData,
  releaseBindingData,
}) => {
  const classes = useTreeStyles();
  const releaseClasses = useReleaseInfoStyles();
  const [activeTab, setActiveTab] = useState(0);

  const bindingName = releaseBindingData
    ? getBindingName(releaseBindingData)
    : undefined;

  // Reset tab when data changes
  useEffect(() => {
    setActiveTab(0);
  }, [bindingName]);

  // Get conditions from release binding (new API) or fall back to release data conditions
  const conditions = releaseBindingData
    ? getBindingConditions(releaseBindingData)
    : [];
  const fallbackConditions = releaseData?.data?.status?.conditions ?? [];
  const displayConditions =
    conditions.length > 0 ? conditions : fallbackConditions;

  const releaseName = releaseBindingData
    ? (getBindingField(releaseBindingData, 'releaseName') as string | undefined)
    : undefined;
  const environment = releaseBindingData
    ? (getBindingField(releaseBindingData, 'environment') as string | undefined)
    : undefined;
  const status = releaseBindingData
    ? getBindingStatus(releaseBindingData)
    : undefined;

  return (
    <>
      <Tabs
        value={activeTab}
        onChange={(_, newValue) => setActiveTab(newValue)}
        indicatorColor="primary"
        textColor="primary"
        className={classes.drawerTabs}
      >
        <Tab label="Summary" />
        <Tab label="Definition" />
      </Tabs>

      <Box className={classes.drawerTabContent}>
        {activeTab === 0 && (
          <Box>
            {/* Key-value properties */}
            {releaseName && (
              <Box className={classes.drawerProperty}>
                <Typography className={classes.drawerPropertyKey}>
                  Component Release
                </Typography>
                <Typography className={classes.drawerPropertyValue}>
                  {releaseName}
                </Typography>
              </Box>
            )}

            {status && (
              <Box className={classes.drawerProperty}>
                <Typography className={classes.drawerPropertyKey}>
                  Status
                </Typography>
                <Chip
                  label={status}
                  size="small"
                  className={getHealthChipClass(
                    status === 'Active' ? 'Healthy' : 'Unknown',
                    releaseClasses,
                  )}
                />
              </Box>
            )}

            {environment && (
              <Box className={classes.drawerProperty}>
                <Typography className={classes.drawerPropertyKey}>
                  Environment
                </Typography>
                <Typography className={classes.drawerPropertyValue}>
                  {environment}
                </Typography>
              </Box>
            )}

            {/* Conditions table */}
            {displayConditions.length > 0 && (
              <Box mt={3}>
                <Typography
                  variant="subtitle2"
                  gutterBottom
                  style={{ fontWeight: 600 }}
                >
                  Conditions
                </Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Type</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Reason</TableCell>
                        <TableCell>Message</TableCell>
                        <TableCell>Last Transition</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {displayConditions.map(
                        (condition: any, index: number) => (
                          <TableRow key={`${condition.type}-${index}`}>
                            <TableCell>
                              <Typography
                                variant="body2"
                                style={{ fontWeight: 500 }}
                              >
                                {condition.type}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={condition.status}
                                size="small"
                                className={getHealthChipClass(
                                  condition.status === 'True'
                                    ? 'Healthy'
                                    : 'Degraded',
                                  releaseClasses,
                                )}
                              />
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2">
                                {condition.reason ?? '-'}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography
                                variant="body2"
                                style={{
                                  maxWidth: 400,
                                  wordBreak: 'break-word',
                                }}
                              >
                                {condition.message ?? '-'}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2">
                                {condition.lastTransitionTime
                                  ? formatTimestamp(
                                      condition.lastTransitionTime,
                                    )
                                  : '-'}
                              </Typography>
                            </TableCell>
                          </TableRow>
                        ),
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            )}
          </Box>
        )}

        {activeTab === 1 && (
          <>
            {releaseBindingData ? (
              <YamlViewer
                value={YAML.stringify(releaseBindingData)}
                maxHeight="auto"
              />
            ) : (
              <Box className={classes.drawerEmptyState}>
                <Typography variant="body2" color="textSecondary">
                  No release binding definition available
                </Typography>
              </Box>
            )}
          </>
        )}
      </Box>
    </>
  );
};
