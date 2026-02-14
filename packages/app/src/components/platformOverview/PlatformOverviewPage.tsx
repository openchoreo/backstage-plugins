import { MouseEvent, useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Page,
  Header,
  Content,
  HeaderTabs,
} from '@backstage/core-components';
import { useApi, useRouteRef } from '@backstage/core-plugin-api';
import { catalogApiRef, entityRouteRef } from '@backstage/plugin-catalog-react';
import { makeStyles } from '@material-ui/core/styles';
import {
  PlatformOverviewGraphView,
  ALL_VIEWS,
  type EntityNode,
} from '@openchoreo/backstage-plugin-react';

const useStyles = makeStyles({
  content: {
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
  },
});

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
        <PlatformOverviewGraphView
          view={ALL_VIEWS[activeTab]}
          namespace={namespace}
          namespaces={namespaces}
          onNamespaceChange={setNamespace}
          onNodeClick={handleNodeClick}
        />
      </Content>
    </Page>
  );
}
