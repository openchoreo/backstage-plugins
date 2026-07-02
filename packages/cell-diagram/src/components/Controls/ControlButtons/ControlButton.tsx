import { ReactNode } from 'react';
import Tooltip from '@mui/material/Tooltip';
import { ControlIconButton } from './style';

interface ControlButtonProps {
  children: ReactNode;
  onClick: () => void;
  tooltipTitle: string;
  tooltipPlacement?: 'left-end' | 'right-end' | 'top-start';
}

export function CanvasControlButton(props: ControlButtonProps) {
  const {
    children,
    onClick,
    tooltipTitle,
    tooltipPlacement = 'left-end',
  } = props;

  return (
    <Tooltip
      arrow
      placement={tooltipPlacement}
      title={tooltipTitle}
      enterNextDelay={200}
      componentsProps={{
        tooltip: {
          sx: {
            fontFamily: 'GilmerRegular',
            fontSize: '12px',
            padding: '6px 10px',
          },
        },
      }}
      PopperProps={{
        modifiers: [
          {
            name: 'offset',
            options: {
              offset: [0, -10],
            },
          },
        ],
      }}
    >
      <ControlIconButton
        size="small"
        onClick={onClick}
        sx={{
          cursor: 'pointer',
        }}
      >
        {children}
      </ControlIconButton>
    </Tooltip>
  );
}
