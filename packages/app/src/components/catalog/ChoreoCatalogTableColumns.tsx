import { Box, Typography } from '@material-ui/core';
import { TableColumn } from '@backstage/core-components';
import {
  CatalogTable,
  CatalogTableRow,
  CatalogTableColumnsFunc,
} from '@backstage/plugin-catalog';
import { EntityRefLinks } from '@backstage/plugin-catalog-react';
import {
  DeletionBadge,
  isMarkedForDeletion,
} from '@openchoreo/backstage-plugin';

/**
 * Custom column factory for creating a "Name" column with deletion badge support.
 * Shows deletion badge and disables clicking for entities marked for deletion.
 */
function createNameColumnWithDeletion(): TableColumn<CatalogTableRow> {
  return {
    title: 'Name',
    field: 'entity.metadata.title',
    highlight: true,
    render: ({ entity, resolved }) => {
      const markedForDeletion = isMarkedForDeletion(entity);

      if (markedForDeletion) {
        // Show name as plain text (not clickable) with deletion badge
        return (
          <Box display="flex" alignItems="center" style={{ gap: 8 }}>
            <Typography
              variant="body2"
              style={{ color: 'rgba(0, 0, 0, 0.38)' }}
            >
              {resolved.name}
            </Typography>
            <DeletionBadge />
          </Box>
        );
      }

      // Normal clickable entity link
      return (
        <EntityRefLinks
          entityRefs={[resolved.entityRef]}
          defaultKind={entity.kind}
        />
      );
    },
  };
}

/**
 * Custom column factory for creating a "Project" column (replaces "System")
 */
function createProjectColumn(): TableColumn<CatalogTableRow> {
  return {
    title: 'System (Project)',
    field: 'resolved.partOfSystemRelationTitle',
    customFilterAndSearch: (query, row) => {
      if (!row.resolved.partOfSystemRelations) {
        return false;
      }

      const systemNames = row.resolved.partOfSystemRelations.map(
        ref => ref.name,
      );

      const searchText = systemNames.join(', ').toLocaleUpperCase('en-US');
      return searchText.includes(query.toLocaleUpperCase('en-US'));
    },
    render: ({ resolved }) => (
      <EntityRefLinks
        entityRefs={resolved.partOfSystemRelations}
        defaultKind="system"
      />
    ),
  };
}

/**
 * Custom catalog table columns function with Choreo naming:
 * - System → Project
 * - Domain → Organization (handled by entity kind picker)
 * - Name column with deletion badge support
 */
export const choreoCatalogTableColumns: CatalogTableColumnsFunc =
  entityListContext => {
    // Get the default columns
    const defaultColumns = CatalogTable.defaultColumnsFunc(entityListContext);

    // Replace columns with custom versions
    return defaultColumns.map(column => {
      if (typeof column !== 'object' || !('field' in column)) {
        return column;
      }

      // Replace the "Name" column with deletion-aware version
      if (column.field === 'resolved.entityRef') {
        return createNameColumnWithDeletion();
      }

      // Replace the "System" column with "Project" column
      if (column.field === 'resolved.partOfSystemRelationTitle') {
        return createProjectColumn();
      }

      return column;
    });
  };
