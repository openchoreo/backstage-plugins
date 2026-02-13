import { Box, Typography, Chip, IconButton } from '@material-ui/core';
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
  ComponentType: <CategoryOutlinedIcon fontSize="inherit" />,
  ComponentWorkflow: <SettingsApplicationsOutlinedIcon fontSize="inherit" />,
  Namespace: <ApartmentOutlined fontSize="inherit" />,
};

const DEFAULT_ICON = <DescriptionOutlinedIcon fontSize="inherit" />;

type CustomTemplateCardProps = {
  template: TemplateEntityV1beta3;
  onSelected?: (template: TemplateEntityV1beta3) => void;
};

export const CustomTemplateCard = ({
  template,
  onSelected,
}: CustomTemplateCardProps) => {
  const classes = useStyles();
  const { toggleStarredEntity, isStarredEntity } = useStarredEntity(template);
  const title = template.metadata.title || template.metadata.name;
  const description = template.metadata.description;
  const tags = template.metadata.tags ?? [];
  const type = template.spec.type;
  const icon = TYPE_ICONS[type] ?? DEFAULT_ICON;

  const handleClick = () => onSelected?.(template);
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  const handleStarClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleStarredEntity();
  };

  return (
    <Box
      className={`${classes.cardBase} ${classes.resourceCard}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
    >
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
};
