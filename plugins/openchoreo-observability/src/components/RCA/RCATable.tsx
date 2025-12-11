import { FC } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Table, TableColumn } from '@backstage/core-components';
import {
  Box,
  Typography,
  Chip,
  IconButton,
  Tooltip,
  makeStyles,
} from '@material-ui/core';
import DescriptionOutlinedIcon from '@material-ui/icons/DescriptionOutlined';
import RefreshIcon from '@material-ui/icons/Refresh';
import { RCAReportSummary } from '../../types';

const useStyles = makeStyles(theme => ({
  statusChip: {
    fontWeight: 'bold',
  },
  statusCompleted: {
    borderColor: theme.palette.info.main,
    color: theme.palette.info.main,
  },
  statusFailed: {
    borderColor: theme.palette.error.main,
    color: theme.palette.error.main,
  },
  statusPending: {
    borderColor: theme.palette.action.disabled,
    color: theme.palette.text.secondary,
  },
}));

interface RCATableProps {
  reports: RCAReportSummary[];
  loading?: boolean;
}

export const RCATable: FC<RCATableProps> = ({ reports, loading = false }) => {
  const classes = useStyles();

  const getStatusClass = (
    status?: 'pending' | 'completed' | 'failed',
  ): string => {
    switch (status) {
      case 'completed':
        return classes.statusCompleted;
      case 'failed':
        return classes.statusFailed;
      case 'pending':
        return classes.statusPending;
      default:
        return classes.statusPending;
    }
  };

  const formatTimestamp = (timestamp?: string): string => {
    if (!timestamp) return 'N/A';
    try {
      return new Date(timestamp).toLocaleString();
    } catch {
      return timestamp;
    }
  };

  const columns: TableColumn[] = [
    {
      title: 'Report ID',
      field: 'reportId',
      width: '15%',
      render: (row: any) => {
        const report = row as RCAReportSummary;
        return report.reportId || 'N/A';
      },
    },
    {
      title: 'Timestamp',
      field: 'timestamp',
      width: '15%',
      render: (row: any) => {
        const report = row as RCAReportSummary;
        return formatTimestamp(report.timestamp);
      },
    },
    {
      title: 'Summary',
      field: 'summary',
      width: '45%',
      highlight: true,
      render: (row: any) => {
        const report = row as RCAReportSummary;
        return (
          <Typography variant="body2" noWrap>
            {report.summary || 'No summary available'}
          </Typography>
        );
      },
    },
    {
      title: 'Status',
      field: 'status',
      width: '12%',
      render: (row: any) => {
        const report = row as RCAReportSummary;
        return (
          <Chip
            label={report.status || 'unknown'}
            size="small"
            variant="outlined"
            className={`${classes.statusChip} ${getStatusClass(report.status)}`}
          />
        );
      },
    },
    {
      title: 'Actions',
      field: 'actions',
      width: '12%',
      render: (row: any) => {
        const report = row as RCAReportSummary;
        const isCompleted = report.status === 'completed';
        const isFailed = report.status === 'failed';
        return (
          <Box display="flex" alignItems="center">
            {isCompleted && (
              <Tooltip title="View report">
                <IconButton
                  size="small"
                  component={RouterLink}
                  to={`./${report.alertId}`}
                  aria-label="view report"
                >
                  <DescriptionOutlinedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            {isFailed && (
              <Tooltip title="Rerun report">
                <span>
                  <IconButton size="small" aria-label="rerun report" disabled>
                    <RefreshIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            )}
          </Box>
        );
      },
    },
  ];

  return (
    <Table
      options={{
        search: false,
        toolbar: false,
        paging: false,
        sorting: true,
        padding: 'default',
      }}
      columns={columns}
      data={reports}
      isLoading={loading}
      emptyContent={
        <Box textAlign="center" padding={4}>
          <Typography variant="h6" gutterBottom>
            No RCA reports found
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Try adjusting your filters or time range to see more reports.
          </Typography>
        </Box>
      }
    />
  );
};
