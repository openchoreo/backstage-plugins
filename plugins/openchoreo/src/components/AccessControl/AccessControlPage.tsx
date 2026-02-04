import { useMemo, useState } from 'react';
import { Box, Typography } from '@material-ui/core';
import {
  Page,
  Header,
  Content,
  WarningPanel,
  HeaderTabs,
  Progress,
} from '@backstage/core-components';
import {
  useRolePermissions,
  useRoleMappingPermissions,
} from '@openchoreo/backstage-plugin-react';
import { RolesTab } from './RolesTab';
import { MappingsTab } from './MappingsTab';
import { ActionsTab } from './ActionsTab';
import { useClusterRoles } from './hooks';
import { useStyles } from './styles';

const isAuthzDisabledError = (error: Error | null): boolean => {
  if (!error) return false;
  const msg = error.message.toLowerCase();
  // Only check for explicit "authz disabled" messages from the backend.
  // Do NOT treat 403 as authz disabled - 403 means authz IS enabled but user lacks permission.
  return (
    msg.includes('authorization is disabled') ||
    msg.includes('policy management operations are not available')
  );
};

const AccessControlPageContent = () => {
  const classes = useStyles();
  const [selectedTab, setSelectedTab] = useState(0);
  const { error: rolesError, loading: rolesLoading } = useClusterRoles();
  const { canView: canViewRoles, loading: rolesPermissionLoading } =
    useRolePermissions();
  const { canView: canViewMappings, loading: mappingsPermissionLoading } =
    useRoleMappingPermissions();

  const authzDisabled = !rolesLoading && isAuthzDisabledError(rolesError);
  const permissionsLoading =
    rolesPermissionLoading || mappingsPermissionLoading;

  const tabs = useMemo(() => {
    const visibleTabs = [];
    if (canViewRoles) {
      visibleTabs.push({ id: 'roles', label: 'Roles' });
    }
    if (canViewMappings) {
      visibleTabs.push({ id: 'mappings', label: 'Role Bindings' });
    }
    visibleTabs.push({ id: 'actions', label: 'Actions' });
    return visibleTabs;
  }, [canViewRoles, canViewMappings]);

  const handleTabChange = (index: number) => {
    setSelectedTab(index);
  };

  const renderTabContent = () => {
    const currentTab = tabs[selectedTab];
    switch (currentTab?.id) {
      case 'roles':
        return <RolesTab />;
      case 'mappings':
        return <MappingsTab />;
      case 'actions':
        return <ActionsTab />;
      default:
        return null;
    }
  };

  if (permissionsLoading) {
    return (
      <Page themeId="tool">
        <Header
          title="Access Control"
          subtitle="Manage roles, permissions, and entitlement mappings"
        />
        <Content className={classes.content}>
          <Progress />
        </Content>
      </Page>
    );
  }

  if (authzDisabled) {
    return (
      <Page themeId="tool">
        <Header
          title="Access Control"
          subtitle="Manage roles, permissions, and entitlement mappings"
        />
        <Content className={classes.content}>
          <WarningPanel severity="info" title="Authorization is Disabled">
            <Typography variant="body1">
              Policy management operations are not available because
              authorization is disabled in the OpenChoreo backend configuration.
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
        </Content>
      </Page>
    );
  }

  return (
    <Page themeId="tool">
      <Header
        title="Access Control"
        subtitle="Manage roles, permissions, and entitlement mappings"
      />
      <Content className={classes.content}>
        <Box className={classes.tabsWrapper}>
          <HeaderTabs
            selectedIndex={selectedTab}
            onChange={handleTabChange}
            tabs={tabs}
          />
        </Box>
        <Box className={classes.tabPanel}>{renderTabContent()}</Box>
      </Content>
    </Page>
  );
};

/**
 * Access Control page for managing roles, permissions, and entitlement mappings.
 */
export const AccessControlPage = AccessControlPageContent;
