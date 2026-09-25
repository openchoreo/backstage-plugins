import {
  Box,
  Typography,
  Chip,
  IconButton,
  Tooltip,
  SvgIcon,
  SvgIconProps,
} from '@material-ui/core';
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

// Fishing hook glyph (Material Symbols "Phishing", Apache-2.0). Not shipped in
// @material-ui/icons v4, so the path is inlined.
const HookIcon = (props: SvgIconProps) => (
  <SvgIcon {...props}>
    <path d="M17 6.18V2h-2v4.18C13.84 6.6 13 7.7 13 9s.84 2.4 2 2.82V15c0 2.21-1.79 4-4 4s-4-1.79-4-4v-1.17l1.59 1.59L10 14 5 9v6c0 3.31 2.69 6 6 6s6-2.69 6-6v-3.18c1.16-.41 2-1.51 2-2.82s-.84-2.4-2-2.82M16 10c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1" />
  </SvgIcon>
);

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
  Hook: <HookIcon fontSize="inherit" />,
  ClusterHook: <HookIcon fontSize="inherit" />,
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
