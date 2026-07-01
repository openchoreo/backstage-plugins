import styled from '@emotion/styled';
import { ReactNode } from 'react';
import Tooltip from '@mui/material/Tooltip';

interface ButtonProps {
  selected?: boolean;
  clickable?: boolean;
}

const Button = styled.div<ButtonProps>`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  cursor: ${props => (props.clickable ? 'pointer' : 'not-allowed')};
  color: ${({ theme, selected }) =>
    selected ? theme.colors.PRIMARY : theme.colors.ON_SURFACE_VARIANT};
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  div {
    border: 1px solid
      ${({ theme, selected }) =>
        selected ? theme.colors.PRIMARY : theme.colors.SURFACE_DIM};
    background-color: ${({ theme }) => theme.colors.SURFACE};
    color: ${({ theme, selected }) =>
      selected ? theme.colors.PRIMARY : theme.colors.OUTLINE_VARIANT};
  }
  &:hover {
    color: ${({ theme }) => theme.colors.PRIMARY};
  }
  &:hover div {
    border: 1px solid ${({ theme }) => theme.colors.PRIMARY};
    color: ${({ theme }) => theme.colors.PRIMARY};
  }
`;

const TooltipContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: start;
  gap: 12px;
`;

const Title = styled.div`
  font-size: 12px;
  font-weight: 600;
`;

const Description = styled.div`
  font-size: 12px;
`;

interface LayerButtonProps {
  children: ReactNode;
  selected?: boolean;
  clickable?: boolean;
  onClick: () => void;
  tooltipTitle?: string;
  tooltipDescription?: string;
  tooltipPlacement?: 'left-end' | 'right-end' | 'top-start';
}

export function LayerButton(props: LayerButtonProps) {
  const {
    children,
    onClick,
    selected = false,
    clickable = true,
    tooltipTitle,
    tooltipDescription,
    tooltipPlacement = 'top-start',
  } = props;

  return (
    <Tooltip
      arrow
      placement={tooltipPlacement}
      title={
        <>
          {!tooltipDescription && <> {tooltipTitle} </>}
          {tooltipDescription && (
            <TooltipContainer>
              <Title>{tooltipTitle}</Title>
              <Description>{tooltipDescription}</Description>
            </TooltipContainer>
          )}
        </>
      }
      enterNextDelay={500}
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
      <Button onClick={onClick} selected={selected} clickable={clickable}>
        {children}
      </Button>
    </Tooltip>
  );
}
