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
import {
  StatusBadge,
  StatusType,
  Skeleton,
} from '@openchoreo/backstage-design-system';
import { FinOpsReportSummary } from '../../types';
import { FormattedText } from '../RCA/RCAReport/FormattedText';

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

interface CostAnalysisTableProps {
  reports: FinOpsReportSummary[];
  loading?: boolean;
}

export const CostAnalysisTable = ({
  reports,
  loading = false,
}: CostAnalysisTableProps) => {
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
    const d = new Date(timestamp);
    return isNaN(d.getTime()) ? timestamp : d.toLocaleString();
  };

  const columns: TableColumn[] = [
    {
      title: 'Timestamp',
      field: 'timestamp',
      width: '13%',
      render: (row: any) => {
        const report = row as FinOpsReportSummary;
        return (
          <Typography variant="body2" className={classes.truncateSingleLine}>
            {formatTimestamp(report.timestamp)}
          </Typography>
        );
      },
    },
    {
      title: 'Component',
      field: 'component',
      width: '13%',
      render: (row: any) => {
        const report = row as FinOpsReportSummary;
        return (
          <Typography variant="body2" className={classes.truncateSingleLine}>
            {report.component || 'N/A'}
          </Typography>
        );
      },
    },
    {
      title: 'Summary',
      field: 'summary',
      width: '53%',
      highlight: true,
      render: (row: any) => {
        const report = row as FinOpsReportSummary;
        if (report.status === 'pending') {
          return (
            <Typography variant="body2">
              Generating cost analysis report...
            </Typography>
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
        const report = row as FinOpsReportSummary;
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
        const report = row as FinOpsReportSummary;
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

  // While loading, render skeleton rows on the table's own background instead
  // of the material-table CircularProgress overlay (which sits on the grey
  // page background). Cloned columns keep the header row + widths stable.
  const skeletonColumns: TableColumn[] = columns.map(column => ({
    ...column,
    sorting: false,
    highlight: false,
    render: () => <Skeleton variant="text" height={20} />,
  }));
  const skeletonData = Array.from({ length: 5 }, (_, index) => ({
    id: `skeleton-${index}`,
  }));

  return (
    <Table
      options={{
        search: false,
        toolbar: false,
        paging: false,
        sorting: true,
        padding: 'default',
      }}
      columns={loading ? skeletonColumns : columns}
      data={loading ? skeletonData : reports}
      isLoading={false}
      emptyContent={
        <Box textAlign="center" padding={4}>
          <Typography variant="h6" gutterBottom>
            No cost analysis reports found
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Try adjusting your filters or time range to see more reports.
          </Typography>
        </Box>
      }
    />
  );
};
