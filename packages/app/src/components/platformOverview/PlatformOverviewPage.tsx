import { MouseEvent, useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Page,
  Header,
  Content,
  HeaderTabs,
  Select,
} from '@backstage/core-components';
import { useApi, useRouteRef } from '@backstage/core-plugin-api';
import { catalogApiRef, entityRouteRef } from '@backstage/plugin-catalog-react';
import Box from '@material-ui/core/Box';
import { makeStyles } from '@material-ui/core/styles';
import {
  PlatformOverviewGraphView,
  ALL_VIEWS,
  type EntityNode,
} from '@openchoreo/backstage-plugin-react';

const useStyles = makeStyles(theme => ({
  content: {
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
  },
  namespaceSelector: {
    position: 'absolute',
    top: theme.spacing(2),
    left: theme.spacing(2),
    zIndex: 1,
    minWidth: 180,
  },
}));

const tabs = ALL_VIEWS.map(view => ({ id: view.id, label: view.label }));

function useNamespaces() {
  const catalogApi = useApi(catalogApiRef);
  const [namespaces, setNamespaces] = useState<string[]>(['default']);

  const fetchNamespaces = useCallback(async () => {
    const response = await catalogApi.getEntities({
      filter: { kind: 'Domain' },
      fields: ['metadata.name'],
    });
    const names = response.items.map(e => e.metadata.name).sort();
    if (names.length > 0) {
      setNamespaces(names);
    }
  }, [catalogApi]);

  useEffect(() => {
    fetchNamespaces();
  }, [fetchNamespaces]);

  return namespaces;
}

export function PlatformOverviewPage() {
  const classes = useStyles();
  const [activeTab, setActiveTab] = useState(0);
  const [namespace, setNamespace] = useState('default');
  const navigate = useNavigate();
  const catalogEntityRoute = useRouteRef(entityRouteRef);
  const namespaces = useNamespaces();

  const handleNodeClick = (node: EntityNode, _event: MouseEvent<unknown>) => {
    const route = catalogEntityRoute({
      kind: node.kind ?? 'component',
      namespace: node.namespace ?? 'default',
      name: node.name,
    });
    navigate(route);
  };

  return (
    <Page themeId="tool">
      <Header
        title="Platform Overview"
        subtitle={ALL_VIEWS[activeTab].description}
      />
      <HeaderTabs
        selectedIndex={activeTab}
        onChange={setActiveTab}
        tabs={tabs}
      />
      <Content stretch noPadding className={classes.content}>
        <Box
          position="relative"
          flex={1}
          minHeight={0}
          display="flex"
          flexDirection="column"
        >
          <Box className={classes.namespaceSelector}>
            <Select
              label="Namespace"
              items={namespaces.map(ns => ({ label: ns, value: ns }))}
              selected={namespace}
              onChange={value => setNamespace(String(value))}
            />
          </Box>
          <PlatformOverviewGraphView
            view={ALL_VIEWS[activeTab]}
            namespace={namespace}
            onNodeClick={handleNodeClick}
          />
        </Box>
      </Content>
    </Page>
  );
}
