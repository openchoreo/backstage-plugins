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
import { AssistantDrawerProvider } from '@openchoreo/backstage-plugin-openchoreo-perch';

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
    // Reload to clear session and redirect to sign-in page
    window.location.href = '/';
  };

  return (
    <SidebarItem icon={ExitToAppIcon} text="Sign Out" onClick={handleSignOut} />
  );
};

export const Root = ({ children }: PropsWithChildren<{}>) => {
  useSearchModalStyles();
  return (
    <AssistantDrawerProvider>
      <SidebarPage>
        <Sidebar>
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
        {children}
      </SidebarPage>
    </AssistantDrawerProvider>
  );
};
