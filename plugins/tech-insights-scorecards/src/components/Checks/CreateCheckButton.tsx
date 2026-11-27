import { useState } from 'react';
import Button from '@material-ui/core/Button';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import ListItemText from '@material-ui/core/ListItemText';
import Menu from '@material-ui/core/Menu';
import MenuItem from '@material-ui/core/MenuItem';
import SvgIcon, { type SvgIconProps } from '@material-ui/core/SvgIcon';
import { makeStyles } from '@material-ui/core/styles';
import AddIcon from '@material-ui/icons/Add';
import ArrowDropDownIcon from '@material-ui/icons/ArrowDropDown';
import EditOutlinedIcon from '@material-ui/icons/EditOutlined';

/**
 * Sparkle glyph (Material "auto_awesome") marking the option as an AI
 * feature. @material-ui/icons v4 doesn't ship it, so the path is inlined.
 */
const AiSparkleIcon = (props: SvgIconProps) => (
  <SvgIcon {...props}>
    <path d="M19 9l1.25-2.75L23 5l-2.75-1.25L19 1l-1.25 2.75L15 5l2.75 1.25L19 9zm-7.5.5L9 4 6.5 9.5 1 12l5.5 2.5L9 20l2.5-5.5L17 12l-5.5-2.5zM19 15l-1.25 2.75L15 19l2.75 1.25L19 23l1.25-2.75L23 19l-2.75-1.25L19 15z" />
  </SvgIcon>
);

/**
 * The menu takes the button's width, so the button and both options share
 * their edges; the options are compact to fit in that width.
 */
const useStyles = makeStyles({
  option: { paddingLeft: 8, paddingRight: 8 },
  optionIcon: { minWidth: 28 },
});

interface CreateCheckButtonProps {
  disabled: boolean;
  onCreateManually: () => void;
  /** Absent when no assistant is available; the button then skips the menu. */
  onGenerateWithAi?: () => void;
}

/**
 * The check list's "Create check" action: a menu offering the form or the
 * assistant, or a plain button to the form when there is no assistant.
 */
export function CreateCheckButton(props: CreateCheckButtonProps) {
  const { disabled, onCreateManually, onGenerateWithAi } = props;
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const classes = useStyles();

  if (!onGenerateWithAi) {
    return (
      <Button
        variant="contained"
        color="primary"
        size="small"
        startIcon={<AddIcon />}
        disabled={disabled}
        onClick={onCreateManually}
      >
        Create check
      </Button>
    );
  }

  const choose = (action: () => void) => () => {
    setAnchor(null);
    action();
  };

  return (
    <>
      <Button
        variant="contained"
        color="primary"
        size="small"
        startIcon={<AddIcon />}
        endIcon={<ArrowDropDownIcon />}
        disabled={disabled}
        aria-haspopup="true"
        onClick={e => setAnchor(e.currentTarget)}
      >
        Create check
      </Button>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        getContentAnchorEl={null}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{ style: { width: anchor?.offsetWidth } }}
      >
        <MenuItem className={classes.option} onClick={choose(onCreateManually)}>
          <ListItemIcon className={classes.optionIcon}>
            <EditOutlinedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary="Create manually"
            primaryTypographyProps={{ variant: 'body2' }}
          />
        </MenuItem>
        <MenuItem className={classes.option} onClick={choose(onGenerateWithAi)}>
          <ListItemIcon className={classes.optionIcon}>
            <AiSparkleIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary="Generate with AI"
            primaryTypographyProps={{ variant: 'body2' }}
          />
        </MenuItem>
      </Menu>
    </>
  );
}
