import { useState, ComponentType } from 'react';
import useAsync from 'react-use/esm/useAsync';
import { useApi, useApp, IconComponent } from '@backstage/core-plugin-api';
import { InfoCard, Link } from '@backstage/core-components';
import { visitsApiRef, Visit } from '@backstage/plugin-home';
import { parseEntityRef } from '@backstage/catalog-model';
import { EntityRefLink } from '@backstage/plugin-catalog-react';
import {
  getNodeColor,
  getDefaultNodeColor,
  KIND_FULL_LABELS,
} from '@openchoreo/backstage-plugin-react';
import { useChoreoTokens } from '@openchoreo/backstage-design-system';
import {
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Chip,
  Typography,
  Button,
  Collapse,
  Box,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import type { ThemeTokens } from '@openchoreo/backstage-design-system';
import Skeleton from '@material-ui/lab/Skeleton';
import HomeIcon from '@material-ui/icons/Home';
import CategoryIcon from '@material-ui/icons/Category';
import SearchIcon from '@material-ui/icons/Search';
import BubbleChartIcon from '@material-ui/icons/BubbleChart';
import ExtensionIcon from '@material-ui/icons/Extension';
import AddCircleOutlineIcon from '@material-ui/icons/AddCircleOutline';
import SettingsIcon from '@material-ui/icons/Settings';

const NUM_VISITS_OPEN = 3;
const NUM_VISITS_TOTAL = 8;

type PageOverride = {
  label: string;
  chipLabel: string;
  Icon: ComponentType<{ fontSize?: 'inherit' | 'small' }>;
};

const PAGE_OVERRIDES: Record<string, PageOverride> = {
  '/': { label: 'Home', chipLabel: 'home', Icon: HomeIcon },
  '/catalog': { label: 'Catalog', chipLabel: 'catalog', Icon: CategoryIcon },
  '/search': { label: 'Search', chipLabel: 'search', Icon: SearchIcon },
  '/platform-overview': {
    label: 'Platform Overview',
    chipLabel: 'platform',
    Icon: BubbleChartIcon,
  },
  '/api-docs': { label: 'APIs', chipLabel: 'apis', Icon: ExtensionIcon },
  '/create': {
    label: 'Create',
    chipLabel: 'create',
    Icon: AddCircleOutlineIcon,
  },
  '/settings': {
    label: 'Settings',
    chipLabel: 'settings',
    Icon: SettingsIcon,
  },
};

const useStyles = makeStyles(theme => ({
  chip: {
    color: theme.palette.common.white,
    fontWeight: 'bold',
    margin: 0,
    minWidth: 90,
    justifyContent: 'center',
  },
  listItem: {
    paddingTop: theme.spacing(0.75),
    paddingBottom: theme.spacing(0.75),
  },
  avatar: {
    minWidth: 0,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    marginLeft: '0.8rem',
    minWidth: 0,
  },
  kindIcon: {
    display: 'inline-flex',
    color: theme.palette.text.secondary,
    marginRight: theme.spacing(0.5),
    flexShrink: 0,
    '& > svg': {
      fontSize: 18,
    },
  },
  name: {
    fontSize: theme.typography.body1.fontSize,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  timestamp: {
    marginLeft: 'auto',
    paddingLeft: theme.spacing(1),
    flexShrink: 0,
  },
  skeleton: {
    borderRadius: 30,
  },
}));

function getChipLabel(kind: string | undefined): string {
  if (!kind) return 'other';
  return (KIND_FULL_LABELS[kind.toLowerCase()] ?? kind).toLowerCase();
}

function getRelativeTime(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'just now';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;

  const days = Math.floor(hours / 24);
  return `${days} day${days !== 1 ? 's' : ''} ago`;
}

function resolveVisit(
  visit: Visit,
  tokens: ThemeTokens,
  getSystemIcon: (key: string) => IconComponent | undefined,
) {
  const pageChipColor = tokens.entityKindDefault.accent;

  // 1. Entity visit
  if (visit.entityRef) {
    try {
      const { kind } = parseEntityRef(visit.entityRef);
      const KindIcon = getSystemIcon(`kind:${kind.toLowerCase()}`);
      return {
        chipLabel: getChipLabel(kind),
        chipColor: getNodeColor(kind, tokens),
        Icon: KindIcon,
        name: null, // use EntityRefLink
      };
    } catch {
      // fall through
    }
  }

  // 2. Known page
  const override = PAGE_OVERRIDES[visit.pathname];
  if (override) {
    return {
      chipLabel: override.chipLabel,
      chipColor: pageChipColor,
      Icon: override.Icon as IconComponent | undefined,
      name: override.label,
    };
  }

  // 3. Unknown non-entity visit
  return {
    chipLabel: 'other',
    chipColor: getDefaultNodeColor(tokens),
    Icon: undefined,
    name: visit.name,
  };
}

const VisitItem = ({ visit }: { visit: Visit }) => {
  const classes = useStyles();
  const app = useApp();
  const tokens = useChoreoTokens();
  const { chipLabel, chipColor, Icon, name } = resolveVisit(
    visit,
    tokens,
    key => app.getSystemIcon(key),
  );

  return (
    <ListItem disableGutters className={classes.listItem}>
      <ListItemAvatar className={classes.avatar}>
        <Chip
          size="small"
          className={classes.chip}
          label={chipLabel}
          style={{ background: chipColor }}
        />
      </ListItemAvatar>
      <Box className={classes.row}>
        {Icon && (
          <Box component="span" className={classes.kindIcon}>
            <Icon fontSize="small" />
          </Box>
        )}
        {visit.entityRef && !name ? (
          <EntityRefLink
            entityRef={visit.entityRef}
            className={classes.name}
            hideIcon
            disableTooltip
          />
        ) : (
          <Typography
            component={Link}
            to={visit.pathname}
            noWrap
            className={classes.name}
          >
            {name}
          </Typography>
        )}
        <Typography
          component="time"
          variant="caption"
          color="textSecondary"
          className={classes.timestamp}
        >
          {getRelativeTime(visit.timestamp)}
        </Typography>
      </Box>
    </ListItem>
  );
};

const VisitItemSkeleton = () => {
  const classes = useStyles();
  return (
    <ListItem disableGutters className={classes.listItem}>
      <ListItemAvatar>
        <Skeleton
          className={classes.skeleton}
          variant="rect"
          width={50}
          height={24}
        />
      </ListItemAvatar>
      <ListItemText
        primary={<Skeleton variant="text" width="100%" height={28} />}
        disableTypography
      />
    </ListItem>
  );
};

export const RecentlyVisitedCard = () => {
  const visitsApi = useApi(visitsApiRef);
  const [collapsed, setCollapsed] = useState(true);

  const { value: visits = [], loading } = useAsync(
    () =>
      visitsApi.list({
        limit: NUM_VISITS_TOTAL,
        orderBy: [{ field: 'timestamp', direction: 'desc' }],
      }),
    [visitsApi],
  );

  const showToggle = !loading && visits.length > NUM_VISITS_OPEN;

  let body;
  if (loading) {
    body = (
      <>
        {Array.from({ length: NUM_VISITS_OPEN }, (_, i) => (
          <VisitItemSkeleton key={i} />
        ))}
      </>
    );
  } else if (visits.length === 0) {
    body = (
      <>
        <Typography variant="body2" color="textSecondary">
          No recently visited pages.
        </Typography>
        <Typography variant="body2" color="textSecondary">
          As you explore, your recently visited pages will show up here.
        </Typography>
      </>
    );
  } else {
    body = (
      <>
        {visits.slice(0, NUM_VISITS_OPEN).map((visit, i) => (
          <VisitItem visit={visit} key={i} />
        ))}
        {visits.length > NUM_VISITS_OPEN && (
          <Collapse in={!collapsed}>
            {visits.slice(NUM_VISITS_OPEN, NUM_VISITS_TOTAL).map((visit, i) => (
              <VisitItem visit={visit} key={i} />
            ))}
          </Collapse>
        )}
      </>
    );
  }

  return (
    <InfoCard
      title="Recently Visited"
      actions={
        showToggle ? (
          <Button variant="text" onClick={() => setCollapsed(prev => !prev)}>
            {collapsed ? 'View more' : 'View less'}
          </Button>
        ) : undefined
      }
    >
      <List dense disablePadding>
        {body}
      </List>
    </InfoCard>
  );
};
