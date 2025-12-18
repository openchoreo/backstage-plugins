import { useMemo, useState } from 'react';
import { Box, Typography } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import {
  Page,
  Header,
  Content,
  WarningPanel,
} from '@backstage/core-components';
import SecurityIcon from '@material-ui/icons/Security';
import PeopleIcon from '@material-ui/icons/People';
import ListAltIcon from '@material-ui/icons/ListAlt';
import {
  VerticalTabNav,
  TabItemData,
} from '@openchoreo/backstage-design-system';
import { RolesTab } from './RolesTab';
import { MappingsTab } from './MappingsTab';
import { ActionsTab } from './ActionsTab';
import { useRoles } from './hooks/useRoles';

const useStyles = makeStyles(theme => ({
  content: {
    padding: theme.spacing(3),
    height: 'calc(100vh - 180px)',
  },
  tabNav: {
    height: '100%',
  },
}));

type TabId = 'roles' | 'mappings' | 'actions';

const isAuthzDisabledError = (error: Error | null): boolean => {
  if (!error) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes('authorization is disabled') ||
    msg.includes('policy management operations are not available') ||
    (msg.includes('403') && msg.includes('forbidden'))
  );
};

export const AccessControlPage = () => {
  const classes = useStyles();
  const [activeTab, setActiveTab] = useState<TabId>('roles');
  const { error: rolesError, loading: rolesLoading } = useRoles();

  const authzDisabled = !rolesLoading && isAuthzDisabledError(rolesError);

  const tabs = useMemo<TabItemData[]>(
    () => [
      {
        id: 'roles',
        label: 'Roles',
        icon: <SecurityIcon fontSize="small" />,
      },
      {
        id: 'mappings',
        label: 'Role Mappings',
        icon: <PeopleIcon fontSize="small" />,
      },
      {
        id: 'actions',
        label: 'Actions',
        icon: <ListAltIcon fontSize="small" />,
      },
    ],
    [],
  );

  const renderTabContent = () => {
    switch (activeTab) {
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
        <Box className={classes.tabNav}>
          <VerticalTabNav
            tabs={tabs}
            activeTabId={activeTab}
            onChange={tabId => setActiveTab(tabId as TabId)}
          >
            {renderTabContent()}
          </VerticalTabNav>
        </Box>
      </Content>
    </Page>
  );
};
