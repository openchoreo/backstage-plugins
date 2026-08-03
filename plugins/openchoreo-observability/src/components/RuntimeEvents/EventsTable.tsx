import { FC, useCallback } from 'react';
import { Paper, Box, Typography, CircularProgress } from '@material-ui/core';
import { Skeleton } from '@openchoreo/backstage-design-system';
import {
  VirtualizedLogList,
  useAutoLoadWhenEmpty,
  useRowExpansion,
} from '@openchoreo/backstage-plugin-react';
import { EventEntryField, EventEntry as EventEntryType } from './types';
import { EventEntry } from './EventEntry';
import { useEventsTableStyles } from './styles';
import { getColumnStyle } from './columns';

interface EventsTableProps {
  selectedFields: EventEntryField[];
  events: EventEntryType[];
  loading: boolean;
  hasMore: boolean;
  /** Called when the user scrolls near the end of the list. */
  onLoadMore: () => void;
  environmentName?: string;
  projectName?: string;
  componentName?: string;
}

// Matches the height the table scroll area used to have (full viewport minus
// the header, filters and actions bars above it).
const EVENTS_HEIGHT = 'calc(100vh - 320px)';

export const EventsTable: FC<EventsTableProps> = ({
  selectedFields,
  events,
  loading,
  hasMore,
  onLoadMore,
  environmentName,
  projectName,
  componentName,
}) => {
  const classes = useEventsTableStyles();

  // Expanded rows are tracked here (not inside <EventEntry>) so the state
  // survives the virtualizer unmounting rows that scroll off-screen.
  const { expanded, toggle } = useRowExpansion();

  // The virtualizer doesn't render a load-more sentinel when the list is
  // empty, so the auto-fetch behaviour the old IntersectionObserver gave us
  // has to be re-created explicitly for the "0 rows but hasMore=true" case.
  useAutoLoadWhenEmpty({
    count: events.length,
    hasMore,
    loading,
    onLoadMore,
  });
  const getRowKey = useCallback(
    (index: number) => `${events[index].timestamp}-${index}`,
    [events],
  );

  const header = (
    <Box className={classes.headerRow} role="row">
      {selectedFields.map(field => (
        <Box
          key={field}
          role="columnheader"
          style={getColumnStyle(field)}
          className={classes.headerColumn}
        >
          {field}
        </Box>
      ))}
    </Box>
  );

  const footer = hasMore ? (
    <div className={classes.loadingContainer}>
      {loading ? (
        <Box display="flex" alignItems="center" role="status" aria-busy="true">
          <CircularProgress size={20} aria-hidden="true" />
          <Typography variant="body2" style={{ marginLeft: 8 }}>
            Loading more events...
          </Typography>
        </Box>
      ) : (
        <Typography variant="body2" color="textSecondary">
          Scroll to load more events
        </Typography>
      )}
    </div>
  ) : null;

  const renderLoadingSkeletons = () =>
    Array.from({ length: 5 }).map((_, index) => (
      <Box key={`skeleton-${index}`} className={classes.skeletonRow}>
        {selectedFields.map(field => (
          <Box
            key={field}
            style={getColumnStyle(field)}
            className={classes.cell}
          >
            <Skeleton variant="text" width="100%" />
          </Box>
        ))}
      </Box>
    ));

  const renderEmptyState = () => (
    <Box className={classes.emptyState}>
      <Typography variant="h6" gutterBottom>
        No events found
      </Typography>
      <Typography variant="body2">
        Try adjusting your filters or time range to see more events.
      </Typography>
    </Box>
  );

  return (
    <Paper
      className={classes.tablePaper}
      role="table"
      aria-label="Runtime events"
    >
      {events.length === 0 ? (
        // No footer when empty: "Loading more events…" misleads on the initial
        // load, and "Scroll to load more" is meaningless when there's nothing
        // to scroll. The auto-load is driven by `useAutoLoadWhenEmpty` above.
        <>
          {header}
          {loading ? renderLoadingSkeletons() : renderEmptyState()}
        </>
      ) : (
        <VirtualizedLogList
          itemCount={events.length}
          maxHeight={EVENTS_HEIGHT}
          estimatedRowHeight={32}
          getItemKey={getRowKey}
          hasMore={hasMore}
          loading={loading}
          onReachEnd={onLoadMore}
          header={header}
          footer={footer}
          renderRow={index => {
            const key = getRowKey(index);
            return (
              <EventEntry
                event={events[index]}
                selectedFields={selectedFields}
                environmentName={environmentName}
                projectName={projectName}
                componentName={componentName}
                expanded={expanded.has(key)}
                onToggleExpand={() => toggle(key)}
              />
            );
          }}
        />
      )}
    </Paper>
  );
};
