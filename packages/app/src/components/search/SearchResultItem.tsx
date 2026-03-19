import {
  Box,
  Chip,
  ListItem,
  ListItemIcon,
  ListItemText,
  Typography,
} from '@material-ui/core';
import { makeStyles, Theme } from '@material-ui/core/styles';
import { Link, CatalogIcon } from '@backstage/core-components';
import { useApp } from '@backstage/core-plugin-api';
import type { CatalogEntityDocument } from '@backstage/plugin-catalog-common';
import type { SearchDocument } from '@backstage/plugin-search-common';
import { getKindDisplayName } from '../../utils/kindUtils';

const useStyles = makeStyles((theme: Theme) => ({
  item: {
    padding: theme.spacing(1, 2),
    textDecoration: 'none',
    alignItems: 'center',
    '&:hover': {
      backgroundColor: theme.palette.action.hover,
      textDecoration: 'none',
    },
  },
  icon: {
    minWidth: 40,
    color: theme.palette.text.secondary,
  },
  title: {
    fontWeight: 500,
    color: theme.palette.primary.main,
  },
  chips: {
    display: 'flex',
    gap: theme.spacing(0.5),
    flexShrink: 0,
    marginLeft: 'auto',
  },
  chip: {
    height: 20,
    fontSize: '0.7rem',
  },
  description: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: '-webkit-box',
    '-webkit-line-clamp': 1,
    '-webkit-box-orient': 'vertical',
  },
}));

interface SearchResultItemProps {
  result?: SearchDocument;
  rank?: number;
}

export const SearchResultItem = ({ result }: SearchResultItemProps) => {
  const classes = useStyles();
  const app = useApp();

  if (!result) return null;

  const doc = result as CatalogEntityDocument;
  const kind = doc.kind?.toLowerCase();
  const KindIcon = kind ? app.getSystemIcon(`kind:${kind}`) : null;
  const kindLabel = doc.kind ? getKindDisplayName(doc.kind) : undefined;

  return (
    <ListItem
      className={classes.item}
      button
      component={Link}
      to={result.location}
      noTrack
      divider
    >
      <ListItemIcon className={classes.icon}>
        {KindIcon ? <KindIcon /> : <CatalogIcon />}
      </ListItemIcon>
      <ListItemText
        disableTypography
        primary={
          <Typography variant="body1" className={classes.title}>
            {result.title}
          </Typography>
        }
        secondary={
          result.text && (
            <Typography
              variant="body2"
              color="textSecondary"
              className={classes.description}
            >
              {result.text}
            </Typography>
          )
        }
      />
      <Box className={classes.chips}>
        {kindLabel && (
          <Chip
            label={kindLabel}
            size="small"
            variant="outlined"
            className={classes.chip}
          />
        )}
        {doc.type && (
          <Chip
            label={doc.type}
            size="small"
            variant="outlined"
            className={classes.chip}
          />
        )}
      </Box>
    </ListItem>
  );
};
