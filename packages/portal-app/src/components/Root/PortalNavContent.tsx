import { useEffect } from 'react';
import { makeStyles, Tooltip, IconButton } from '@material-ui/core';
import ExitToAppIcon from '@material-ui/icons/ExitToApp';
import MenuIcon from '@material-ui/icons/Menu';
import ChevronLeftIcon from '@material-ui/icons/ChevronLeft';
import ChevronRightIcon from '@material-ui/icons/ChevronRight';
import SearchIcon from '@material-ui/icons/Search';
import GroupIcon from '@material-ui/icons/People';
import { identityApiRef, useApi } from '@backstage/core-plugin-api';
import {
  Sidebar,
  sidebarConfig,
  SidebarDivider,
  SidebarGroup,
  SidebarItem,
  SidebarScrollWrapper,
  SidebarSpace,
  useSidebarOpenState,
  Link,
} from '@backstage/core-components';
import {
  Settings as SidebarSettings,
  UserSettingsSignInAvatar,
} from '@backstage/plugin-user-settings';
import {
  SidebarSearchModal,
  SearchModalProvider,
  useSearchModal,
} from '@backstage/plugin-search';
import { MyGroupsSidebarItem } from '@backstage/plugin-org';
import type {
  NavContentComponentProps,
  NavContentNavItem,
} from '@backstage/plugin-app-react';
import { queryClient } from '@openchoreo/backstage-plugin-react';
import LogoFull from './LogoFull';
import LogoIcon from './LogoIcon';
import { CustomSearchModal } from '../search/CustomSearchModal';

const isMac =
  typeof navigator !== 'undefined' &&
  /Mac|iPhone|iPad/.test(navigator.userAgent);
const searchShortcutLabel = `Search (${isMac ? '⌘K' : 'Ctrl+K'})`;

// Global CSS tweaks mounted once with the sidebar.
const useSearchModalStyles = makeStyles(theme => ({
  '@global': {
    // Search Modal: cap width lg (1280px) -> md (960px).
    '.MuiDialog-root[aria-label="Search Modal"] .MuiDialog-paperWidthLg': {
      maxWidth: 960,
    },
    // BUI card titles: shrink to match legacy MUI sizing.
    '.bui-CardHeader h3.bui-Text': {
      fontSize: '1rem',
    },
    // BUI table headers: soften from stark black.
    '.bui-TableHead, .bui-TableHeadContent': {
      color: theme.palette.text.secondary,
    },
  },
}));

const useSkipLinkStyles = makeStyles(theme => ({
  skipLink: {
    position: 'absolute',
    left: -9999,
    top: 'auto',
    width: 1,
    height: 1,
    overflow: 'hidden',
    zIndex: theme.zIndex.tooltip + 1,
    '&:focus': {
      left: theme.spacing(2),
      top: theme.spacing(2),
      width: 'auto',
      height: 'auto',
      padding: theme.spacing(1, 2),
      backgroundColor: theme.palette.background.paper,
      color: theme.palette.text.primary,
      border: `2px solid ${theme.palette.primary.main}`,
      borderRadius: 4,
      textDecoration: 'none',
    },
  },
}));

const useSidebarLogoStyles = makeStyles(theme => ({
  root: {
    width: sidebarConfig.drawerWidthClosed,
    height: 2.25 * sidebarConfig.logoHeight,
    display: 'flex',
    flexFlow: 'row nowrap',
    alignItems: 'center',
    position: 'relative',
  },
  link: {
    width: sidebarConfig.drawerWidthClosed,
    marginLeft: 24,
  },
  toggleButton: {
    display: 'none',
    position: 'absolute',
    right: -20,
    top: '50%',
    transform: 'translateY(-50%)',
    backgroundColor: theme.palette.background.paper,
    border: `1px solid ${theme.palette.divider}`,
    boxShadow: theme.shadows[2],
    zIndex: 1000,
    '&:hover': {
      backgroundColor: theme.palette.action.hover,
    },
  },
}));

const SidebarLogo = () => {
  const classes = useSidebarLogoStyles();
  const { isOpen, setOpen } = useSidebarOpenState();
  return (
    <div className={classes.root}>
      <Link to="/" underline="none" className={classes.link} aria-label="Home">
        {isOpen ? <LogoFull /> : <LogoIcon />}
      </Link>
      <IconButton
        className={classes.toggleButton}
        onClick={() => setOpen(!isOpen)}
        size="small"
        aria-label={isOpen ? 'Collapse sidebar' : 'Expand sidebar'}
      >
        {isOpen ? <ChevronLeftIcon /> : <ChevronRightIcon />}
      </IconButton>
    </div>
  );
};

const KeyboardShortcutSearchToggler = () => {
  const { setOpen } = useSearchModal();
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [setOpen]);
  return null;
};

const SignOutButton = () => {
  const identityApi = useApi(identityApiRef);
  const handleSignOut = async () => {
    await identityApi.signOut();
    // Clear per-user cached BFF responses before redirect.
    queryClient.clear();
    window.location.href = '/';
  };
  return (
    <SidebarItem icon={ExitToAppIcon} text="Sign Out" onClick={handleSignOut} />
  );
};

const NavItemLink = ({ item }: { item: NavContentNavItem }) => (
  <SidebarItem
    icon={() => item.icon}
    to={item.href}
    text={item.title}
    key={item.node.spec.id}
  />
);

// Curated sidebar: only these pages appear. Other auto-discovered pages
// remain routable but have no nav entry.
const HOME_ID = 'page:openchoreo-portal-app/home';
const CATALOG_ID = 'page:catalog';
const PLATFORM_ID = 'page:platform-engineer-core/platform-overview';
const COST_INSIGHTS_ID = 'page:openchoreo-observability/cost-insights';
const APIS_ID = 'page:api-docs';
const CREATE_ID = 'page:scaffolder';

export function PortalNavContent({ navItems }: NavContentComponentProps) {
  useSearchModalStyles();
  const skipLinkClasses = useSkipLinkStyles();
  const home = navItems.take(HOME_ID);
  const catalog = navItems.take(CATALOG_ID);
  const platform = navItems.take(PLATFORM_ID);
  const costInsights = navItems.take(COST_INSIGHTS_ID);
  const apis = navItems.take(APIS_ID);
  const create = navItems.take(CREATE_ID);

  return (
    <Sidebar>
      <a href="#main-content" className={skipLinkClasses.skipLink}>
        Skip to main content
      </a>
      <SidebarLogo />
      <Tooltip title={searchShortcutLabel} placement="right" arrow>
        <div>
          <SidebarGroup label="Search" icon={<SearchIcon />} to="/search">
            <SearchModalProvider>
              <KeyboardShortcutSearchToggler />
              <SidebarSearchModal>
                {({ toggleModal }) => (
                  <CustomSearchModal toggleModal={toggleModal} />
                )}
              </SidebarSearchModal>
            </SearchModalProvider>
          </SidebarGroup>
        </div>
      </Tooltip>
      <SidebarDivider />
      <SidebarGroup label="Menu" icon={<MenuIcon />}>
        {home && <NavItemLink item={home} />}
        {catalog && <NavItemLink item={catalog} />}
        {platform && <NavItemLink item={platform} />}
        {costInsights && <NavItemLink item={costInsights} />}
        <MyGroupsSidebarItem
          singularTitle="My Group"
          pluralTitle="My Groups"
          icon={GroupIcon}
        />
        {apis && <NavItemLink item={apis} />}
        {create && <NavItemLink item={create} />}
        <SidebarScrollWrapper />
      </SidebarGroup>
      <SidebarSpace />
      <SidebarDivider />
      <SidebarGroup
        label="Settings"
        icon={<UserSettingsSignInAvatar />}
        to="/settings"
      >
        <SidebarSettings />
      </SidebarGroup>
      <SidebarDivider />
      <SignOutButton />
    </Sidebar>
  );
}
