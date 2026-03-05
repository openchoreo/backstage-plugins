import { useMemo } from 'react';
import { Box, Typography } from '@material-ui/core';
import {
  Page,
  Header,
  Content,
  WarningPanel,
  Progress,
} from '@backstage/core-components';
import {
  VerticalTabNav,
  TabItemData,
} from '@openchoreo/backstage-design-system';
import {
  useRolePermissions,
  useRoleMappingPermissions,
} from '@openchoreo/backstage-plugin-react';
import { useQueryParams } from '../../hooks/useQueryParams';
import SecurityIcon from '@material-ui/icons/Security';
import LinkIcon from '@material-ui/icons/Link';
import ListAltIcon from '@material-ui/icons/ListAlt';
import { RolesTab } from './RolesTab';
import { MappingsTab } from './MappingsTab';
import { ActionsTab } from './ActionsTab';
import { useClusterRoles } from './hooks';
import { useStyles } from './styles';

const TAB_ROLES = 'roles';
const TAB_MAPPINGS = 'mappings';
const TAB_ACTIONS = 'actions';

const isAuthzDisabledError = (error: Error | null): boolean => {
  if (!error) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes('authorization is disabled') ||
    msg.includes('policy management operations are not available')
  );
};

/**
 * Access Control content without Page/Header/Content wrapper.
 * Used inside the unified SettingsPage.
 */
export const AccessControlContent = () => {
  const classes = useStyles();
  const { error: rolesError, loading: rolesLoading } = useClusterRoles();
  const { canView: canViewRoles, loading: rolesPermissionLoading } =
    useRolePermissions();
  const { canView: canViewMappings, loading: mappingsPermissionLoading } =
    useRoleMappingPermissions();

  const authzDisabled = !rolesLoading && isAuthzDisabledError(rolesError);
  const permissionsLoading =
    rolesPermissionLoading || mappingsPermissionLoading;

  const tabs = useMemo<TabItemData[]>(() => {
    const visibleTabs: TabItemData[] = [];
    if (canViewRoles) {
      visibleTabs.push({
        id: TAB_ROLES,
        label: 'Roles',
        icon: <SecurityIcon />,
      });
    }
    if (canViewMappings) {
      visibleTabs.push({
        id: TAB_MAPPINGS,
        label: 'Role Bindings',
        icon: <LinkIcon />,
      });
    }
    visibleTabs.push({
      id: TAB_ACTIONS,
      label: 'Actions',
      icon: <ListAltIcon />,
    });
    return visibleTabs;
  }, [canViewRoles, canViewMappings]);

  const defaultTab = tabs[0]?.id ?? TAB_ACTIONS;
  const [params, setParams] = useQueryParams({
    tab: { defaultValue: defaultTab },
  });
  const activeTab = (params.tab as string) ?? defaultTab;
  const setActiveTab = (tab: string) => setParams({ tab });

  if (permissionsLoading) {
    return <Progress />;
  }

  if (authzDisabled) {
    return (
      <WarningPanel severity="info" title="Authorization is Disabled">
        <Typography variant="body1">
          Policy management operations are not available because authorization
          is disabled in the OpenChoreo backend configuration.
        </Typography>
        <Typography variant="body2" style={{ marginTop: 16 }}>
          To enable authorization, configure the OpenChoreo backend with:
        </Typography>
        <Box
          component="pre"
          style={{
            marginTop: 8,
            padding: 12,
            backgroundColor: '#f5f5f5',
            borderRadius: 4,
            overflow: 'auto',
          }}
        >
          {`authz:
  enabled: true
  databasePath: /path/to/authz.db
  userTypeConfigs:
    - subjectType: user
      claimKey: groups`}
        </Box>
      </WarningPanel>
    );
  }

  return (
    <Box className={classes.verticalTabWrapper}>
      <VerticalTabNav
        tabs={tabs}
        activeTabId={activeTab}
        onChange={setActiveTab}
      >
        <Box className={classes.tabPanel}>
          {activeTab === TAB_ROLES && <RolesTab />}
          {activeTab === TAB_MAPPINGS && <MappingsTab />}
          {activeTab === TAB_ACTIONS && <ActionsTab />}
        </Box>
      </VerticalTabNav>
    </Box>
  );
};

/**
 * Standalone Access Control page (backwards compatibility).
 */
export const AccessControlPage = () => {
  const classes = useStyles();

  return (
    <Page themeId="tool">
      <Header
        title="Access Control"
        subtitle="Manage roles, permissions, and entitlement mappings"
      />
      <Content className={classes.content}>
        <AccessControlContent />
      </Content>
    </Page>
  );
};
