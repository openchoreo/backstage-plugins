import { Box, Divider } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { ChoreoEntityKindPicker } from './ChoreoEntityKindPicker';
import { CatalogSearchField } from './CatalogSearchField';
import { LabelTokenFilter } from './LabelTokenFilter';
import {
  NamespaceChip,
  ProjectChip,
  ComponentChip,
  TypeChip,
  StarredChip,
} from './CustomPersonalFilters';

const useStyles = makeStyles(theme => ({
  // Inline row on desktop.
  row: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: theme.spacing(1),
    width: '100%',
  },
  // Full-width vertical stack in the mobile drawer.
  stack: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'stretch',
    gap: theme.spacing(1.5),
    width: '100%',
    '& > *': {
      width: '100% !important',
      maxWidth: 'none',
    },
    '& .MuiChip-root': {
      width: '100%',
      justifyContent: 'space-between',
    },
  },
  divider: {
    height: 24,
    alignSelf: 'center',
    margin: theme.spacing(0, 0.5),
  },
}));

export interface CatalogFilterControlsProps {
  /** `row` for the inline desktop bar, `stack` for the mobile drawer. */
  layout?: 'row' | 'stack';
  /** Render the Kind picker as part of the set (used in the drawer). */
  includeKind?: boolean;
  initialKind?: string;
}

/**
 * All catalog filter controls, rendered inline on desktop or stacked in the
 * mobile drawer — one instance at a time drives the shared entity-list filters.
 */
export const CatalogFilterControls = ({
  layout = 'row',
  includeKind = false,
  initialKind = 'component',
}: CatalogFilterControlsProps) => {
  const classes = useStyles();
  const isStack = layout === 'stack';

  return (
    <Box className={isStack ? classes.stack : classes.row}>
      {includeKind && <ChoreoEntityKindPicker initialFilter={initialKind} />}
      <CatalogSearchField />
      <LabelTokenFilter />
      <NamespaceChip />
      <ProjectChip />
      <ComponentChip />
      <TypeChip />
      {!isStack && (
        <Divider orientation="vertical" className={classes.divider} />
      )}
      <StarredChip />
    </Box>
  );
};
