import { type ReactNode } from 'react';
import Box from '@material-ui/core/Box';
import Chip from '@material-ui/core/Chip';
import Tooltip from '@material-ui/core/Tooltip';
import Typography from '@material-ui/core/Typography';
import { makeStyles } from '@material-ui/core/styles';
import {
  EntityDisplayName,
  EntityRefLink,
  FavoriteEntity,
} from '@backstage/plugin-catalog-react';
import { Breadcrumbs } from '@backstage/core-components';
import type { Entity, EntityRelation } from '@backstage/catalog-model';
import { useNavigate } from 'react-router-dom';

export interface CompactEntityHeaderProps {
  entity: Entity;
  headerTitle: string;
  kind: string;
  /** Current entity name for breadcrumb trail */
  entityName: string;
  kindDisplayNames?: Record<string, string>;
  parentEntity?: EntityRelation | null;
  ancestorEntity?: EntityRelation | null;
  contextMenu?: ReactNode;
}

// Named 'BackstageHeader' so that theme component overrides for
// BackstageHeader (backgroundImage, boxShadow, minHeight, etc.) are
// automatically merged into the matching class keys by MUI's style system.
const useStyles = makeStyles(
  theme => ({
    header: {
      gridArea: 'pageHeader',
      padding: theme.spacing(2, 3),
      width: '100%',
      color: theme.page.fontColor,
      backgroundImage: theme.page.backgroundImage,
      backgroundPosition: 'center',
      backgroundSize: 'cover',
      boxShadow: theme.shadows[4],
      [theme.breakpoints.down('sm')]: {
        padding: theme.spacing(2),
      },
    },
    topRow: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing(1),
      minHeight: 40,
    },
    chip: {
      color: theme.page.fontColor,
      borderColor: `${theme.page.fontColor}80`,
      fontSize: '0.7rem',
      fontWeight: 600,
      height: 24,
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
    },
    kindChip: {
      cursor: 'pointer',
      '&:hover': {
        backgroundColor: `${theme.page.fontColor}1A`,
      },
    },
    title: {
      color: theme.page.fontColor,
      fontSize: theme.typography.h5.fontSize,
      fontWeight: theme.typography.h5.fontWeight as number,
      wordBreak: 'break-word',
      display: 'inline-flex',
      alignItems: 'center',
    },
    favorite: {
      display: 'inline-flex',
      '& button:hover svg': {
        color: '#f3ba37',
      },
    },
    breadcrumbs: {
      color: theme.page.fontColor,
      fontSize: theme.typography.caption.fontSize,
      textTransform: 'uppercase',
      marginTop: theme.spacing(0.5),
      opacity: 0.8,
      '& span': {
        color: theme.page.fontColor,
        textDecoration: 'underline',
        textUnderlineOffset: '3px',
      },
    },
  }),
  { name: 'BackstageHeader' },
);

export function CompactEntityHeader(props: CompactEntityHeaderProps) {
  const {
    entity,
    kind,
    entityName,
    kindDisplayNames,
    parentEntity,
    ancestorEntity,
    contextMenu,
  } = props;
  const classes = useStyles();
  const navigate = useNavigate();

  const kindLabel = kindDisplayNames?.[kind.toLowerCase()] ?? kind;

  const entityType =
    entity.spec && 'type' in entity.spec
      ? (entity.spec as { type: string }).type
      : undefined;

  return (
    <header className={classes.header}>
      <Box className={classes.topRow}>
        <Typography variant="h5" className={classes.title}>
          <EntityDisplayName entityRef={entity} hideIcon />
        </Typography>
        <Box component="span" className={classes.favorite}>
          <FavoriteEntity entity={entity} />
        </Box>
        <Tooltip title={`View all ${kindLabel} entities`}>
          <Chip
            label={kindLabel}
            variant="outlined"
            size="small"
            clickable
            className={`${classes.chip} ${classes.kindChip}`}
            onClick={() =>
              navigate(`/catalog?filters[kind]=${kind.toLowerCase()}`)
            }
          />
        </Tooltip>
        {entityType && (
          <Chip
            label={entityType}
            variant="outlined"
            size="small"
            className={classes.chip}
          />
        )}
        <Box flexGrow={1} />
        {contextMenu}
      </Box>
      {parentEntity && (
        <Breadcrumbs separator=">" className={classes.breadcrumbs}>
          {ancestorEntity && (
            <EntityRefLink
              entityRef={ancestorEntity.targetRef}
              disableTooltip
            />
          )}
          <EntityRefLink entityRef={parentEntity.targetRef} disableTooltip />
          {entityName}
        </Breadcrumbs>
      )}
    </header>
  );
}
