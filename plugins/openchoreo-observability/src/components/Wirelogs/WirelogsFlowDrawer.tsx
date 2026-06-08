import { FC } from 'react';
import {
  Box,
  Chip,
  Divider,
  Drawer,
  IconButton,
  Typography,
} from '@material-ui/core';
import CloseIcon from '@material-ui/icons/Close';
import CompareArrowsIcon from '@material-ui/icons/CompareArrows';
import { useWirelogsDrawerStyles } from './styles';
import { WirelogsFlowTabs } from './WirelogsFlowTabs';
import { directionInfo, flowTitle, typeLabel } from './flowFormat';
import type { WirelogEvent, WirelogFlow } from './types';

const VERDICT_LABELS: Record<string, string> = {
  DROPPED: 'Dropped',
  FORWARDED: 'Forwarded',
};

const WirelogsFlowDrawerContent: FC<{
  flow: WirelogFlow;
  onClose: () => void;
}> = ({ flow, onClose }) => {
  const classes = useWirelogsDrawerStyles();
  const dir = directionInfo(flow);

  let verdictClass = classes.verdictUnknownChip;
  if (flow.verdict === 'DROPPED') {
    verdictClass = classes.verdictDroppedChip;
  } else if (flow.verdict === 'FORWARDED') {
    verdictClass = classes.verdictForwardedChip;
  }
  const verdictLabel =
    (flow.verdict && VERDICT_LABELS[flow.verdict]) || flow.verdict || 'Unknown';

  return (
    <Box className={classes.drawer}>
      <Box className={classes.header}>
        <Box className={classes.headerLeft}>
          <CompareArrowsIcon className={classes.headerIcon} fontSize="small" />
          <Box minWidth={0}>
            <Typography className={classes.title}>{flowTitle(flow)}</Typography>
            {flow.uuid && (
              <Typography className={classes.uuid}>{flow.uuid}</Typography>
            )}
          </Box>
        </Box>
        <Box className={classes.actions}>
          <IconButton size="small" aria-label="Close" onClick={onClose}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>

      <Box className={classes.metadataRow}>
        <Chip
          size="small"
          className={`${classes.verdictChip} ${verdictClass}`}
          label={verdictLabel}
        />
        <Chip
          size="small"
          variant="outlined"
          className={classes.metaChip}
          label={typeLabel(flow)}
        />
        {dir.direction !== 'unknown' && (
          <Chip
            size="small"
            variant="outlined"
            className={classes.metaChip}
            label={`${dir.direction === 'out' ? '←' : '→'} ${dir.label}`}
          />
        )}
      </Box>

      <Divider />

      <Box className={classes.body}>
        <WirelogsFlowTabs flow={flow} />
      </Box>
    </Box>
  );
};

interface WirelogsFlowDrawerProps {
  event: WirelogEvent | null;
  onClose: () => void;
}

export const WirelogsFlowDrawer: FC<WirelogsFlowDrawerProps> = ({
  event,
  onClose,
}) => {
  return (
    <Drawer anchor="right" open={event !== null} onClose={onClose}>
      {event && (
        <WirelogsFlowDrawerContent
          key={event.flow.uuid ?? event.flow.time}
          flow={event.flow}
          onClose={onClose}
        />
      )}
    </Drawer>
  );
};
