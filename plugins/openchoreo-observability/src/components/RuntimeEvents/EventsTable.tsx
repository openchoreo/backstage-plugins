import { RefObject, FC } from 'react';
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Paper,
  Box,
  Typography,
  CircularProgress,
} from '@material-ui/core';
import { Skeleton } from '@material-ui/lab';
import { EventEntryField, EventEntry as EventEntryType } from './types';
import { EventEntry } from './EventEntry';
import { useEventsTableStyles } from './styles';

interface EventsTableProps {
  selectedFields: EventEntryField[];
  events: EventEntryType[];
  loading: boolean;
  hasMore: boolean;
  loadingRef: RefObject<HTMLDivElement>;
  environmentName?: string;
  projectName?: string;
  componentName?: string;
}

const columnWidth = (
  field: EventEntryField,
  selectedFields: EventEntryField[],
): string | undefined => {
  switch (field) {
    case EventEntryField.Timestamp:
      return '15%';
    case EventEntryField.Type:
      return '10%';
    case EventEntryField.Reason:
      return '12%';
    case EventEntryField.Object:
      return '20%';
    default: {
      // Message takes whatever the other selected columns leave behind.
      const used =
        (selectedFields.includes(EventEntryField.Timestamp) ? 15 : 0) +
        (selectedFields.includes(EventEntryField.Reason) ? 12 : 0) +
        (selectedFields.includes(EventEntryField.Type) ? 10 : 0) +
        (selectedFields.includes(EventEntryField.Object) ? 20 : 0);
      return `${100 - used}%`;
    }
  }
};

export const EventsTable: FC<EventsTableProps> = ({
  selectedFields,
  events,
  loading,
  hasMore,
  loadingRef,
  environmentName,
  projectName,
  componentName,
}) => {
  const classes = useEventsTableStyles();

  const totalColumns = selectedFields.length;

  const renderLoadingSkeletons = () => {
    return Array.from({ length: 5 }).map((_, index) => (
      <TableRow key={`skeleton-${index}`}>
        {selectedFields.map(field => (
          <TableCell key={field} width={columnWidth(field, selectedFields)}>
            <Skeleton variant="text" width="100%" />
          </TableCell>
        ))}
      </TableRow>
    ));
  };

  const renderEmptyState = () => {
    if (loading) {
      return null;
    }

    return (
      <TableRow>
        <TableCell colSpan={totalColumns}>
          <Box className={classes.emptyState}>
            <Typography variant="h6" gutterBottom>
              No events found
            </Typography>
            <Typography variant="body2">
              Try adjusting your filters or time range to see more events.
            </Typography>
          </Box>
        </TableCell>
      </TableRow>
    );
  };

  return (
    <Paper className={classes.tablePaper}>
      <Box className={classes.tableContainer}>
        <Table className={classes.table} stickyHeader>
          <TableHead>
            <TableRow>
              {selectedFields.map(field => (
                <TableCell
                  key={field}
                  scope="col"
                  className={classes.headerCell}
                  width={columnWidth(field, selectedFields)}
                >
                  {field}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {events.length === 0 && !loading && renderEmptyState()}

            {events.length === 0 && loading && renderLoadingSkeletons()}

            {events.map((event, index) => (
              <EventEntry
                key={`${event.timestamp}-${index}`}
                event={event}
                selectedFields={selectedFields}
                environmentName={environmentName}
                projectName={projectName}
                componentName={componentName}
              />
            ))}

            {hasMore && (
              <TableRow>
                <TableCell colSpan={totalColumns}>
                  <div className={classes.loadingContainer} ref={loadingRef}>
                    {loading ? (
                      <Box
                        display="flex"
                        alignItems="center"
                        role="status"
                        aria-busy="true"
                      >
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
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Box>
    </Paper>
  );
};
