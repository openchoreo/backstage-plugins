import { Box, Typography, IconButton } from '@material-ui/core';
import AddIcon from '@material-ui/icons/Add';
import RemoveIcon from '@material-ui/icons/DeleteOutlined';
import ArrowUpwardIcon from '@material-ui/icons/KeyboardArrowUp';
import ArrowDownwardIcon from '@material-ui/icons/KeyboardArrowDown';
import type {
  ArrayFieldTemplateProps,
  ArrayFieldTemplateItemType,
} from '@rjsf/utils';
import { useArrayStyles } from './styles';
import { humanizeTitle } from './utils';

function ArrayItem({
  item,
  classes,
}: {
  item: ArrayFieldTemplateItemType;
  classes: ReturnType<typeof useArrayStyles>;
}) {
  return (
    <Box className={classes.item}>
      <Box className={classes.itemContent}>{item.children}</Box>
      {item.hasToolbar && (
        <Box className={classes.itemActions}>
          {item.hasMoveUp && (
            <IconButton
              className={classes.actionButton}
              size="small"
              onClick={item.onReorderClick(item.index, item.index - 1)}
              disabled={item.disabled || item.readonly}
              aria-label="Move up"
            >
              <ArrowUpwardIcon fontSize="small" />
            </IconButton>
          )}
          {item.hasMoveDown && (
            <IconButton
              className={classes.actionButton}
              size="small"
              onClick={item.onReorderClick(item.index, item.index + 1)}
              disabled={item.disabled || item.readonly}
              aria-label="Move down"
            >
              <ArrowDownwardIcon fontSize="small" />
            </IconButton>
          )}
          {item.hasRemove && (
            <IconButton
              className={classes.actionButton}
              size="small"
              onClick={item.onDropIndexClick(item.index)}
              disabled={item.disabled || item.readonly}
              aria-label="Remove"
            >
              <RemoveIcon fontSize="small" />
            </IconButton>
          )}
        </Box>
      )}
    </Box>
  );
}

export function ArrayFieldTemplate(props: ArrayFieldTemplateProps) {
  const classes = useArrayStyles();

  return (
    <Box className={classes.container}>
      {props.title && (
        <Box className={classes.header}>
          <Typography variant="h5" className={classes.title}>
            {humanizeTitle(props.title)}
          </Typography>
        </Box>
      )}
      {props.schema.description && (
        <Typography variant="body2" className={classes.description}>
          {props.schema.description}
        </Typography>
      )}
      {props.items.map(item => (
        <ArrayItem key={item.key} item={item} classes={classes} />
      ))}
      {props.canAdd && (
        <button
          type="button"
          className={classes.addButton}
          onClick={props.onAddClick}
          disabled={props.disabled || props.readonly}
        >
          <AddIcon fontSize="small" />
          Add item
        </button>
      )}
    </Box>
  );
}

ArrayFieldTemplate.displayName = 'ArrayFieldTemplate';
