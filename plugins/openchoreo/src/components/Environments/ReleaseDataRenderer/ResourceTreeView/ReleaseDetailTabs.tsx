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
import type { LayoutNode } from './treeTypes';

const TABS = [
  { id: 'summary', label: 'Summary' },
  { id: 'definition', label: 'Definition' },
] as const;

function getReleaseField(
  release: Record<string, unknown> | undefined,
  field: string,
): unknown {
  const spec = release?.spec as Record<string, unknown> | undefined;
  return spec?.[field];
}

function getReleaseConditions(
  release: Record<string, unknown> | undefined,
): any[] {
  const status = release?.status as Record<string, unknown> | undefined;
  if (status && Array.isArray(status.conditions)) return status.conditions;
  return [];
}

/**
 * A condition status is True, False or Unknown. Unknown means the controller has
 * not determined the state yet, so it reads as progressing rather than a failure
 * — the same mapping the release binding uses for its Ready condition.
 */
function conditionHealth(status: string | undefined): string {
  if (status === 'True') return 'Healthy';
  if (status === 'False') return 'Degraded';
  return 'Progressing';
}

interface ReleaseDetailTabsProps {
  node: LayoutNode;
}

/**
 * Detail tabs shown when a rendered release node is selected in the resource
 * tree. The release controllers report state through status.conditions rather
 * than Kubernetes events, so the Summary tab is where a failed apply to the
 * data plane shows up (ResourcesApplied=False with the apply error as message).
 */
export const ReleaseDetailTabs: FC<ReleaseDetailTabsProps> = ({ node }) => {
  const classes = useTreeStyles();
  const releaseClasses = useReleaseInfoStyles();
  const [activeTab, setActiveTab] = useState(0);

  // Reset tab when switching to a different node
  useEffect(() => {
    setActiveTab(0);
  }, [node.id]);

  const currentTab = TABS[activeTab]?.id;
  const release = node.specObject as Record<string, unknown> | undefined;

  const displayConditions = getReleaseConditions(release);
  const environment = getReleaseField(release, 'environmentName') as
    | string
    | undefined;
  const owner = getReleaseField(release, 'owner') as
    | Record<string, string>
    | undefined;

  return (
    <>
      <Box display="flex" alignItems="center">
        <Tabs
          value={activeTab}
          onChange={(_, newValue) => setActiveTab(newValue)}
          indicatorColor="primary"
          textColor="primary"
          className={classes.drawerTabs}
          style={{ flex: 1 }}
        >
          {TABS.map(tab => (
            <Tab key={tab.id} label={tab.label} />
          ))}
        </Tabs>
        {node.targetPlane && (
          <Chip
            label={`Target: ${node.targetPlane}`}
            size="small"
            variant="outlined"
            style={{ marginRight: 8 }}
          />
        )}
      </Box>

      <Box className={classes.drawerTabContent}>
        {currentTab === 'summary' && (
          <Box>
            {/* Key-value properties */}
            {owner?.projectName && (
              <Box className={classes.drawerProperty}>
                <Typography className={classes.drawerPropertyKey}>
                  Project
                </Typography>
                <Typography className={classes.drawerPropertyValue}>
                  {owner.projectName}
                </Typography>
              </Box>
            )}

            {owner?.componentName && (
              <Box className={classes.drawerProperty}>
                <Typography className={classes.drawerPropertyKey}>
                  Component
                </Typography>
                <Typography className={classes.drawerPropertyValue}>
                  {owner.componentName}
                </Typography>
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

            {node.targetPlane && (
              <Box className={classes.drawerProperty}>
                <Typography className={classes.drawerPropertyKey}>
                  Target Plane
                </Typography>
                <Typography className={classes.drawerPropertyValue}>
                  {node.targetPlane}
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
                        <TableCell scope="col">Type</TableCell>
                        <TableCell scope="col">Status</TableCell>
                        <TableCell scope="col">Reason</TableCell>
                        <TableCell scope="col">Message</TableCell>
                        <TableCell scope="col">Last Transition</TableCell>
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
                                  conditionHealth(condition.status),
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

        {currentTab === 'definition' && (
          <>
            {node.specObject ? (
              <YamlViewer
                value={YAML.stringify(node.specObject)}
                maxHeight="auto"
              />
            ) : (
              <Box className={classes.drawerEmptyState}>
                <Typography variant="body2" color="textSecondary">
                  No release definition available
                </Typography>
              </Box>
            )}
          </>
        )}
      </Box>
    </>
  );
};
