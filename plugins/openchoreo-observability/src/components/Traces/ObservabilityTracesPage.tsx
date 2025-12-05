import { useState } from 'react';
import { Content } from '@backstage/core-components';
import {
  Typography,
  TextField,
  Button,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
} from '@material-ui/core';
import RefreshIcon from '@material-ui/icons/Refresh';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import ExpandLessIcon from '@material-ui/icons/ExpandLess';
import { makeStyles, Theme } from '@material-ui/core/styles';

const useTracesPageStyles = makeStyles((theme: Theme) => ({
  searchContainer: {
    marginBottom: theme.spacing(3),
    display: 'flex',
    gap: theme.spacing(2),
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  searchBar: {
    flex: '1 1 300px',
    minWidth: '250px',
  },
  filtersContainer: {
    display: 'flex',
    gap: theme.spacing(1),
    flexWrap: 'wrap',
  },
  tableContainer: {
    marginTop: theme.spacing(2),
  },
  table: {
    minWidth: 650,
  },
  expandIcon: {
    cursor: 'pointer',
  },
}));

interface Trace {
  trace_id: string;
  start_time: string;
  end_time: string;
  number_of_spans: number;
}

// Dummy data
const dummyTraces: Trace[] = [
  {
    trace_id: 'tx001',
    start_time: '2025-12-02T09:41:32.713Z',
    end_time: '2025-12-02T09:44:32.713Z',
    number_of_spans: 4,
  },
  {
    trace_id: 'tx002',
    start_time: '2025-12-02T09:41:32.713Z',
    end_time: '2025-12-02T09:44:32.713Z',
    number_of_spans: 5,
  },
  {
    trace_id: 'tx003',
    start_time: '2025-12-02T09:41:32.713Z',
    end_time: '2025-12-02T09:44:32.713Z',
    number_of_spans: 2,
  },
  {
    trace_id: 'tx004',
    start_time: '2025-12-02T09:41:32.713Z',
    end_time: '2025-12-02T09:44:32.713Z',
    number_of_spans: 4,
  },
];

export const ObservabilityTracesPage = () => {
  const classes = useTracesPageStyles();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [traces] = useState<Trace[]>(dummyTraces);

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
  };

  const handleRefresh = () => {
    // TODO: Implement refresh logic
    console.log('Refresh clicked');
  };

  const handleComponentFilter = () => {
    // TODO: Implement component filter
    console.log('Component filter clicked');
  };

  const handleEnvironmentFilter = () => {
    // TODO: Implement environment filter
    console.log('Environment filter clicked');
  };

  const handleTimeRangeFilter = () => {
    // TODO: Implement time range filter
    console.log('Time range filter clicked');
  };

  const toggleRowExpansion = (traceId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(traceId)) {
      newExpanded.delete(traceId);
    } else {
      newExpanded.add(traceId);
    }
    setExpandedRows(newExpanded);
  };

  const filteredTraces = traces.filter(trace =>
    trace.trace_id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Content>
      <Box className={classes.searchContainer}>
        <TextField
          className={classes.searchBar}
          label="Search bar (trace_id)"
          variant="outlined"
          size="small"
          value={searchQuery}
          onChange={handleSearchChange}
          placeholder="Enter trace_id to search"
        />
        <Box className={classes.filtersContainer}>
          <Button
            variant="outlined"
            size="small"
            onClick={handleComponentFilter}
          >
            Component Filter
          </Button>
          <Button
            variant="outlined"
            size="small"
            onClick={handleEnvironmentFilter}
          >
            Environment Filter
          </Button>
          <Button
            variant="outlined"
            size="small"
            onClick={handleTimeRangeFilter}
          >
            Time Range Filter
          </Button>
          <Button
            variant="outlined"
            size="small"
            startIcon={<RefreshIcon />}
            onClick={handleRefresh}
          >
            Refresh
          </Button>
        </Box>
      </Box>

      <TableContainer component={Paper} className={classes.tableContainer}>
        <Table className={classes.table} aria-label="traces table">
          <TableHead>
            <TableRow>
              <TableCell>trace_id</TableCell>
              <TableCell>start_time</TableCell>
              <TableCell>end_time</TableCell>
              <TableCell>number of spans</TableCell>
              <TableCell>details</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredTraces.map((trace) => (
              <>
                <TableRow key={trace.trace_id}>
                  <TableCell component="th" scope="row">
                    {trace.trace_id}
                  </TableCell>
                  <TableCell>{trace.start_time}</TableCell>
                  <TableCell>{trace.end_time}</TableCell>
                  <TableCell>{trace.number_of_spans}</TableCell>
                  <TableCell>
                    <IconButton
                      size="small"
                      onClick={() => toggleRowExpansion(trace.trace_id)}
                      className={classes.expandIcon}
                    >
                      {expandedRows.has(trace.trace_id) ? (
                        <ExpandLessIcon />
                      ) : (
                        <ExpandMoreIcon />
                      )}
                    </IconButton>
                  </TableCell>
                </TableRow>
                {expandedRows.has(trace.trace_id) && (
                  <TableRow>
                    <TableCell colSpan={5} style={{ padding: 0 }}>
                      {/* Waterfall view will be implemented here later */}
                      <Box p={2} style={{ backgroundColor: '#f5f5f5' }}>
                        <Typography variant="body2" color="textSecondary">
                          Waterfall view for {trace.trace_id} (to be implemented)
                        </Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                )}
              </>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Content>
  );
};
