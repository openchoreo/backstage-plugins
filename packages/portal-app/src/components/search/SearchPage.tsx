import { useEffect } from 'react';
import { makeStyles, Theme, Grid, Box, List } from '@material-ui/core';

import {
  SearchBar,
  SearchResult,
  SearchPagination,
  useSearch,
} from '@backstage/plugin-search-react';
import { Content, Header, Page } from '@backstage/core-components';
import { SearchResultItem } from './SearchResultItem';
import { SearchKindDropdown } from './SearchKindDropdown';

const useStyles = makeStyles((theme: Theme) => ({
  container: {
    width: '100%',
    maxWidth: 1200,
    marginLeft: 'auto',
    marginRight: 'auto',
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing(1, 0),
  },
}));

const SearchPage = () => {
  const classes = useStyles();
  const { setTypes } = useSearch();

  // Lock to software-catalog type since we only have catalog search
  useEffect(() => {
    setTypes(['software-catalog']);
  }, [setTypes]);

  return (
    <Page themeId="home">
      <Header title="Search" />
      <Content>
        <Grid
          container
          direction="column"
          spacing={2}
          className={classes.container}
        >
          <Grid item xs={12}>
            <SearchBar />
          </Grid>
          <Grid item xs={12}>
            <Box className={classes.toolbar}>
              <SearchKindDropdown />
              <SearchPagination />
            </Box>
          </Grid>
          <Grid item xs={12}>
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
          </Grid>
        </Grid>
      </Content>
    </Page>
  );
};

export const searchPage = <SearchPage />;
