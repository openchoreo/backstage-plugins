import { useCallback } from 'react';

import { makeStyles } from '@material-ui/core/styles';
import Card from '@material-ui/core/Card';
import CardContent from '@material-ui/core/CardContent';
import CardHeader from '@material-ui/core/CardHeader';
import Divider from '@material-ui/core/Divider';
import IconButton from '@material-ui/core/IconButton';
import Grid from '@material-ui/core/Grid';
import Chip from '@material-ui/core/Chip';
import CachedIcon from '@material-ui/icons/Cached';
import EditIcon from '@material-ui/icons/Edit';
import DocsIcon from '@material-ui/icons/Description';

import {
  HeaderIconLinkRow,
  type IconLinkVerticalProps,
  type InfoCardVariants,
  Link,
  MarkdownContent,
} from '@backstage/core-components';
import { alertApiRef, errorApiRef, useApi } from '@backstage/core-plugin-api';

import {
  ScmIntegrationIcon,
  scmIntegrationsApiRef,
} from '@backstage/integration-react';

import {
  ANNOTATION_LOCATION,
  RELATION_OWNED_BY,
  RELATION_PART_OF,
  stringifyEntityRef,
  type Entity,
} from '@backstage/catalog-model';
import {
  catalogApiRef,
  EntityRefLinks,
  getEntityRelations,
  getEntitySourceLocation,
  useEntity,
} from '@backstage/plugin-catalog-react';
import { useEntityPermission } from '@backstage/plugin-catalog-react/alpha';
import { catalogEntityRefreshPermission } from '@backstage/plugin-catalog-common/alpha';

import {
  TECHDOCS_ANNOTATION,
  TECHDOCS_EXTERNAL_ANNOTATION,
} from '@backstage/plugin-techdocs-common';

import { AboutField } from '@backstage/plugin-catalog';
import { useResourceDefinitionPermission } from '@openchoreo/backstage-plugin-react';

const useStyles = makeStyles({
  gridItemCard: {
    display: 'flex',
    flexDirection: 'column',
    height: 'calc(100% - 10px)',
    marginBottom: '10px',
  },
  fullHeightCard: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  },
  gridItemCardContent: {
    flex: 1,
  },
  fullHeightCardContent: {
    flex: 1,
  },
  description: {
    wordBreak: 'break-word',
  },
});

function AboutCardSubheader() {
  const { entity } = useEntity();
  const scmIntegrationsApi = useApi(scmIntegrationsApiRef);

  const entitySourceLocation = getEntitySourceLocation(
    entity,
    scmIntegrationsApi,
  );

  const hasTechDocs =
    !!entity.metadata.annotations?.[TECHDOCS_ANNOTATION] ||
    !!entity.metadata.annotations?.[TECHDOCS_EXTERNAL_ANNOTATION];

  const techDocsUrl = hasTechDocs
    ? `/docs/${entity.metadata.namespace ?? 'default'}/${entity.kind}/${
        entity.metadata.name
      }`
    : undefined;

  const links: IconLinkVerticalProps[] = [];

  if (entitySourceLocation) {
    links.push({
      label: 'View Source',
      icon: <ScmIntegrationIcon type={entitySourceLocation.integrationType} />,
      href: entitySourceLocation.locationTargetUrl,
    });
  }

  if (hasTechDocs && techDocsUrl) {
    links.push({
      label: 'View TechDocs',
      icon: <DocsIcon />,
      href: techDocsUrl,
    });
  }

  if (links.length === 0) {
    return null;
  }

  return <HeaderIconLinkRow links={links} />;
}

/**
 * Custom about card content for OpenChoreo entities.
 * Renames "Domain" → "Namespace" and "System" → "Project" labels.
 */
function OpenChoreoAboutContent({ entity }: { entity: Entity }) {
  const classes = useStyles();

  const isSystem = entity.kind.toLocaleLowerCase('en-US') === 'system';
  const isComponent = entity.kind.toLocaleLowerCase('en-US') === 'component';
  const isAPI = entity.kind.toLocaleLowerCase('en-US') === 'api';
  const isResource = entity.kind.toLocaleLowerCase('en-US') === 'resource';

  const partOfSystemRelations = getEntityRelations(entity, RELATION_PART_OF, {
    kind: 'system',
  });
  const partOfComponentRelations = getEntityRelations(
    entity,
    RELATION_PART_OF,
    { kind: 'component' },
  );
  const partOfDomainRelations = getEntityRelations(entity, RELATION_PART_OF, {
    kind: 'domain',
  });
  const ownedByRelations = getEntityRelations(entity, RELATION_OWNED_BY);

  return (
    <Grid container>
      <AboutField label="Description" gridSizes={{ xs: 12 }}>
        <MarkdownContent
          className={classes.description}
          content={entity?.metadata?.description || 'No description'}
        />
      </AboutField>
      <AboutField
        label="Owner"
        value="No Owner"
        className={classes.description}
        gridSizes={{ xs: 12, sm: 6, lg: 4 }}
      >
        {ownedByRelations.length > 0 && (
          <EntityRefLinks entityRefs={ownedByRelations} defaultKind="group" />
        )}
      </AboutField>
      {(isSystem || partOfDomainRelations.length > 0) && (
        <AboutField
          label="Namespace"
          value="No Namespace"
          gridSizes={{ xs: 12, sm: 6, lg: 4 }}
        >
          {partOfDomainRelations.length > 0 && (
            <EntityRefLinks
              entityRefs={partOfDomainRelations}
              defaultKind="domain"
            />
          )}
        </AboutField>
      )}
      {(isAPI ||
        isComponent ||
        isResource ||
        partOfSystemRelations.length > 0) && (
        <AboutField
          label="Project"
          value="No Project"
          gridSizes={{ xs: 12, sm: 6, lg: 4 }}
        >
          {partOfSystemRelations.length > 0 && (
            <EntityRefLinks
              entityRefs={partOfSystemRelations}
              defaultKind="system"
            />
          )}
        </AboutField>
      )}
      {isComponent && partOfComponentRelations.length > 0 && (
        <AboutField
          label="Parent Component"
          value="No Parent Component"
          gridSizes={{ xs: 12, sm: 6, lg: 4 }}
        >
          <EntityRefLinks
            entityRefs={partOfComponentRelations}
            defaultKind="component"
          />
        </AboutField>
      )}
      {typeof entity?.spec?.type === 'string' && (
        <AboutField
          label="Type"
          value={entity.spec.type as string}
          gridSizes={{ xs: 12, sm: 6, lg: 4 }}
        />
      )}
      {(isAPI ||
        isComponent ||
        typeof entity?.spec?.lifecycle === 'string') && (
        <AboutField
          label="Lifecycle"
          value={entity?.spec?.lifecycle as string}
          gridSizes={{ xs: 12, sm: 6, lg: 4 }}
        />
      )}
      <AboutField
        label="Tags"
        value="No Tags"
        gridSizes={{ xs: 12, sm: 6, lg: 4 }}
      >
        {(entity?.metadata?.tags || []).map(tag => (
          <Chip key={tag} size="small" label={tag} />
        ))}
      </AboutField>
    </Grid>
  );
}

interface OpenChoreoAboutCardProps {
  variant?: InfoCardVariants;
  /** Show the edit icon linking to the /definition tab (default: false) */
  showEditIcon?: boolean;
}

/**
 * Custom about card for OpenChoreo-governed entity kinds.
 *
 * Differences from the upstream EntityAboutCard:
 * - Edit icon links to the /definition tab and is gated by resource update permission
 * - View Source / View TechDocs are hidden entirely when annotations are not present
 * - Scaffolder "create similar" button is omitted
 * - "Domain" label renamed to "Namespace", "System" to "Project"
 */
export function OpenChoreoAboutCard({
  variant,
  showEditIcon = false,
}: OpenChoreoAboutCardProps) {
  const classes = useStyles();
  const { entity } = useEntity();
  const catalogApi = useApi(catalogApiRef);
  const alertApi = useApi(alertApiRef);
  const errorApi = useApi(errorApiRef);
  const { allowed: canRefresh } = useEntityPermission(
    catalogEntityRefreshPermission,
  );
  const { canUpdate, loading: permLoading } = useResourceDefinitionPermission();

  let cardClass = '';
  if (variant === 'gridItem') {
    cardClass = classes.gridItemCard;
  } else if (variant === 'fullHeight') {
    cardClass = classes.fullHeightCard;
  }

  let cardContentClass = '';
  if (variant === 'gridItem') {
    cardContentClass = classes.gridItemCardContent;
  } else if (variant === 'fullHeight') {
    cardContentClass = classes.fullHeightCardContent;
  }

  const entityLocation = entity.metadata.annotations?.[ANNOTATION_LOCATION];
  const allowRefresh =
    entityLocation?.startsWith('url:') || entityLocation?.startsWith('file:');

  const refreshEntity = useCallback(async () => {
    try {
      await catalogApi.refreshEntity(stringifyEntityRef(entity));
      alertApi.post({
        message: 'Refresh scheduled',
        severity: 'info',
        display: 'transient',
      });
    } catch (e) {
      errorApi.post(e as Error);
    }
  }, [catalogApi, entity, alertApi, errorApi]);

  return (
    <Card className={cardClass}>
      <CardHeader
        title="About"
        action={
          <>
            {allowRefresh && canRefresh && (
              <IconButton
                aria-label="Refresh"
                title="Schedule entity refresh"
                onClick={refreshEntity}
              >
                <CachedIcon />
              </IconButton>
            )}
            {showEditIcon && (
              <IconButton
                component={Link}
                aria-label="Edit"
                disabled={permLoading || !canUpdate}
                title={
                  canUpdate
                    ? 'Edit Definition'
                    : 'You do not have permission to edit this resource'
                }
                to="definition"
              >
                <EditIcon />
              </IconButton>
            )}
          </>
        }
        subheader={<AboutCardSubheader />}
      />
      <Divider />
      <CardContent className={cardContentClass}>
        <OpenChoreoAboutContent entity={entity} />
      </CardContent>
    </Card>
  );
}
