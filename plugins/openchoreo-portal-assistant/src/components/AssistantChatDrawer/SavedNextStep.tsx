import Box from '@material-ui/core/Box';
import Typography from '@material-ui/core/Typography';
import { makeStyles } from '@material-ui/core/styles';
import CheckCircleOutlineIcon from '@material-ui/icons/CheckCircleOutline';
import type { SavedCheck } from '../ConfirmCard/ConfirmCard';
import { useCardStyles } from '../AgentUi/cardStyles';

// The text is the card's last part: no line under it.
const useStyles = makeStyles({ last: { borderBottom: 'none' } });

/** What the follow-up says, by how the check was saved. */
export function nextStepWords(saved: SavedCheck): {
  title: string;
  text: string;
} {
  if (saved.status === 'draft') {
    return {
      title: 'Saved as a draft',
      text: "It doesn't change any scores until you publish it.",
    };
  }
  if (saved.wasPublished) {
    return {
      title: 'Saved, still published',
      text: "Every entity's score now uses the new rule.",
    };
  }
  return {
    title: 'Published',
    text: "Every entity's score now includes this check.",
  };
}

/**
 * The assistant's next step after a save card saved a check: what the save
 * did, and nothing more — a test is offered only before saving. The drawer
 * adds it to the chat; it is never sent to the agent.
 */
export const SavedNextStep = ({ saved }: { saved: SavedCheck }) => {
  const cardClasses = useCardStyles();
  const classes = useStyles();
  const { title, text } = nextStepWords(saved);
  return (
    <Box className={cardClasses.card} role="group" aria-label={title}>
      <Box className={cardClasses.head}>
        <span className={cardClasses.icon} aria-hidden="true">
          <CheckCircleOutlineIcon />
        </span>
        <Typography variant="body2" className={cardClasses.title}>
          {title}
        </Typography>
        <Typography variant="caption" className={cardClasses.subtitle}>
          {saved.name}
        </Typography>
      </Box>
      <Typography
        variant="body1"
        className={`${cardClasses.summary} ${classes.last}`}
      >
        {text}
      </Typography>
    </Box>
  );
};
