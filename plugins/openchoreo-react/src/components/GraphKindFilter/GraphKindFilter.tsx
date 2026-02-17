import { ReactNode, useMemo } from 'react';
import { makeStyles, useTheme } from '@material-ui/core/styles';
import Box from '@material-ui/core/Box';
import Chip from '@material-ui/core/Chip';
import Typography from '@material-ui/core/Typography';
import {
  FILTER_PRESETS,
  ALL_FILTERABLE_KINDS,
} from '../../utils/platformOverviewConstants';
import {
  ENTITY_KIND_COLORS,
  DEFAULT_NODE_COLOR,
  getNodeTintFill,
} from '../../utils/graphUtils';

const useStyles = makeStyles(theme => ({
  root: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: theme.spacing(0.75),
    padding: theme.spacing(1.5, 2),
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
  label: {
    fontSize: '0.75rem',
    fontWeight: 500,
    color: theme.palette.text.secondary,
    whiteSpace: 'nowrap',
  },
  presetChip: {
    height: 26,
    fontSize: '0.75rem',
    fontWeight: 500,
    cursor: 'pointer',
    borderRadius: 6,
    transition: 'background-color 150ms, border-color 150ms',
  },
  divider: {
    width: 1,
    height: 20,
    backgroundColor: theme.palette.divider,
    margin: theme.spacing(0, 0.5),
  },
  kindChip: {
    height: 24,
    fontSize: '0.72rem',
    cursor: 'pointer',
    borderRadius: 6,
    transition: 'opacity 150ms',
    '& .MuiChip-label': {
      display: 'flex',
      alignItems: 'center',
    },
    '& .MuiChip-label::before': {
      content: '""',
      display: 'inline-block',
      width: 7,
      height: 7,
      minWidth: 7,
      borderRadius: '50%',
      marginRight: 4,
      backgroundColor: 'var(--dot-color)',
    },
  },
}));

export type GraphKindFilterProps = {
  selectedKinds: string[];
  onKindsChange: (kinds: string[]) => void;
  leading?: ReactNode;
};

export function GraphKindFilter({
  selectedKinds,
  onKindsChange,
  leading,
}: GraphKindFilterProps) {
  const classes = useStyles();
  const theme = useTheme();
  const isDark = theme.palette.type === 'dark';
  const selectedSet = useMemo(() => new Set(selectedKinds), [selectedKinds]);

  const activePresetId = useMemo(() => {
    for (const preset of FILTER_PRESETS) {
      const presetSet = new Set(preset.kinds);
      if (
        presetSet.size === selectedSet.size &&
        preset.kinds.every(k => selectedSet.has(k))
      ) {
        return preset.id;
      }
    }
    return undefined;
  }, [selectedSet]);

  const handlePresetClick = (presetId: string) => {
    const preset = FILTER_PRESETS.find(p => p.id === presetId);
    if (preset) {
      onKindsChange([...preset.kinds]);
    }
  };

  const handleKindToggle = (kind: string) => {
    if (selectedSet.has(kind)) {
      if (selectedSet.size <= 1) return;
      onKindsChange(selectedKinds.filter(k => k !== kind));
    } else {
      onKindsChange([...selectedKinds, kind]);
    }
  };

  return (
    <Box className={classes.root}>
      {leading}
      {leading && <div className={classes.divider} />}
      <Typography className={classes.label}>Kind</Typography>
      {FILTER_PRESETS.map(preset => {
        const isActive = activePresetId === preset.id;
        return (
          <Chip
            key={preset.id}
            label={preset.label}
            size="small"
            clickable
            onClick={() => handlePresetClick(preset.id)}
            className={classes.presetChip}
            style={
              isActive
                ? {
                    backgroundColor: theme.palette.primary.main,
                    color: theme.palette.primary.contrastText,
                    border: `1px solid ${theme.palette.primary.main}`,
                  }
                : {
                    backgroundColor: 'transparent',
                    color: theme.palette.text.primary,
                    border: `1px solid ${theme.palette.divider}`,
                  }
            }
          />
        );
      })}
      <div className={classes.divider} />
      {ALL_FILTERABLE_KINDS.map(kind => {
        const isSelected = selectedSet.has(kind.id);
        const color =
          ENTITY_KIND_COLORS[kind.id.toLowerCase()] ?? DEFAULT_NODE_COLOR;
        return (
          <Chip
            key={kind.id}
            label={kind.label}
            size="small"
            clickable
            onClick={() => handleKindToggle(kind.id)}
            className={classes.kindChip}
            style={{
              backgroundColor: isSelected
                ? getNodeTintFill(color, isDark)
                : 'transparent',
              border: `1px solid ${isSelected ? `${color}B3` : theme.palette.divider}`,
              opacity: isSelected ? 1 : 0.5,
              color: theme.palette.text.primary,
              ['--dot-color' as string]: isSelected
                ? color
                : theme.palette.text.disabled,
            }}
          />
        );
      })}
    </Box>
  );
}
