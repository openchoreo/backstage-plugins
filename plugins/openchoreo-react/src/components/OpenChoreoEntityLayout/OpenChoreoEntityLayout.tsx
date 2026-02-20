import { type ComponentProps, type ElementType, type ReactNode } from 'react';
import {
  DEFAULT_NAMESPACE,
  type Entity,
  type EntityRelation,
} from '@backstage/catalog-model';
import {
  Content,
  Link,
  Page,
  Progress,
  RoutedTabs,
  WarningPanel,
} from '@backstage/core-components';
import {
  type IconComponent,
  attachComponentData,
  useApi,
  useElementFilter,
  useRouteRefParams,
} from '@backstage/core-plugin-api';
import {
  catalogApiRef,
  entityRouteRef,
  InspectEntityDialog,
  useAsyncEntity,
} from '@backstage/plugin-catalog-react';
import Alert from '@material-ui/lab/Alert';
import { type TabProps } from '@material-ui/core/Tab';
import useAsync from 'react-use/esm/useAsync';
import { useSearchParams } from 'react-router-dom';
import { CompactEntityHeader } from './CompactEntityHeader';
import { EntityContextMenu } from './EntityContextMenu';

// ----- Route sub-component (same data key as upstream EntityLayout.Route) -----

/** @public */
export type OpenChoreoEntityLayoutRouteProps = {
  path: string;
  title: string;
  children: JSX.Element;
  if?: (entity: Entity) => boolean;
  tabProps?: TabProps<ElementType, { component?: ElementType }>;
};

const dataKey = 'plugin.catalog.entityLayoutRoute';

const Route: (props: OpenChoreoEntityLayoutRouteProps) => null = () => null;
attachComponentData(Route, dataKey, true);
attachComponentData(Route, 'core.gatherMountPoints', true);

// ----- Helpers -----

/** @public */
export interface ExtraContextMenuItem {
  title: string;
  Icon: IconComponent;
  onClick: () => void;
}

function findParentRelation(
  entityRelations: EntityRelation[] = [],
  relationTypes: string[] = [],
) {
  for (const type of relationTypes) {
    const found = entityRelations.find(r => r.type === type);
    if (found) return found;
  }
  return null;
}

// ----- Main component -----

/** @public */
export interface OpenChoreoEntityLayoutProps {
  children?: ReactNode;
  NotFoundComponent?: ReactNode;
  parentEntityRelations?: string[];
  /** Extra items rendered in the 3-dot context menu */
  extraContextMenuItems?: ExtraContextMenuItem[];
  /** Controls the unregister option in the context menu */
  contextMenuOptions?: {
    disableUnregister: boolean | 'visible' | 'hidden' | 'disable';
  };
  /** Override display names for entity kinds (e.g. { system: 'Project', domain: 'Namespace' }) */
  kindDisplayNames?: Record<string, string>;
  /** Pass a fully custom context menu ReactNode. If provided, the built-in menu is not rendered. */
  contextMenu?: ReactNode;
}

/** @public */
export const OpenChoreoEntityLayout = (props: OpenChoreoEntityLayoutProps) => {
  const {
    children,
    NotFoundComponent,
    parentEntityRelations,
    extraContextMenuItems,
    contextMenuOptions,
    kindDisplayNames,
    contextMenu: customContextMenu,
  } = props;

  const { kind, namespace, name } = useRouteRefParams(entityRouteRef);
  const { entity, loading, error } = useAsyncEntity();
  const [searchParams, setSearchParams] = useSearchParams();

  // Process Route children using the same data key as EntityLayout.Route
  const routes = useElementFilter(
    children,
    elements =>
      elements
        .selectByComponentData({
          key: dataKey,
          withStrictError:
            'Child of OpenChoreoEntityLayout must be an OpenChoreoEntityLayout.Route (or EntityLayout.Route)',
        })
        .getElements<OpenChoreoEntityLayoutRouteProps>()
        .flatMap(({ props: elementProps }) => {
          if (!entity) return [];
          if (elementProps.if && !elementProps.if(entity)) return [];
          return [
            {
              path: elementProps.path,
              title: elementProps.title,
              children: elementProps.children,
              tabProps: elementProps.tabProps,
            },
          ];
        }),
    [entity],
  );

  // Compute header title (used for page title)
  const headerTitle =
    entity?.metadata.title ?? name ?? entity?.metadata.name ?? '';

  // Parent entity breadcrumbs
  const parentEntity = findParentRelation(
    entity?.relations ?? [],
    parentEntityRelations ?? [],
  );

  const catalogApi = useApi(catalogApiRef);
  const { value: ancestorEntity } = useAsync(async () => {
    if (parentEntity) {
      return findParentRelation(
        (await catalogApi.getEntityByRef(parentEntity.targetRef))?.relations,
        parentEntityRelations,
      );
    }
    return null;
  }, [parentEntity]);

  // Inspect dialog state
  const selectedInspectTab = searchParams.get('inspect');
  const showInspectTab = typeof selectedInspectTab === 'string';

  const contextMenuNode =
    customContextMenu ??
    (entity ? (
      <EntityContextMenu
        extraContextMenuItems={extraContextMenuItems}
        contextMenuOptions={contextMenuOptions}
        onInspectEntity={() => {
          setSearchParams(prev => {
            const newParams = new URLSearchParams(prev);
            newParams.set('inspect', '');
            return newParams;
          });
        }}
      />
    ) : null);

  return (
    <Page themeId={entity?.spec?.type?.toString() ?? 'home'}>
      {entity && (
        <CompactEntityHeader
          entity={entity}
          headerTitle={headerTitle}
          kind={kind ?? entity.kind}
          entityName={
            entity.metadata.name +
            (namespace && namespace !== DEFAULT_NAMESPACE
              ? ` in ${namespace}`
              : '')
          }
          kindDisplayNames={kindDisplayNames}
          parentEntity={parentEntity}
          ancestorEntity={ancestorEntity}
          contextMenu={contextMenuNode}
        />
      )}

      {loading && <Progress />}

      {entity && <RoutedTabs routes={routes} />}

      {error && (
        <Content>
          <Alert severity="error">{error.toString()}</Alert>
        </Content>
      )}

      {!loading && !error && !entity && (
        <Content>
          {NotFoundComponent ?? (
            <WarningPanel title="Entity not found">
              There is no {kind} with the requested{' '}
              <Link to="https://backstage.io/docs/features/software-catalog/references">
                kind, namespace, and name
              </Link>
              .
            </WarningPanel>
          )}
        </Content>
      )}

      {showInspectTab && entity && (
        <InspectEntityDialog
          entity={entity}
          initialTab={
            (selectedInspectTab as ComponentProps<
              typeof InspectEntityDialog
            >['initialTab']) || undefined
          }
          onSelect={newTab =>
            setSearchParams(prev => {
              const newParams = new URLSearchParams(prev);
              newParams.set('inspect', newTab);
              return newParams;
            })
          }
          open
          onClose={() =>
            setSearchParams(prev => {
              const newParams = new URLSearchParams(prev);
              newParams.delete('inspect');
              return newParams;
            })
          }
        />
      )}
    </Page>
  );
};

OpenChoreoEntityLayout.Route = Route;
