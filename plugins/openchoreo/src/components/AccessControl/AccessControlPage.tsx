import { useMemo, useState } from 'react';
import { Box, Typography } from '@material-ui/core';
import {
  Page,
  Header,
  Content,
  WarningPanel,
  HeaderTabs,
} from '@backstage/core-components';
import { RolesTab } from './RolesTab';
import { MappingsTab } from './MappingsTab';
import { ActionsTab } from './ActionsTab';
import { useRoles } from './hooks/useRoles';
import { useStyles } from './styles';

const isAuthzDisabledError = (error: Error | null): boolean => {
  if (!error) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes('authorization is disabled') ||
    msg.includes('policy management operations are not available') ||
    (msg.includes('403') && msg.includes('forbidden'))
  );
};

const AccessControlPageContent = () => {
  const classes = useStyles();
  const [selectedTab, setSelectedTab] = useState(0);
  const { error: rolesError, loading: rolesLoading } = useRoles();

  const authzDisabled = !rolesLoading && isAuthzDisabledError(rolesError);

  const tabs = useMemo(
    () => [
      { id: 'roles', label: 'Roles' },
      { id: 'mappings', label: 'Role Mappings' },
      { id: 'actions', label: 'Actions' },
    ],
    [],
  );

  const renderTabContent = () => {
    switch (selectedTab) {
      case 0:
        return <RolesTab />;
      case 1:
        return <MappingsTab />;
      case 2:
        return <ActionsTab />;
      default:
        return null;
    }
  };

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
            onChange={setSelectedTab}
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
