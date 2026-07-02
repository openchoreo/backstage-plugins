import { Box, Typography, Chip, IconButton, Tooltip } from '@material-ui/core';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import StarIcon from '@material-ui/icons/Star';
import StarBorderIcon from '@material-ui/icons/StarBorder';
import FolderOutlinedIcon from '@material-ui/icons/FolderOutlined';
import WidgetsOutlinedIcon from '@material-ui/icons/WidgetsOutlined';
import CloudOutlinedIcon from '@material-ui/icons/CloudOutlined';
import ExtensionOutlinedIcon from '@material-ui/icons/ExtensionOutlined';
import CategoryOutlinedIcon from '@material-ui/icons/CategoryOutlined';
import LayersOutlinedIcon from '@material-ui/icons/LayersOutlined';
import StorageOutlinedIcon from '@material-ui/icons/StorageOutlined';
import SettingsApplicationsOutlinedIcon from '@material-ui/icons/SettingsApplicationsOutlined';
import DescriptionOutlinedIcon from '@material-ui/icons/DescriptionOutlined';
import ApartmentOutlined from '@material-ui/icons/ApartmentOutlined';
import AccountTreeOutlined from '@material-ui/icons/AccountTreeOutlined';
import NotificationsOutlinedIcon from '@material-ui/icons/NotificationsOutlined';
import { useStarredEntity } from '@backstage/plugin-catalog-react';
import type { TemplateEntityV1beta3 } from '@backstage/plugin-scaffolder-common';
import { useStyles } from './styles';

const TYPE_ICONS: Record<string, React.ReactElement> = {
  'System (Project)': <FolderOutlinedIcon fontSize="inherit" />,
  Component: <WidgetsOutlinedIcon fontSize="inherit" />,
  Environment: <CloudOutlinedIcon fontSize="inherit" />,
  ObservabilityAlertsNotificationChannel: (
    <NotificationsOutlinedIcon fontSize="inherit" />
  ),
  Trait: <ExtensionOutlinedIcon fontSize="inherit" />,
  ClusterTrait: <ExtensionOutlinedIcon fontSize="inherit" />,
  ComponentType: <CategoryOutlinedIcon fontSize="inherit" />,
  ClusterComponentType: <CategoryOutlinedIcon fontSize="inherit" />,
  ResourceType: <LayersOutlinedIcon fontSize="inherit" />,
  ClusterResourceType: <LayersOutlinedIcon fontSize="inherit" />,
  Resource: <StorageOutlinedIcon fontSize="inherit" />,
  ComponentWorkflow: <SettingsApplicationsOutlinedIcon fontSize="inherit" />,
  Namespace: <ApartmentOutlined fontSize="inherit" />,
  DeploymentPipeline: <AccountTreeOutlined fontSize="inherit" />,
};

const DEFAULT_ICON = <DescriptionOutlinedIcon fontSize="inherit" />;

type CustomTemplateCardProps = {
  template: TemplateEntityV1beta3;
  onSelected?: (template: TemplateEntityV1beta3) => void;
  disabled?: boolean;
  /**
   * Tooltip text shown when `disabled` is true. Defaults to the generic
   * "no permission" copy.
   */
  disabledReason?: string;
};

export const CustomTemplateCard = ({
  template,
  onSelected,
  disabled,
  disabledReason,
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

  const handleTitleClick = (e: React.MouseEvent) => {
    // Outer Box also has onClick; stop here so we don't double-fire.
    e.stopPropagation();
    handleClick();
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
      <button
        type="button"
        className={classes.resourceCardTitleButton}
        onClick={handleTitleClick}
        disabled={disabled}
        aria-label={`Use template ${title}`}
      >
        {title}
      </button>
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
      <Tooltip
        title={
          disabledReason ?? 'You do not have permission to create this resource'
        }
      >
        <Box className={classes.cardDisabledWrapper}>{card}</Box>
      </Tooltip>
    );
  }

  return card;
};
