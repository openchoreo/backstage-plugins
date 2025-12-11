import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Box,
  Typography,
  IconButton,
  Chip,
} from '@material-ui/core';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import EditIcon from '@material-ui/icons/Edit';
import DeleteIcon from '@material-ui/icons/Delete';
import UndoIcon from '@material-ui/icons/Undo';
import { useTraitsStyles } from './styles';
import { TraitWithState } from './types';

interface TraitAccordionProps {
  trait: TraitWithState;
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onUndo?: () => void;
}

export const TraitAccordion: React.FC<TraitAccordionProps> = ({
  trait,
  expanded,
  onToggle,
  onEdit,
  onDelete,
  onUndo,
}) => {
  const classes = useTraitsStyles();

  const renderBadge = () => {
    if (trait.state === 'added') {
      return (
        <Chip
          label="Added"
          size="small"
          variant="outlined"
          className={`${classes.badge} ${classes.badgeAdded}`}
        />
      );
    }
    if (trait.state === 'modified') {
      return (
        <Chip
          label="Modified"
          size="small"
          variant="outlined"
          className={`${classes.badge} ${classes.badgeModified}`}
        />
      );
    }
    if (trait.state === 'deleted') {
      return (
        <Chip
          label="Deleted"
          size="small"
          variant="outlined"
          className={`${classes.badge} ${classes.badgeDeleted}`}
        />
      );
    }
    return null;
  };

  const renderParameters = () => {
    if (!trait.parameters || Object.keys(trait.parameters).length === 0) {
      return (
        <Typography variant="body2" className={classes.noParameters}>
          No parameters configured
        </Typography>
      );
    }

    const renderValue = (value: unknown): string => {
      if (value === null) return 'null';
      if (value === undefined) return 'undefined';
      if (typeof value === 'object') return JSON.stringify(value, null, 2);
      return String(value);
    };

    return (
      <ul className={classes.parametersList}>
        {Object.entries(trait.parameters).map(([key, value]) => (
          <li key={key} className={classes.parameterItem}>
            <span className={classes.parameterKey}>{key}</span>:{' '}
            <span className={classes.parameterValue}>{renderValue(value)}</span>
          </li>
        ))}
      </ul>
    );
  };

  return (
    <Accordion
      expanded={expanded}
      onChange={onToggle}
      className={`${classes.accordion} ${
        trait.state === 'deleted' ? classes.accordionDeleted : ''
      }`}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreIcon />}
        className={classes.accordionSummary}
      >
        <Box className={classes.accordionLeft}>
          <Typography className={classes.traitTitle}>
            {trait.instanceName}{' '}
            <span className={classes.traitType}>({trait.name})</span>
          </Typography>
          {renderBadge()}
        </Box>
        <Box
          className={classes.accordionRight}
          onClick={e => e.stopPropagation()}
        >
          {trait.state !== 'deleted' && (
            <>
              <IconButton size="small" onClick={onEdit} title="Edit trait">
                <EditIcon fontSize="small" />
              </IconButton>
              <IconButton
                size="small"
                onClick={onDelete}
                title="Delete trait"
                color="secondary"
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </>
          )}
          {trait.state === 'deleted' && onUndo && (
            <IconButton
              size="small"
              onClick={onUndo}
              title="Undo delete"
              color="primary"
            >
              <UndoIcon fontSize="small" />
            </IconButton>
          )}
        </Box>
      </AccordionSummary>
      <AccordionDetails>
        <Box className={classes.parametersContainer}>
          <Typography variant="subtitle2" className={classes.parametersTitle}>
            Parameters:
          </Typography>
          {renderParameters()}
        </Box>
      </AccordionDetails>
    </Accordion>
  );
};
