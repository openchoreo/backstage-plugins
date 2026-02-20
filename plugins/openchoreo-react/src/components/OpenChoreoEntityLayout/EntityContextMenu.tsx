import { type SyntheticEvent, useEffect, useState } from 'react';
import Divider from '@material-ui/core/Divider';
import FileCopyTwoToneIcon from '@material-ui/icons/FileCopyTwoTone';
import IconButton from '@material-ui/core/IconButton';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import ListItemText from '@material-ui/core/ListItemText';
import MenuItem from '@material-ui/core/MenuItem';
import MenuList from '@material-ui/core/MenuList';
import Popover from '@material-ui/core/Popover';
import Tooltip from '@material-ui/core/Tooltip';
import { makeStyles } from '@material-ui/core/styles';
import BugReportIcon from '@material-ui/icons/BugReport';
import MoreVert from '@material-ui/icons/MoreVert';
import { useApi, alertApiRef } from '@backstage/core-plugin-api';
import useCopyToClipboard from 'react-use/esm/useCopyToClipboard';
import type { ExtraContextMenuItem } from './OpenChoreoEntityLayout';

interface EntityContextMenuProps {
  extraContextMenuItems?: ExtraContextMenuItem[];
  contextMenuOptions?: {
    disableUnregister: boolean | 'visible' | 'hidden' | 'disable';
  };
  onInspectEntity: () => void;
}

const useStyles = makeStyles(theme => ({
  button: {
    color: theme.page.fontColor,
  },
}));

export function EntityContextMenu(props: EntityContextMenuProps) {
  const { extraContextMenuItems, onInspectEntity } = props;
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement>();
  const classes = useStyles();

  const onOpen = (event: SyntheticEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const onClose = () => {
    setAnchorEl(undefined);
  };

  const alertApi = useApi(alertApiRef);
  const [copyState, copyToClipboard] = useCopyToClipboard();
  useEffect(() => {
    if (!copyState.error && copyState.value) {
      alertApi.post({
        message: 'Copied!',
        severity: 'info',
        display: 'transient',
      });
    }
  }, [copyState, alertApi]);

  const extraItems = extraContextMenuItems?.length
    ? [
        ...extraContextMenuItems.map(item => (
          <MenuItem
            key={item.title}
            onClick={() => {
              onClose();
              item.onClick();
            }}
          >
            <ListItemIcon>
              <item.Icon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary={item.title} />
          </MenuItem>
        )),
        <Divider key="divider" />,
      ]
    : null;

  return (
    <>
      <Tooltip title="More" arrow>
        <IconButton
          aria-label="more"
          aria-controls="long-menu"
          aria-haspopup="true"
          aria-expanded={!!anchorEl}
          role="button"
          onClick={onOpen}
          data-testid="menu-button"
          className={classes.button}
          id="long-menu"
        >
          <MoreVert />
        </IconButton>
      </Tooltip>
      <Popover
        open={Boolean(anchorEl)}
        onClose={onClose}
        anchorEl={anchorEl}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        aria-labelledby="long-menu"
        PaperProps={{ style: { minWidth: 200 } }}
      >
        <MenuList autoFocusItem={Boolean(anchorEl)}>
          {extraItems}
          <MenuItem
            onClick={() => {
              onClose();
              onInspectEntity();
            }}
          >
            <ListItemIcon>
              <BugReportIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Inspect entity" />
          </MenuItem>
          <MenuItem
            onClick={() => {
              onClose();
              copyToClipboard(window.location.toString());
            }}
          >
            <ListItemIcon>
              <FileCopyTwoToneIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Copy URL" />
          </MenuItem>
        </MenuList>
      </Popover>
    </>
  );
}
