import { MouseEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Page, Header, Content } from '@backstage/core-components';
import { useApi, useRouteRef } from '@backstage/core-plugin-api';
import { catalogApiRef, entityRouteRef } from '@backstage/plugin-catalog-react';
import { makeStyles } from '@material-ui/core/styles';
import FormControl from '@material-ui/core/FormControl';
import InputLabel from '@material-ui/core/InputLabel';
import Select from '@material-ui/core/Select';
import MenuItem from '@material-ui/core/MenuItem';
import {
  PlatformOverviewGraphView,
  GraphKindFilter,
  buildDynamicView,
  APPLICATION_VIEW,
  type EntityNode,
} from '@openchoreo/backstage-plugin-react';
import { useQueryParams } from '@openchoreo/backstage-plugin';

const useStyles = makeStyles({
  content: {
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
  },
  namespaceSelector: {
    minWidth: 160,
  },
});

const DEFAULT_KINDS = APPLICATION_VIEW.kinds;

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
  const [params, setParams] = useQueryParams<{ kinds: string; ns: string }>({
    kinds: {
      defaultValue: DEFAULT_KINDS.join(','),
    },
    ns: { defaultValue: 'default' },
  });
  const navigate = useNavigate();
  const catalogEntityRoute = useRouteRef(entityRouteRef);
  const namespaces = useNamespaces();

  const selectedKinds = useMemo(
    () =>
      typeof params.kinds === 'string'
        ? params.kinds.split(',').filter(Boolean)
        : DEFAULT_KINDS,
    [params.kinds],
  );

  const currentView = useMemo(
    () => buildDynamicView(selectedKinds),
    [selectedKinds],
  );

  const handleKindsChange = useCallback(
    (kinds: string[]) => {
      setParams({ kinds: kinds.join(',') });
    },
    [setParams],
  );

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
        subtitle={currentView.description}
      />
      <Content stretch noPadding className={classes.content}>
        <GraphKindFilter
          selectedKinds={selectedKinds}
          onKindsChange={handleKindsChange}
          leading={
            <FormControl
              variant="outlined"
              size="small"
              className={classes.namespaceSelector}
            >
              <InputLabel id="graph-namespace-label">Namespace</InputLabel>
              <Select
                labelId="graph-namespace-label"
                label="Namespace"
                value={params.ns}
                onChange={e => setParams({ ns: e.target.value as string })}
              >
                {namespaces.map(ns => (
                  <MenuItem key={ns} value={ns}>
                    {ns}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          }
        />
        <PlatformOverviewGraphView
          view={currentView}
          namespace={params.ns}
          onNodeClick={handleNodeClick}
        />
      </Content>
    </Page>
  );
}
