import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  IconButton,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Typography,
  Button,
} from '@material-ui/core';
import { makeStyles, Theme } from '@material-ui/core/styles';
import CloseIcon from '@material-ui/icons/Close';
import ArrowForwardIcon from '@material-ui/icons/ArrowForward';
import {
  SearchBar,
  SearchResult,
  useSearch,
} from '@backstage/plugin-search-react';
import { CatalogIcon } from '@backstage/core-components';
import { useApp } from '@backstage/core-plugin-api';
import { catalogPageEntries } from '../../utils/kindUtils';
import { SearchResultItem } from './SearchResultItem';

const useStyles = makeStyles((theme: Theme) => ({
  dialogTitle: {
    padding: theme.spacing(1, 1, 0, 1),
  },
  titleBar: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  searchBar: {
    flex: 1,
  },
  catalogPagesSection: {
    padding: theme.spacing(1, 0),
  },
  sectionLabel: {
    padding: theme.spacing(0, 2),
  },
  dialogContent: {
    padding: theme.spacing(0, 1),
    minHeight: 200,
  },
  dialogActions: {
    justifyContent: 'center',
    padding: theme.spacing(1),
  },
}));

interface CustomSearchModalProps {
  toggleModal: () => void;
}

export const CustomSearchModal = ({ toggleModal }: CustomSearchModalProps) => {
  const classes = useStyles();
  const navigate = useNavigate();
  const app = useApp();
  const { term } = useSearch();

  const searchBarRef = (node: HTMLInputElement | null) => {
    if (node) {
      setTimeout(() => node.focus(), 0);
    }
  };

  const matchingPages = useMemo(() => {
    if (!term || term.trim().length === 0) return [];
    const lowerTerm = term.toLowerCase();
    return catalogPageEntries.filter(entry =>
      entry.displayName.toLowerCase().includes(lowerTerm),
    );
  }, [term]);

  const handleNavigateToCatalog = (path: string) => {
    toggleModal();
    navigate(path);
  };

  const handleViewAllResults = () => {
    toggleModal();
    const trimmedTerm = term?.trim();
    const searchPath = trimmedTerm
      ? `/search?query=${encodeURIComponent(trimmedTerm)}`
      : '/search';
    navigate(searchPath);
  };

  return (
    <>
      <DialogTitle disableTypography className={classes.dialogTitle}>
        <Box className={classes.titleBar}>
          <Box className={classes.searchBar}>
            <SearchBar ref={searchBarRef} onSubmit={handleViewAllResults} />
          </Box>
          <IconButton size="small" onClick={toggleModal}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent className={classes.dialogContent}>
        {matchingPages.length > 0 && (
          <Box className={classes.catalogPagesSection}>
            <Typography
              variant="overline"
              color="textSecondary"
              className={classes.sectionLabel}
            >
              Catalog Pages
            </Typography>
            <List dense>
              {matchingPages.map(entry => {
                const KindIcon = app.getSystemIcon(`kind:${entry.kind}`);
                return (
                  <ListItem
                    key={entry.kind}
                    button
                    onClick={() => handleNavigateToCatalog(entry.path)}
                  >
                    <ListItemIcon>
                      {KindIcon ? <KindIcon /> : <CatalogIcon />}
                    </ListItemIcon>
                    <ListItemText
                      primary={entry.displayName}
                      secondary={`Go to ${entry.displayName} catalog page`}
                    />
                  </ListItem>
                );
              })}
            </List>
            <Divider />
          </Box>
        )}
        <SearchResult>
          {resultSet => (
            <List>
              {resultSet.results.map(({ document, rank }) => (
                <SearchResultItem
                  key={document.location}
                  result={document}
                  rank={rank}
                />
              ))}
            </List>
          )}
        </SearchResult>
      </DialogContent>
      <DialogActions className={classes.dialogActions}>
        <Button
          size="small"
          color="primary"
          endIcon={<ArrowForwardIcon />}
          onClick={handleViewAllResults}
        >
          View all results
        </Button>
      </DialogActions>
    </>
  );
};
