import { PropsWithChildren, useEffect } from 'react';
import { makeStyles, Tooltip } from '@material-ui/core';
import HomeIcon from '@material-ui/icons/Home';
import ExtensionIcon from '@material-ui/icons/Extension';
import CreateComponentIcon from '@material-ui/icons/AddCircleOutline';
import ExitToAppIcon from '@material-ui/icons/ExitToApp';
import LogoFull from './LogoFull';
import LogoIcon from './LogoIcon';
import {
  Settings as SidebarSettings,
  UserSettingsSignInAvatar,
} from '@backstage/plugin-user-settings';
import {
  SidebarSearchModal,
  SearchModalProvider,
  useSearchModal,
} from '@backstage/plugin-search';
import { CustomSearchModal } from '../search/CustomSearchModal';
import {
  Sidebar,
  sidebarConfig,
  SidebarDivider,
  SidebarGroup,
  SidebarItem,
  SidebarPage,
  SidebarScrollWrapper,
  SidebarSpace,
  useSidebarOpenState,
  Link,
} from '@backstage/core-components';
import MenuIcon from '@material-ui/icons/Menu';
import { IconButton } from '@material-ui/core';
import ChevronLeftIcon from '@material-ui/icons/ChevronLeft';
import ChevronRightIcon from '@material-ui/icons/ChevronRight';
import SearchIcon from '@material-ui/icons/Search';
import { MyGroupsSidebarItem } from '@backstage/plugin-org';
import GroupIcon from '@material-ui/icons/People';
import { identityApiRef, useApi } from '@backstage/core-plugin-api';
import CategoryIcon from '@material-ui/icons/Category';
import BubbleChartIcon from '@material-ui/icons/BubbleChart';
import { AssistantDrawerProvider } from '@openchoreo/backstage-plugin-openchoreo-portal-assistant';
// This app composes some OpenChoreo entity tabs itself via legacy
// `EntityLayout.Route` JSX (see EntityPage.tsx), so they render OUTSIDE the
// plugins' `PluginWrapperBlueprint` scope. Mount `OpenChoreoQueryProvider` here
// (QueryClientProvider + the user-scoping context) so those host-composed tabs
// still get a QueryClient and per-user cache-key namespacing. It shares the same
// `queryClient` singleton the plugin wrappers use, so there is one cache; the
// SignOutButton clears that exact client on sign-out.
import {
  OpenChoreoQueryProvider,
  queryClient,
} from '@openchoreo/backstage-plugin-react';
import { ScaffolderPreselectionProvider } from '../../scaffolder/ScaffolderPreselectionContext';
import { DependencyGraphZoomOverrides } from '../graph/DependencyGraphZoomOverrides';

const isMac =
  typeof navigator !== 'undefined' &&
  /Mac|iPhone|iPad/.test(navigator.userAgent);
const searchShortcutLabel = `Search (${isMac ? '⌘K' : 'Ctrl+K'})`;

const useSearchModalStyles = makeStyles({
  '@global': {
    // Override the search modal Dialog max-width from lg to md
    '.MuiDialog-root[aria-label="Search Modal"] .MuiDialog-paperWidthLg': {
      maxWidth: 960,
    },
  },
});

const useA11yStyles = makeStyles(theme => ({
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
  mainContent: {
    display: 'contents',
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

  const handleToggle = () => {
    setOpen(!isOpen);
  };

  return (
    <div className={classes.root}>
      <Link to="/" underline="none" className={classes.link} aria-label="Home">
        {isOpen ? <LogoFull /> : <LogoIcon />}
      </Link>
      <IconButton
        className={classes.toggleButton}
        onClick={handleToggle}
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
    // Drop every cached BFF response so the next user can't see the previous
    // user's permission-scoped data. The reload below already clears in-memory
    // cache, but clearing explicitly keeps this correct if the reload is ever
    // removed and is the seam a future persisted cache would hook into.
    queryClient.clear();
    // Reload to clear session and redirect to sign-in page
    window.location.href = '/';
  };

  return (
    <SidebarItem icon={ExitToAppIcon} text="Sign Out" onClick={handleSignOut} />
  );
};

export const Root = ({ children }: PropsWithChildren<{}>) => {
  useSearchModalStyles();
  const a11yClasses = useA11yStyles();
  return (
    <OpenChoreoQueryProvider>
      <ScaffolderPreselectionProvider>
        <AssistantDrawerProvider>
          {/*
          Mounted inside <Root> (which lives under <AppRouter> per
          convertLegacyAppRoot's children-recognition rules) so the
          component's MutationObserver runs in the routed subtree. The
          previous placement as an <AppRouter> sibling was silently
          dropped by convertLegacyAppRoot during the NFS migration.
        */}
          <DependencyGraphZoomOverrides />
          <a href="#main-content" className={a11yClasses.skipLink}>
            Skip to main content
          </a>
          <SidebarPage>
            <Sidebar>
              <SidebarLogo />
              <Tooltip title={searchShortcutLabel} placement="right" arrow>
                <div>
                  <SidebarGroup
                    label="Search"
                    icon={<SearchIcon />}
                    to="/search"
                  >
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
                {/* Global nav, not org-specific */}
                <SidebarItem icon={HomeIcon} to="/" text="Home" />
                <SidebarItem icon={CategoryIcon} to="catalog" text="Catalog" />
                <SidebarItem
                  icon={BubbleChartIcon}
                  to="platform-overview"
                  text="Platform"
                />
                <MyGroupsSidebarItem
                  singularTitle="My Group"
                  pluralTitle="My Groups"
                  icon={GroupIcon}
                />
                <SidebarItem icon={ExtensionIcon} to="api-docs" text="APIs" />
                {/* TechDocs disabled until proper production support is implemented */}
                {/* <SidebarItem icon={LibraryBooks} to="docs" text="Docs" /> */}
                <SidebarItem
                  icon={CreateComponentIcon}
                  to="create"
                  text="Create..."
                />
                {/* End global nav */}
                <SidebarScrollWrapper>
                  {/* Items in this group will be scrollable if they run out of space */}
                </SidebarScrollWrapper>
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
            <main
              id="main-content"
              tabIndex={-1}
              className={a11yClasses.mainContent}
            >
              {children}
            </main>
          </SidebarPage>
        </AssistantDrawerProvider>
      </ScaffolderPreselectionProvider>
    </OpenChoreoQueryProvider>
  );
};
