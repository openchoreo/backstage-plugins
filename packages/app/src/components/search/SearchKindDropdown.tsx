import { type ReactNode, useMemo, useState } from 'react';
import Box from '@material-ui/core/Box';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import ListSubheader from '@material-ui/core/ListSubheader';
import MenuItem from '@material-ui/core/MenuItem';
import Select from '@material-ui/core/Select';
import Typography from '@material-ui/core/Typography';
import { makeStyles, createStyles, Theme } from '@material-ui/core/styles';
import { useApp } from '@backstage/core-plugin-api';
import { CatalogIcon } from '@backstage/core-components';
import { useSearch } from '@backstage/plugin-search-react';
import { kindDisplayNames, kindCategories } from '../../utils/kindUtils';
import { useAllKinds } from '../../hooks/useAllKinds';

const ALL_KINDS = '__all__';

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    container: {
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1.5),
    },
    label: {
      fontWeight: 'bold',
      fontSize: theme.typography.body2.fontSize,
      fontFamily: theme.typography.fontFamily,
      color: theme.palette.text.primary,
      whiteSpace: 'nowrap',
    },
    select: {
      minWidth: 180,
    },
    renderValue: {
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      '& svg': {
        fontSize: '1.2rem',
        color: theme.palette.text.secondary,
      },
    },
    subheader: {
      color: theme.palette.text.secondary,
      fontSize: theme.typography.caption.fontSize,
      fontWeight: theme.typography.fontWeightBold as number,
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
      lineHeight: '32px',
      pointerEvents: 'none',
    },
    listItemIcon: {
      minWidth: 32,
      color: theme.palette.text.secondary,
      '& svg': {
        fontSize: '1.2rem',
      },
    },
  }),
);

export const SearchKindDropdown = () => {
  const classes = useStyles();
  const app = useApp();
  const { filters, setFilters } = useSearch();
  const { allKinds } = useAllKinds();
  const [selectedKind, setSelectedKind] = useState<string>(
    (filters.kind as string) || ALL_KINDS,
  );

  const availableKinds = useMemo(() => {
    const available = new Set<string>();
    allKinds.forEach((_value, key) => {
      available.add(key.toLowerCase());
    });
    return available;
  }, [allKinds]);

  const handleChange = (value: string) => {
    setSelectedKind(value);
    if (value === ALL_KINDS) {
      setFilters(prev => {
        const next = { ...prev };
        delete next.kind;
        return next;
      });
    } else {
      setFilters(prev => ({ ...prev, kind: value }));
    }
  };

  // Build grouped menu items matching ChoreoEntityKindPicker pattern
  const menuItems = useMemo(() => {
    const items: ReactNode[] = [];

    // "All" option
    items.push(
      <MenuItem key={ALL_KINDS} value={ALL_KINDS}>
        <ListItemIcon className={classes.listItemIcon}>
          <CatalogIcon />
        </ListItemIcon>
        All
      </MenuItem>,
    );

    // Namespace (domain) as standalone top-level item
    if (availableKinds.has('domain')) {
      const DomainIcon = app.getSystemIcon('kind:domain');
      items.push(
        <MenuItem key="domain" value="Domain">
          {DomainIcon && (
            <ListItemIcon className={classes.listItemIcon}>
              <DomainIcon />
            </ListItemIcon>
          )}
          {kindDisplayNames.domain}
        </MenuItem>,
      );
    }

    for (const category of kindCategories) {
      const visibleKinds = category.kinds.filter(k => availableKinds.has(k));
      if (visibleKinds.length === 0) continue;

      items.push(
        <ListSubheader
          key={`header-${category.label}`}
          className={classes.subheader}
          disableSticky
        >
          {category.label}
        </ListSubheader>,
      );

      for (const kind of visibleKinds) {
        const KindIcon = app.getSystemIcon(`kind:${kind}`);
        // The search filter expects PascalCase kind values matching the catalog collator
        const filterValue =
          allKinds.get(
            Array.from(allKinds.keys()).find(k => k.toLowerCase() === kind) ||
              '',
          ) || kind.charAt(0).toUpperCase() + kind.slice(1);
        const actualKey =
          Array.from(allKinds.keys()).find(k => k.toLowerCase() === kind) ||
          kind;

        items.push(
          <MenuItem key={kind} value={actualKey}>
            {KindIcon && (
              <ListItemIcon className={classes.listItemIcon}>
                <KindIcon />
              </ListItemIcon>
            )}
            {kindDisplayNames[kind] || filterValue}
          </MenuItem>,
        );
      }
    }

    return items;
  }, [availableKinds, allKinds, classes, app]);

  return (
    <Box className={classes.container}>
      <Typography className={classes.label}>Kind</Typography>
      <Select
        className={classes.select}
        value={selectedKind}
        onChange={e => handleChange(e.target.value as string)}
        variant="outlined"
        renderValue={value => {
          const val = value as string;
          if (val === ALL_KINDS) {
            return (
              <Box className={classes.renderValue}>
                <CatalogIcon />
                All
              </Box>
            );
          }
          const kind = val.toLowerCase();
          const KindIcon = app.getSystemIcon(`kind:${kind}`);
          return (
            <Box className={classes.renderValue}>
              {KindIcon ? <KindIcon /> : <CatalogIcon />}
              {kindDisplayNames[kind] || val}
            </Box>
          );
        }}
        MenuProps={{
          anchorOrigin: { vertical: 'bottom', horizontal: 'left' },
          transformOrigin: { vertical: 'top', horizontal: 'left' },
          getContentAnchorEl: null,
        }}
      >
        {menuItems}
      </Select>
    </Box>
  );
};
