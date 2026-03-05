import { Box, Typography, Chip, IconButton, Tooltip } from '@material-ui/core';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import StarIcon from '@material-ui/icons/Star';
import StarBorderIcon from '@material-ui/icons/StarBorder';
import FolderOutlinedIcon from '@material-ui/icons/FolderOutlined';
import WidgetsOutlinedIcon from '@material-ui/icons/WidgetsOutlined';
import CloudOutlinedIcon from '@material-ui/icons/CloudOutlined';
import ExtensionOutlinedIcon from '@material-ui/icons/ExtensionOutlined';
import CategoryOutlinedIcon from '@material-ui/icons/CategoryOutlined';
import SettingsApplicationsOutlinedIcon from '@material-ui/icons/SettingsApplicationsOutlined';
import DescriptionOutlinedIcon from '@material-ui/icons/DescriptionOutlined';
import ApartmentOutlined from '@material-ui/icons/ApartmentOutlined';
import { useStarredEntity } from '@backstage/plugin-catalog-react';
import type { TemplateEntityV1beta3 } from '@backstage/plugin-scaffolder-common';
import { useStyles } from './styles';

const TYPE_ICONS: Record<string, React.ReactElement> = {
  'System (Project)': <FolderOutlinedIcon fontSize="inherit" />,
  Component: <WidgetsOutlinedIcon fontSize="inherit" />,
  Environment: <CloudOutlinedIcon fontSize="inherit" />,
  Trait: <ExtensionOutlinedIcon fontSize="inherit" />,
  ClusterTrait: <ExtensionOutlinedIcon fontSize="inherit" />,
  ComponentType: <CategoryOutlinedIcon fontSize="inherit" />,
  ClusterComponentType: <CategoryOutlinedIcon fontSize="inherit" />,
  ComponentWorkflow: <SettingsApplicationsOutlinedIcon fontSize="inherit" />,
  Namespace: <ApartmentOutlined fontSize="inherit" />,
};

const DEFAULT_ICON = <DescriptionOutlinedIcon fontSize="inherit" />;

type CustomTemplateCardProps = {
  template: TemplateEntityV1beta3;
  onSelected?: (template: TemplateEntityV1beta3) => void;
  disabled?: boolean;
};

export const CustomTemplateCard = ({
  template,
  onSelected,
  disabled,
}: CustomTemplateCardProps) => {
  const classes = useStyles();
  const { toggleStarredEntity, isStarredEntity } = useStarredEntity(template);
  const title = template.metadata.title || template.metadata.name;
  const description = template.metadata.description;
  const tags = template.metadata.tags ?? [];
  const type = template.spec.type;
  const icon = TYPE_ICONS[type] ?? DEFAULT_ICON;
  const workloadType =
    template.metadata.annotations?.[CHOREO_ANNOTATIONS.WORKLOAD_TYPE];

  const handleClick = () => {
    if (!disabled) onSelected?.(template);
  };
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      handleClick();
    }
  };

  const handleStarClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!disabled) toggleStarredEntity();
  };

  const card = (
    <Box
      className={`${classes.cardBase} ${classes.resourceCard} ${
        disabled ? classes.cardDisabled : ''
      }`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
    >
      {workloadType && (
        <Typography className={classes.workloadTypeBadge}>
          {workloadType}
        </Typography>
      )}
      <IconButton
        size="small"
        className={`${classes.starButton} ${
          isStarredEntity ? classes.starButtonActive : ''
        }`}
        onClick={handleStarClick}
        aria-label={
          isStarredEntity ? 'Remove from favorites' : 'Add to favorites'
        }
      >
        {isStarredEntity ? (
          <StarIcon fontSize="small" />
        ) : (
          <StarBorderIcon fontSize="small" />
        )}
      </IconButton>
      <Box className={classes.resourceCardIcon}>{icon}</Box>
      <Typography className={classes.resourceCardTitle}>{title}</Typography>
      {template.metadata.namespace &&
        template.metadata.namespace !== 'default' && (
          <Chip
            label={template.metadata.namespace}
            size="small"
            variant="outlined"
            className={classes.namespaceChip}
          />
        )}
      {description && (
        <Typography className={classes.resourceCardDescription}>
          {description}
        </Typography>
      )}
      {tags.length > 0 && (
        <Box className={classes.templateCardFooter}>
          {tags.map(tag => (
            <Chip
              key={tag}
              label={tag}
              size="small"
              variant="outlined"
              className={classes.templateCardChip}
            />
          ))}
        </Box>
      )}
    </Box>
  );

  if (disabled) {
    return (
      <Tooltip title="You do not have permission to create this resource">
        <Box className={classes.cardDisabledWrapper}>{card}</Box>
      </Tooltip>
    );
  }

  return card;
};
