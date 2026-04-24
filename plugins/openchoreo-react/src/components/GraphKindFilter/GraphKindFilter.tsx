import { ReactNode, useMemo, useState } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import Popover from '@material-ui/core/Popover';
import MenuList from '@material-ui/core/MenuList';
import MenuItem from '@material-ui/core/MenuItem';
import Checkbox from '@material-ui/core/Checkbox';
import Divider from '@material-ui/core/Divider';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import ListItemText from '@material-ui/core/ListItemText';
import ArrowDropDownIcon from '@material-ui/icons/ArrowDropDown';
import {
  getFilterPresets,
  ALL_FILTERABLE_KINDS,
} from '../../utils/platformOverviewConstants';
import { useChoreoTokens } from '@openchoreo/backstage-design-system';
import { getNodeColor } from '../../utils/graphUtils';

const useStyles = makeStyles(theme => ({
  root: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: theme.spacing(0.75),
    padding: theme.spacing(1.5, 2),
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
  divider: {
    width: 1,
    height: 20,
    backgroundColor: theme.palette.divider,
    margin: theme.spacing(0, 0.5),
  },
  triggerButton: {
    textTransform: 'none',
    fontSize: '0.8rem',
    fontWeight: 500,
    padding: theme.spacing(0.5, 1.5),
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 6,
    color: theme.palette.text.primary,
    whiteSpace: 'nowrap',
    '&:hover': {
      borderColor: theme.palette.text.secondary,
    },
  },
  popoverPaper: {
    minWidth: 220,
  },
  menuItem: {
    minHeight: 36,
    paddingTop: 2,
    paddingBottom: 2,
  },
  kindDot: {
    width: 8,
    height: 8,
    minWidth: 8,
    borderRadius: '50%',
    marginRight: theme.spacing(1),
  },
  checkbox: {
    padding: 4,
  },
}));

export type GraphKindFilterProps = {
  selectedKinds: string[];
  onKindsChange: (kinds: string[]) => void;
  clusterScopeActive?: boolean;
  leading?: ReactNode;
  trailing?: ReactNode;
};

export function GraphKindFilter({
  selectedKinds,
  onKindsChange,
  clusterScopeActive = false,
  leading,
  trailing,
}: GraphKindFilterProps) {
  const classes = useStyles();
  const tokens = useChoreoTokens();
  const selectedSet = useMemo(() => new Set(selectedKinds), [selectedKinds]);
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const open = Boolean(anchorEl);

  const presets = useMemo(
    () => getFilterPresets(clusterScopeActive),
    [clusterScopeActive],
  );

  const visibleKinds = useMemo(
    () =>
      clusterScopeActive
        ? ALL_FILTERABLE_KINDS
        : ALL_FILTERABLE_KINDS.filter(k => !k.clusterScoped),
    [clusterScopeActive],
  );

  const activePreset = useMemo(() => {
    for (const preset of presets) {
      const presetSet = new Set(preset.kinds);
      if (
        presetSet.size === selectedSet.size &&
        preset.kinds.every(k => selectedSet.has(k))
      ) {
        return preset;
      }
    }
    return undefined;
  }, [selectedSet, presets]);

  const buttonLabel = useMemo(() => {
    if (activePreset) return `Kind: ${activePreset.label}`;
    if (selectedSet.size === 1) {
      const kindId = selectedKinds[0];
      const kind = ALL_FILTERABLE_KINDS.find(k => k.id === kindId);
      return `Kind: ${kind?.label ?? kindId}`;
    }
    return `Kind: ${selectedSet.size} selected`;
  }, [activePreset, selectedSet, selectedKinds]);

  const getPresetState = (presetKinds: string[]) => {
    const selected = presetKinds.filter(k => selectedSet.has(k)).length;
    if (selected === presetKinds.length) return 'checked';
    if (selected > 0) return 'indeterminate';
    return 'unchecked';
  };

  const handlePresetClick = (presetId: string) => {
    const preset = presets.find(p => p.id === presetId);
    if (!preset) return;
    const state = getPresetState(preset.kinds);
    if (state === 'checked') {
      // Deselect: remove this preset's kinds from the selection
      const remaining = selectedKinds.filter(k => !preset.kinds.includes(k));
      onKindsChange(remaining);
    } else {
      onKindsChange([...preset.kinds]);
    }
  };

  const handleKindToggle = (kind: string) => {
    if (selectedSet.has(kind)) {
      onKindsChange(selectedKinds.filter(k => k !== kind));
    } else {
      onKindsChange([...selectedKinds, kind]);
    }
  };

  return (
    <Box className={classes.root}>
      {leading}
      {leading && <div className={classes.divider} />}
      <Button
        className={classes.triggerButton}
        endIcon={<ArrowDropDownIcon />}
        onClick={e => setAnchorEl(e.currentTarget)}
      >
        {buttonLabel}
      </Button>
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        PaperProps={{ className: classes.popoverPaper }}
      >
        <MenuList dense>
          {presets.map(preset => {
            const state = getPresetState(preset.kinds);
            return (
              <MenuItem
                key={preset.id}
                className={classes.menuItem}
                onClick={() => handlePresetClick(preset.id)}
              >
                <ListItemIcon>
                  <Checkbox
                    className={classes.checkbox}
                    checked={state === 'checked'}
                    indeterminate={state === 'indeterminate'}
                    color="primary"
                    size="small"
                    disableRipple
                  />
                </ListItemIcon>
                <ListItemText primary={preset.label} />
              </MenuItem>
            );
          })}
        </MenuList>
        <Divider />
        <MenuList dense>
          {visibleKinds.map((kind, index) => {
            const isSelected = selectedSet.has(kind.id);
            const color = getNodeColor(kind.id, tokens);
            const showDivider =
              kind.clusterScoped &&
              index > 0 &&
              !visibleKinds[index - 1].clusterScoped;
            return (
              <span key={kind.id}>
                {showDivider && <Divider />}
                <MenuItem
                  className={classes.menuItem}
                  onClick={() => handleKindToggle(kind.id)}
                >
                  <ListItemIcon>
                    <Checkbox
                      className={classes.checkbox}
                      checked={isSelected}
                      color="primary"
                      size="small"
                      disableRipple
                    />
                  </ListItemIcon>
                  <span
                    className={classes.kindDot}
                    style={{ backgroundColor: color }}
                  />
                  <ListItemText primary={kind.label} />
                </MenuItem>
              </span>
            );
          })}
        </MenuList>
      </Popover>
      {trailing && <div className={classes.divider} />}
      {trailing}
    </Box>
  );
}
