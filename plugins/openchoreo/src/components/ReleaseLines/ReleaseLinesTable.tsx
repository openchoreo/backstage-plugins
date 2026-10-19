import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@material-ui/core/Box';
import IconButton from '@material-ui/core/IconButton';
import Typography from '@material-ui/core/Typography';
import ChevronLeftIcon from '@material-ui/icons/ChevronLeft';
import ChevronRightIcon from '@material-ui/icons/ChevronRight';
import type { Entity } from '@backstage/catalog-model';
import { Table, type TableColumn } from '@backstage/core-components';
import type { ReleaseLineSummary } from '@openchoreo/backstage-plugin-common';
import { shouldNavigateOnRowClick } from '../../utils/shouldNavigateOnRowClick';
import { RowDeleteButton } from '../DeleteEntity';
import { useProjectContentsCardStyles } from '../Projects/ProjectContentsCard/styles';
import { ReleaseLineEnvironmentsCell } from './ReleaseLineEnvironmentsCell';
import { ReleaseLineNameCell } from './ReleaseLineNameCell';
import {
  releaseLineEntityPath,
  releaseLineRowEntity,
} from './releaseLineUtils';

export const RELEASE_LINES_PAGE_SIZE = 10;

export interface ReleaseLinesTableProps {
  /** The component the release lines belong to. */
  component: Entity;
  releaseLines: ReleaseLineSummary[];
  /** Open the delete-confirmation dialog for a release line. */
  onDelete: (releaseLine: Entity) => void;
}

/**
 * The release lines of a component, one row per line, in the same table and
 * pager as the project's contents. Clicking anywhere on a row opens the line.
 */
export function ReleaseLinesTable({
  component,
  releaseLines,
  onDelete,
}: ReleaseLinesTableProps) {
  const namespace = component.metadata.namespace ?? 'default';
  const listClasses = useProjectContentsCardStyles();
  const navigate = useNavigate();
  const [pageIndex, setPageIndex] = useState(0);

  const pageCount = Math.max(
    1,
    Math.ceil(releaseLines.length / RELEASE_LINES_PAGE_SIZE),
  );
  const currentPage = Math.min(pageIndex, pageCount - 1);
  const rangeStart = currentPage * RELEASE_LINES_PAGE_SIZE;
  const pageItems = releaseLines.slice(
    rangeStart,
    rangeStart + RELEASE_LINES_PAGE_SIZE,
  );

  const columns = useMemo<TableColumn<ReleaseLineSummary>[]>(
    () => [
      {
        title: 'Name',
        field: 'name',
        width: '25%',
        highlight: true,
        render: line => (
          <ReleaseLineNameCell namespace={namespace} name={line.name} />
        ),
      },
      {
        title: 'Description',
        field: 'description',
        width: '35%',
        cellStyle: {
          maxWidth: 220,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        },
        render: line => (
          <Typography variant="body2" noWrap title={line.description}>
            {line.description || '—'}
          </Typography>
        ),
      },
      {
        title: 'Deployment',
        sorting: false,
        width: '35%',
        render: line => (
          <ReleaseLineEnvironmentsCell environments={line.environments} />
        ),
      },
      {
        title: '',
        width: '5%',
        sorting: false,
        cellStyle: { textAlign: 'right', paddingRight: 8 },
        headerStyle: { textAlign: 'right' },
        render: line => (
          <RowDeleteButton
            entity={releaseLineRowEntity(component, line)}
            onDelete={onDelete}
          />
        ),
      },
    ],
    [namespace, component, onDelete],
  );

  return (
    <>
      <div className={listClasses.tableScroll}>
        <Table<ReleaseLineSummary>
          columns={columns}
          data={pageItems}
          onRowClick={(event, line) => {
            if (!line || !shouldNavigateOnRowClick(event)) return;
            navigate(releaseLineEntityPath(namespace, line.name));
          }}
          options={{
            paging: false,
            sorting: true,
            thirdSortClick: false,
            search: false,
            toolbar: false,
            draggable: false,
            padding: 'dense',
            tableLayout: 'fixed',
          }}
          emptyContent={
            <Box p={3}>
              <Typography variant="body1" color="textSecondary" align="center">
                No release lines match the current filters
              </Typography>
            </Box>
          }
          style={{ width: '100%', minWidth: 800, boxShadow: 'none' }}
        />
      </div>
      {releaseLines.length > 0 && (
        <Box className={listClasses.pager}>
          <Typography className={listClasses.pagerLabel}>
            {rangeStart + 1}–{rangeStart + pageItems.length} of{' '}
            {releaseLines.length}
          </Typography>
          <IconButton
            size="small"
            aria-label="Previous page"
            disabled={currentPage === 0}
            onClick={() => setPageIndex(currentPage - 1)}
          >
            <ChevronLeftIcon />
          </IconButton>
          <IconButton
            size="small"
            aria-label="Next page"
            disabled={currentPage >= pageCount - 1}
            onClick={() => setPageIndex(currentPage + 1)}
          >
            <ChevronRightIcon />
          </IconButton>
        </Box>
      )}
    </>
  );
}
