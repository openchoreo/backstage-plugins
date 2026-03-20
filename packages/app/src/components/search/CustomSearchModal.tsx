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
import FolderOutlinedIcon from '@material-ui/icons/FolderOutlined';
import WidgetsOutlinedIcon from '@material-ui/icons/WidgetsOutlined';
import CloudOutlinedIcon from '@material-ui/icons/CloudOutlined';
import ExtensionOutlinedIcon from '@material-ui/icons/ExtensionOutlined';
import CategoryOutlinedIcon from '@material-ui/icons/CategoryOutlined';
import SettingsApplicationsOutlinedIcon from '@material-ui/icons/SettingsApplicationsOutlined';
import DescriptionOutlinedIcon from '@material-ui/icons/DescriptionOutlined';
import ApartmentOutlinedIcon from '@material-ui/icons/ApartmentOutlined';
import AccountTreeOutlinedIcon from '@material-ui/icons/AccountTreeOutlined';
import {
  SearchBar,
  SearchResult,
  useSearch,
} from '@backstage/plugin-search-react';
import { CatalogIcon } from '@backstage/core-components';
import { useApp } from '@backstage/core-plugin-api';
import type { CatalogEntityDocument } from '@backstage/plugin-catalog-common';
import { catalogPageEntries } from '../../utils/kindUtils';
import { SearchResultItem } from './SearchResultItem';

const TEMPLATE_TYPE_ICONS: Record<string, React.ReactElement> = {
  'System (Project)': <FolderOutlinedIcon />,
  Component: <WidgetsOutlinedIcon />,
  Environment: <CloudOutlinedIcon />,
  Trait: <ExtensionOutlinedIcon />,
  ClusterTrait: <ExtensionOutlinedIcon />,
  ComponentType: <CategoryOutlinedIcon />,
  ClusterComponentType: <CategoryOutlinedIcon />,
  ComponentWorkflow: <SettingsApplicationsOutlinedIcon />,
  Namespace: <ApartmentOutlinedIcon />,
  DeploymentPipeline: <AccountTreeOutlinedIcon />,
};
const DEFAULT_TEMPLATE_ICON = <DescriptionOutlinedIcon />;

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
    return catalogPageEntries
      .filter(entry => entry.displayName.toLowerCase().includes(lowerTerm))
      .slice(0, 2);
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
          {resultSet => {
            const templates = resultSet.results
              .filter(r => (r.document as any).kind === 'Template')
              .slice(0, 2);
            const others = resultSet.results.filter(
              r => (r.document as any).kind !== 'Template',
            );
            return (
              <>
                {templates.length > 0 && (
                  <Box className={classes.catalogPagesSection}>
                    <Typography
                      variant="overline"
                      color="textSecondary"
                      className={classes.sectionLabel}
                    >
                      Create
                    </Typography>
                    <List dense>
                      {templates.map(({ document }) => {
                        const doc = document as CatalogEntityDocument;
                        const name = document.location.split('/').pop() || '';
                        const templatePath = `/create/templates/${
                          doc.namespace || 'default'
                        }/${name}`;
                        const icon =
                          TEMPLATE_TYPE_ICONS[doc.type] ||
                          DEFAULT_TEMPLATE_ICON;
                        return (
                          <ListItem
                            key={document.location}
                            button
                            onClick={() =>
                              handleNavigateToCatalog(templatePath)
                            }
                          >
                            <ListItemIcon>{icon}</ListItemIcon>
                            <ListItemText
                              primary={document.title}
                              secondary={document.text}
                            />
                          </ListItem>
                        );
                      })}
                    </List>
                  </Box>
                )}
                {others.length > 0 && (
                  <List>
                    {others.map(({ document, rank }) => (
                      <SearchResultItem
                        key={document.location}
                        result={document}
                        rank={rank}
                      />
                    ))}
                  </List>
                )}
              </>
            );
          }}
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
