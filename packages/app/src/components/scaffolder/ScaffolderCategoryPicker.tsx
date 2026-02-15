import {
  Select,
  MenuItem,
  Checkbox,
  ListItemText,
  FormControl,
  Chip,
  Box,
  Typography,
} from '@material-ui/core';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import { useEntityTypeFilter } from '@backstage/plugin-catalog-react';
import { useFilterPickerStyles } from './filterPickerStyles';

const MAX_VISIBLE_CHIPS = 1;

export const ScaffolderCategoryPicker = () => {
  const classes = useFilterPickerStyles();
  const { loading, availableTypes, selectedTypes, setSelectedTypes } =
    useEntityTypeFilter();

  if (loading || !availableTypes?.length) {
    return null;
  }

  const handleDelete = (valueToDelete: string) => {
    setSelectedTypes(selectedTypes.filter(v => v !== valueToDelete));
  };

  const overflowCount = selectedTypes.length - MAX_VISIBLE_CHIPS;

  return (
    <Box className={classes.root}>
      <Typography variant="body2" component="label" className={classes.label}>
        Categories
      </Typography>
      <FormControl
        variant="outlined"
        size="small"
        className={classes.formControl}
      >
        <Select
          id="category-picker"
          multiple
          displayEmpty
          value={selectedTypes}
          onChange={e => setSelectedTypes(e.target.value as string[])}
          className={classes.select}
          IconComponent={ExpandMoreIcon}
          renderValue={selected => {
            const values = selected as string[];
            if (values.length === 0) {
              return <span className={classes.placeholder}>All</span>;
            }
            return (
              <Box className={classes.chips}>
                {values.slice(0, MAX_VISIBLE_CHIPS).map(value => (
                  <Chip
                    key={value}
                    label={value}
                    size="small"
                    className={classes.chip}
                    onDelete={() => handleDelete(value)}
                    onMouseDown={e => e.stopPropagation()}
                  />
                ))}
                {overflowCount > 0 && (
                  <Chip
                    label={`+${overflowCount}`}
                    size="small"
                    className={classes.overflowChip}
                    onMouseDown={e => e.stopPropagation()}
                  />
                )}
              </Box>
            );
          }}
          MenuProps={{
            anchorOrigin: { vertical: 'bottom', horizontal: 'left' },
            transformOrigin: { vertical: 'top', horizontal: 'left' },
            getContentAnchorEl: null,
            PaperProps: {
              style: { maxHeight: 300 },
            },
          }}
        >
          {availableTypes.map(type => (
            <MenuItem key={type} value={type} className={classes.menuItem}>
              <Checkbox
                checked={selectedTypes.includes(type)}
                size="small"
                color="primary"
              />
              <ListItemText
                primary={type}
                primaryTypographyProps={{ style: { fontSize: 14 } }}
              />
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Box>
  );
};
