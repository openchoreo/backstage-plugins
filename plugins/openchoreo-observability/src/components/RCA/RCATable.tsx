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
import { FormattedText } from './RCAReport/FormattedText';

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
      title: 'Summary',
      field: 'summary',
      width: '66%',
      highlight: true,
      render: (row: any) => {
        const report = row as RCAReportSummary;
        if (report.status === 'pending') {
          return (
            <Typography variant="body2">Generating RCA report...</Typography>
          );
        }
        return (
          <Typography variant="body2" className={classes.truncateTwoLines}>
            {report.summary ? (
              <FormattedText
                text={report.summary}
                disableLinks
                disableMarkdown
              />
            ) : (
              'No summary available'
            )}
          </Typography>
        );
      },
    },
    {
      title: 'Report Status',
      field: 'status',
      width: '14%',
      render: (row: any) => {
        const report = row as RCAReportSummary;
        const status = mapStatusToStatusType(report.status);
        const labelMap: Record<string, string> = {
          success: 'Available',
          pending: 'Pending',
          failed: 'Failed',
        };
        return (
          <StatusBadge status={status} label={labelMap[status] || status} />
        );
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
                  to={`./${report.reportId}`}
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
