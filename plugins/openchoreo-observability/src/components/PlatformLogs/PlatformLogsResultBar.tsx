import { ChangeEvent, FC } from 'react';
import {
  Box,
  Button,
  Checkbox,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Tooltip,
  Typography,
} from '@material-ui/core';
import ArrowDownward from '@material-ui/icons/ArrowDownward';
import ArrowUpward from '@material-ui/icons/ArrowUpward';
import { usePlatformLogsResultStyles } from './styles';
import { PlatformLogField, PlatformLogsFilters } from './types';

interface PlatformLogsResultBarProps {
  totalCount: number;
  filters: PlatformLogsFilters;
  onFiltersChange: (filters: Partial<PlatformLogsFilters>) => void;
  disabled?: boolean;
}

/**
 * Sits between the filters and the table: how many entries matched, and the two
 * controls that change how they are displayed rather than which ones are fetched.
 *
 * Columns lives here, not in the filter row. It is a display preference - Backstage's
 * own Table puts its column selector in the table toolbar for the same reason - and
 * mixing it in with the filters was what made ten controls read as one undifferentiated
 * grid.
 */
export const PlatformLogsResultBar: FC<PlatformLogsResultBarProps> = ({
  totalCount,
  filters,
  onFiltersChange,
  disabled = false,
}) => {
  const classes = usePlatformLogsResultStyles();
  const sortOrder = filters.sortOrder ?? 'asc';

  const handleFieldsChange = (event: ChangeEvent<{ value: unknown }>) => {
    let selectedFields = event.target.value as PlatformLogField[];
    // The message is the reason the table exists; it cannot be deselected away.
    if (!selectedFields.includes(PlatformLogField.Log)) {
      selectedFields = [...selectedFields, PlatformLogField.Log];
    }
    onFiltersChange({
      selectedFields: Object.values(PlatformLogField).filter(field =>
        selectedFields.includes(field),
      ),
    });
  };

  return (
    <Box className={classes.root}>
      <Typography
        variant="body2"
        color="textSecondary"
        className={classes.count}
      >
        {totalCount.toLocaleString()} {totalCount === 1 ? 'entry' : 'entries'}
      </Typography>

      <Box className={classes.actions}>
        <Tooltip
          title={
            sortOrder === 'desc'
              ? 'Showing newest first'
              : 'Showing oldest first'
          }
        >
          <Button
            size="small"
            variant="outlined"
            disabled={disabled}
            onClick={() =>
              onFiltersChange({
                sortOrder: sortOrder === 'desc' ? 'asc' : 'desc',
              })
            }
            startIcon={
              sortOrder === 'desc' ? (
                <ArrowDownward fontSize="small" />
              ) : (
                <ArrowUpward fontSize="small" />
              )
            }
          >
            {sortOrder === 'desc' ? 'Newest First' : 'Oldest First'}
          </Button>
        </Tooltip>

        <FormControl
          size="small"
          variant="outlined"
          className={classes.columns}
          disabled={disabled}
        >
          <InputLabel id="platform-logs-columns">Columns</InputLabel>
          <Select
            multiple
            labelId="platform-logs-columns"
            label="Columns"
            value={filters.selectedFields}
            onChange={handleFieldsChange}
            renderValue={selected =>
              `${(selected as PlatformLogField[]).length} shown`
            }
          >
            {Object.values(PlatformLogField).map(field => (
              <MenuItem
                key={field}
                value={field}
                disabled={field === PlatformLogField.Log}
              >
                <Checkbox
                  checked={filters.selectedFields.includes(field)}
                  disabled={field === PlatformLogField.Log}
                />
                {field}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>
    </Box>
  );
};
