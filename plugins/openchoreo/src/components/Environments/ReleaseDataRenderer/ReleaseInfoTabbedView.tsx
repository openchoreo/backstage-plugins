import { useMemo, useState } from 'react';
import type { FC } from 'react';
import {
  Typography,
  Box,
  Grid,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { alpha } from '@material-ui/core/styles/colorManipulator';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import InfoIcon from '@material-ui/icons/Info';
import {
  ReleaseData,
  ReleaseResource,
  SpecResource,
  HealthStatus,
} from './types';
import { formatTimestamp } from './utils';
import {
  VerticalTabNav,
  TabItemData,
} from '@openchoreo/backstage-design-system';

const useStyles = makeStyles(theme => ({
  tabNav: {
    height: '100%',
    minHeight: 400,
  },
  section: {
    marginBottom: theme.spacing(3),
  },
  sectionTitle: {
    fontSize: theme.typography.h6.fontSize,
    fontWeight: 600,
    marginBottom: theme.spacing(2),
    color: theme.palette.text.primary,
  },
  propertyRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: theme.spacing(1),
    marginBottom: theme.spacing(1.5),
  },
  propertyKey: {
    fontWeight: 600,
    color: theme.palette.text.secondary,
    fontSize: theme.typography.caption.fontSize,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    minWidth: '140px',
  },
  propertyValue: {
    color: theme.palette.text.primary,
    fontSize: theme.typography.body2.fontSize,
    wordBreak: 'break-word',
  },
  propertyValueCode: {
    backgroundColor: alpha(
      theme.palette.type === 'dark'
        ? theme.palette.common.white
        : theme.palette.common.black,
      0.05,
    ),
    padding: theme.spacing(0.5, 1),
    borderRadius: theme.spacing(0.5),
    fontSize: '0.875rem',
    fontFamily: 'monospace',
  },
  resourceCard: {
    padding: theme.spacing(2),
    backgroundColor: alpha(theme.palette.background.paper, 0.6),
    borderRadius: theme.shape.borderRadius,
    border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
    marginBottom: theme.spacing(2),
  },
  resourceHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    marginBottom: theme.spacing(1.5),
  },
  resourceName: {
    fontWeight: 600,
    fontSize: theme.typography.body1.fontSize,
  },
  healthyChip: {
    backgroundColor: theme.palette.success.light,
    color: theme.palette.success.dark,
    fontWeight: 500,
    fontSize: '0.75rem',
  },
  progressingChip: {
    backgroundColor: theme.palette.info.light,
    color: theme.palette.info.dark,
    fontWeight: 500,
    fontSize: '0.75rem',
  },
  degradedChip: {
    backgroundColor: theme.palette.error.light,
    color: theme.palette.error.dark,
    fontWeight: 500,
    fontSize: '0.75rem',
  },
  suspendedChip: {
    backgroundColor: theme.palette.warning.light,
    color: theme.palette.warning.dark,
    fontWeight: 500,
    fontSize: '0.75rem',
  },
  unknownChip: {
    backgroundColor: alpha(theme.palette.text.disabled, 0.1),
    color: theme.palette.text.secondary,
    fontWeight: 500,
    fontSize: '0.75rem',
  },
  accordion: {
    backgroundColor: alpha(
      theme.palette.type === 'dark'
        ? theme.palette.common.white
        : theme.palette.common.black,
      0.02,
    ),
    '&:before': {
      display: 'none',
    },
    boxShadow: 'none',
    border: `1px solid ${alpha(theme.palette.divider, 0.3)}`,
    marginBottom: theme.spacing(1),
  },
  emptyValue: {
    color: theme.palette.text.disabled,
    fontStyle: 'italic',
    fontSize: theme.typography.body2.fontSize,
  },
}));

interface ReleaseInfoTabbedViewProps {
  releaseData: ReleaseData;
}

// Helper to get health status for tab indicator
const getHealthStatusForTab = (
  healthStatus?: HealthStatus,
): 'success' | 'warning' | 'error' | 'default' | undefined => {
  switch (healthStatus) {
    case 'Healthy':
      return 'success';
    case 'Progressing':
    case 'Unknown':
      return 'warning';
    case 'Degraded':
      return 'error';
    case 'Suspended':
      return 'warning';
    default:
      return 'default';
  }
};

const getHealthChipClass = (
  healthStatus: string | undefined,
  classes: ReturnType<typeof useStyles>,
) => {
  switch (healthStatus) {
    case 'Healthy':
      return classes.healthyChip;
    case 'Progressing':
      return classes.progressingChip;
    case 'Degraded':
      return classes.degradedChip;
    case 'Suspended':
      return classes.suspendedChip;
    default:
      return classes.unknownChip;
  }
};

// Group resources by kind
interface ResourceGroup {
  kind: string;
  resources: ReleaseResource[];
  definitions: SpecResource[];
  overallHealth: HealthStatus | undefined;
}

export const ReleaseInfoTabbedView: FC<ReleaseInfoTabbedViewProps> = ({
  releaseData,
}) => {
  const classes = useStyles();
  const data = releaseData?.data;

  const [activeTab, setActiveTab] = useState<string>('overview');

  // Group resources by kind
  const resourceGroups = useMemo<ResourceGroup[]>(() => {
    const groups: Map<string, ResourceGroup> = new Map();
    const statusResources = data?.status?.resources || [];
    const specResources = data?.spec?.resources || [];

    // First, group status resources by kind
    statusResources.forEach(resource => {
      const kind = resource.kind;
      if (!groups.has(kind)) {
        groups.set(kind, {
          kind,
          resources: [],
          definitions: [],
          overallHealth: undefined,
        });
      }
      const group = groups.get(kind)!;
      group.resources.push(resource);

      // Determine overall health (worst status wins)
      if (resource.healthStatus) {
        if (!group.overallHealth) {
          group.overallHealth = resource.healthStatus;
        } else if (
          resource.healthStatus === 'Degraded' ||
          (resource.healthStatus === 'Suspended' &&
            group.overallHealth !== 'Degraded') ||
          (resource.healthStatus === 'Progressing' &&
            group.overallHealth === 'Healthy') ||
          (resource.healthStatus === 'Unknown' &&
            group.overallHealth === 'Healthy')
        ) {
          group.overallHealth = resource.healthStatus;
        }
      }
    });

    // Match spec resources to their kind groups
    specResources.forEach(specResource => {
      // Try to extract kind from the resource id or object
      const obj = specResource.object as Record<string, unknown>;
      const kind = (obj?.kind as string) || 'Unknown';

      if (!groups.has(kind)) {
        groups.set(kind, {
          kind,
          resources: [],
          definitions: [],
          overallHealth: undefined,
        });
      }
      groups.get(kind)!.definitions.push(specResource);
    });

    return Array.from(groups.values());
  }, [data]);

  // Build tabs
  const tabs = useMemo<TabItemData[]>(() => {
    const tabList: TabItemData[] = [
      {
        id: 'overview',
        label: 'Overview',
        icon: <InfoIcon />,
      },
    ];

    resourceGroups.forEach(group => {
      const resourceCount = group.resources.length || group.definitions.length;
      tabList.push({
        id: `resource-${group.kind}`,
        label: group.kind,
        count: resourceCount,
        status: getHealthStatusForTab(group.overallHealth),
      });
    });

    return tabList;
  }, [resourceGroups]);

  // Set default tab if not set
  useMemo(() => {
    if (!activeTab && tabs.length > 0) {
      setActiveTab(tabs[0].id);
    }
  }, [tabs, activeTab]);

  if (!data || (!data.spec && !data.status)) {
    return (
      <Typography className={classes.emptyValue}>
        No release data available
      </Typography>
    );
  }

  // Render Overview tab content
  const renderOverviewContent = () => {
    const spec = data?.spec;
    if (!spec) return null;

    return (
      <Box>
        <Typography className={classes.sectionTitle}>
          Release Overview
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <Box className={classes.propertyRow}>
              <Typography className={classes.propertyKey}>
                Environment:
              </Typography>
              <Typography className={classes.propertyValue}>
                {spec.environmentName || 'N/A'}
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Box className={classes.propertyRow}>
              <Typography className={classes.propertyKey}>Project:</Typography>
              <Typography className={classes.propertyValue}>
                {spec.owner?.projectName || 'N/A'}
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Box className={classes.propertyRow}>
              <Typography className={classes.propertyKey}>
                Component:
              </Typography>
              <Typography className={classes.propertyValue}>
                {spec.owner?.componentName || 'N/A'}
              </Typography>
            </Box>
          </Grid>
          {spec.interval && (
            <Grid item xs={12} sm={6}>
              <Box className={classes.propertyRow}>
                <Typography className={classes.propertyKey}>
                  Watch Interval:
                </Typography>
                <Typography className={classes.propertyValueCode}>
                  {spec.interval}
                </Typography>
              </Box>
            </Grid>
          )}
        </Grid>

        {/* Conditions section */}
        {data?.status?.conditions && data.status.conditions.length > 0 && (
          <Box mt={3}>
            <Typography className={classes.sectionTitle}>Conditions</Typography>
            {data.status.conditions.map((condition, index) => (
              <Box key={index} className={classes.resourceCard}>
                <Grid container spacing={1}>
                  <Grid item xs={12} sm={4}>
                    <Box className={classes.propertyRow}>
                      <Typography className={classes.propertyKey}>
                        Type:
                      </Typography>
                      <Typography className={classes.propertyValue}>
                        {condition.type}
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <Box className={classes.propertyRow}>
                      <Typography className={classes.propertyKey}>
                        Status:
                      </Typography>
                      <Typography className={classes.propertyValue}>
                        {condition.status}
                      </Typography>
                    </Box>
                  </Grid>
                  {condition.lastTransitionTime && (
                    <Grid item xs={12} sm={4}>
                      <Box className={classes.propertyRow}>
                        <Typography className={classes.propertyKey}>
                          Last Transition:
                        </Typography>
                        <Typography className={classes.propertyValue}>
                          {formatTimestamp(condition.lastTransitionTime)}
                        </Typography>
                      </Box>
                    </Grid>
                  )}
                  {condition.reason && (
                    <Grid item xs={12}>
                      <Box className={classes.propertyRow}>
                        <Typography className={classes.propertyKey}>
                          Reason:
                        </Typography>
                        <Typography className={classes.propertyValue}>
                          {condition.reason}
                        </Typography>
                      </Box>
                    </Grid>
                  )}
                  {condition.message && (
                    <Grid item xs={12}>
                      <Box className={classes.propertyRow}>
                        <Typography className={classes.propertyKey}>
                          Message:
                        </Typography>
                        <Typography className={classes.propertyValue}>
                          {condition.message}
                        </Typography>
                      </Box>
                    </Grid>
                  )}
                </Grid>
              </Box>
            ))}
          </Box>
        )}
      </Box>
    );
  };

  // Render resource group content
  const renderResourceGroupContent = (group: ResourceGroup) => {
    return (
      <Box>
        {/* Status Resources */}
        {group.resources.length > 0 && (
          <Box className={classes.section}>
            <Typography className={classes.sectionTitle}>
              {group.kind} Resources ({group.resources.length})
            </Typography>
            {group.resources.map((resource, index) => (
              <Box key={resource.id || index} className={classes.resourceCard}>
                <Box className={classes.resourceHeader}>
                  <Typography className={classes.resourceName}>
                    {resource.name}
                  </Typography>
                  {resource.healthStatus && (
                    <Chip
                      label={resource.healthStatus}
                      size="small"
                      className={getHealthChipClass(
                        resource.healthStatus,
                        classes,
                      )}
                    />
                  )}
                </Box>
                <Grid container spacing={1}>
                  {resource.namespace && (
                    <Grid item xs={12} sm={6}>
                      <Box className={classes.propertyRow}>
                        <Typography className={classes.propertyKey}>
                          Namespace:
                        </Typography>
                        <Typography className={classes.propertyValueCode}>
                          {resource.namespace}
                        </Typography>
                      </Box>
                    </Grid>
                  )}
                  <Grid item xs={12} sm={6}>
                    <Box className={classes.propertyRow}>
                      <Typography className={classes.propertyKey}>
                        API Version:
                      </Typography>
                      <Typography className={classes.propertyValueCode}>
                        {resource.group
                          ? `${resource.group}/${resource.version}`
                          : resource.version}
                      </Typography>
                    </Box>
                  </Grid>
                  {resource.lastObservedTime && (
                    <Grid item xs={12} sm={6}>
                      <Box className={classes.propertyRow}>
                        <Typography className={classes.propertyKey}>
                          Last Observed:
                        </Typography>
                        <Typography className={classes.propertyValue}>
                          {formatTimestamp(resource.lastObservedTime)}
                        </Typography>
                      </Box>
                    </Grid>
                  )}
                </Grid>

                {/* Status Details Accordion */}
                {resource.status && Object.keys(resource.status).length > 0 && (
                  <Box mt={2}>
                    <Accordion className={classes.accordion}>
                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography variant="body2" style={{ fontWeight: 500 }}>
                          Status Details
                        </Typography>
                      </AccordionSummary>
                      <AccordionDetails>
                        <pre
                          style={{
                            margin: 0,
                            fontSize: '0.75rem',
                            overflowX: 'auto',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                          }}
                        >
                          {JSON.stringify(resource.status, null, 2)}
                        </pre>
                      </AccordionDetails>
                    </Accordion>
                  </Box>
                )}
              </Box>
            ))}
          </Box>
        )}

        {/* Resource Definitions */}
        {group.definitions.length > 0 && (
          <Box className={classes.section}>
            <Typography className={classes.sectionTitle}>
              Resource Definitions ({group.definitions.length})
            </Typography>
            {group.definitions.map((def, index) => (
              <Accordion key={def.id || index} className={classes.accordion}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="body2" style={{ fontWeight: 500 }}>
                    {def.id}
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <pre
                    style={{
                      margin: 0,
                      fontSize: '0.75rem',
                      overflowX: 'auto',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}
                  >
                    {JSON.stringify(def.object, null, 2)}
                  </pre>
                </AccordionDetails>
              </Accordion>
            ))}
          </Box>
        )}

        {group.resources.length === 0 && group.definitions.length === 0 && (
          <Typography className={classes.emptyValue}>
            No resources found for this type
          </Typography>
        )}
      </Box>
    );
  };

  // Render active tab content
  const renderTabContent = () => {
    if (activeTab === 'overview') {
      return renderOverviewContent();
    }

    if (activeTab.startsWith('resource-')) {
      const kind = activeTab.replace('resource-', '');
      const group = resourceGroups.find(g => g.kind === kind);
      if (group) {
        return renderResourceGroupContent(group);
      }
    }

    return null;
  };

  return (
    <VerticalTabNav
      tabs={tabs}
      activeTabId={activeTab}
      onChange={setActiveTab}
      className={classes.tabNav}
    >
      {renderTabContent()}
    </VerticalTabNav>
  );
};
