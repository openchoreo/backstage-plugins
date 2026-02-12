import {
  Box,
  CircularProgress,
  IconButton,
  Typography,
} from '@material-ui/core';
import { TablePagination } from '@material-ui/core';
import OpenInNewIcon from '@material-ui/icons/OpenInNew';
import { useApp } from '@backstage/core-plugin-api';
import {
  EntitySearchBar,
  EntityRefLink,
  FavoriteEntity,
  useEntityList,
} from '@backstage/plugin-catalog-react';
import {
  DeletionBadge,
  isMarkedForDeletion,
} from '@openchoreo/backstage-plugin';
import { Entity } from '@backstage/catalog-model';
import { useCardListStyles } from './styles';
import { StarredChip, TypeChip } from './CustomPersonalFilters';

function EntityKindIcon({ entity }: { entity: Entity }) {
  const app = useApp();
  const kind = entity.kind?.toLowerCase();
  const Icon = app.getSystemIcon(`kind:${kind}`);
  if (!Icon) return null;
  return <Icon />;
}

export const CatalogCardList = () => {
  const classes = useCardListStyles();
  const {
    entities,
    totalItems,
    loading,
    filters,
    limit,
    offset,
    setLimit,
    setOffset,
  } = useEntityList();

  const kindLabel = filters.kind?.label || filters.kind?.value || 'Entities';
  const titleText = `All ${kindLabel}${
    totalItems !== undefined ? ` (${totalItems})` : ''
  }`;

  if (loading) {
    return (
      <Box className={classes.loadingContainer}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box className={classes.searchAndTitle}>
        <Typography className={classes.titleText}>{titleText}</Typography>
        <Box display="flex" alignItems="center" style={{ gap: 8 }}>
          <TypeChip />
          <StarredChip />
          <EntitySearchBar />
        </Box>
      </Box>

      {entities.length === 0 ? (
        <Box className={classes.emptyState}>No entities found</Box>
      ) : (
        <Box className={classes.listContainer}>
          {entities.map(entity => {
            const name =
              entity.metadata.title || entity.metadata.name || 'Unnamed';
            const description = entity.metadata.description || '';
            const markedForDeletion = isMarkedForDeletion(entity);

            return (
              <Box
                key={`${entity.kind}:${
                  entity.metadata.namespace || 'default'
                }/${entity.metadata.name}`}
                className={classes.entityCard}
              >
                <Box className={classes.iconContainer}>
                  <EntityKindIcon entity={entity} />
                </Box>
                <Box className={classes.contentContainer}>
                  {markedForDeletion ? (
                    <Box display="flex" alignItems="center" style={{ gap: 8 }}>
                      <Typography className={classes.entityNameDisabled}>
                        {name}
                      </Typography>
                      <DeletionBadge />
                    </Box>
                  ) : (
                    <Typography className={classes.entityName}>
                      <EntityRefLink
                        entityRef={entity}
                        defaultKind={entity.kind}
                      >
                        {name}
                      </EntityRefLink>
                    </Typography>
                  )}
                  {description && (
                    <Typography className={classes.description}>
                      {description}
                    </Typography>
                  )}
                </Box>
                <Box className={classes.actionsContainer}>
                  <FavoriteEntity entity={entity} />
                  {!markedForDeletion && (
                    <EntityRefLink entityRef={entity} defaultKind={entity.kind}>
                      <IconButton size="small">
                        <OpenInNewIcon fontSize="small" />
                      </IconButton>
                    </EntityRefLink>
                  )}
                </Box>
              </Box>
            );
          })}
        </Box>
      )}

      {totalItems !== undefined && totalItems > 0 && (
        <Box className={classes.paginationContainer}>
          <TablePagination
            count={totalItems}
            page={
              offset !== undefined && limit > 0 ? Math.floor(offset / limit) : 0
            }
            onPageChange={(_event, newPage) => {
              setOffset?.(newPage * limit);
            }}
            rowsPerPage={limit}
            onRowsPerPageChange={event => {
              setLimit(parseInt(event.target.value, 10));
              setOffset?.(0);
            }}
            rowsPerPageOptions={[10, 25, 50]}
          />
        </Box>
      )}
    </Box>
  );
};
