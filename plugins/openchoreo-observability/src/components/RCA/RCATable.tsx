import { Link as RouterLink } from 'react-router-dom';
import { Table, TableColumn } from '@backstage/core-components';
import {
  Box,
  Typography,
  IconButton,
  Tooltip,
  makeStyles,
} from '@material-ui/core';
import DescriptionOutlinedIcon from '@material-ui/icons/DescriptionOutlined';
import RefreshIcon from '@material-ui/icons/Refresh';
import { StatusBadge, StatusType } from '@openchoreo/backstage-design-system';
import { RCAReportSummary } from '../../types';

const useStyles = makeStyles({
  truncateSingleLine: {
    display: 'block',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: '100%',
  },
  truncateTwoLines: {
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '100%',
  },
});

interface RCATableProps {
  reports: RCAReportSummary[];
  loading?: boolean;
}

export const RCATable = ({ reports, loading = false }: RCATableProps) => {
  const classes = useStyles();
  const mapStatusToStatusType = (
    status?: 'pending' | 'completed' | 'failed',
  ): StatusType => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'failed':
        return 'failed';
      case 'pending':
        return 'pending';
      default:
        return 'unknown';
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
      title: 'Timestamp',
      field: 'timestamp',
      width: '13%',
      render: (row: any) => {
        const report = row as RCAReportSummary;
        return (
          <Typography variant="body2" className={classes.truncateSingleLine}>
            {formatTimestamp(report.timestamp)}
          </Typography>
        );
      },
    },
    {
      title: 'Report ID',
      field: 'reportId',
      width: '10%',
      render: (row: any) => {
        const report = row as RCAReportSummary;
        const reportId = report.reportId || 'N/A';
        const truncatedId =
          reportId.length > 30 ? `${reportId.substring(0, 30)}...` : reportId;
        return (
          <Typography variant="body2" className={classes.truncateSingleLine}>
            {truncatedId}
          </Typography>
        );
      },
    },
    {
      title: 'Summary',
      field: 'summary',
      width: '60%',
      highlight: true,
      render: (row: any) => {
        const report = row as RCAReportSummary;
        return (
          <Typography variant="body2" className={classes.truncateTwoLines}>
            {report.summary || 'No summary available'}
          </Typography>
        );
      },
    },
    {
      title: 'Status',
      field: 'status',
      width: '10%',
      render: (row: any) => {
        const report = row as RCAReportSummary;
        return <StatusBadge status={mapStatusToStatusType(report.status)} />;
      },
    },
    {
      title: 'Actions',
      field: 'actions',
      width: '7%',
      render: (row: any) => {
        const report = row as RCAReportSummary;
        const isCompleted = report.status === 'completed';
        const isFailed = report.status === 'failed';
        return (
          <Box display="flex" alignItems="center" justifyContent="center">
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
