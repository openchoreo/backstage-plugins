import styled from '@emotion/styled';

interface PortNodeStyleProps {
  isSelected: boolean;
}
export const PortNode = styled.div<PortNodeStyleProps>`
  position: absolute;
  display: flex;
  justify-content: center;
  align-items: center;
  height: 10px;
  width: 10px;
  background-color: ${({ theme, isSelected }) =>
    isSelected ? theme.colors.SECONDARY_CONTAINER : theme.colors.SURFACE_DIM};
  border: 2px solid
    ${({ theme, isSelected }) =>
      isSelected ? theme.colors.OUTLINE_VARIANT : theme.colors.OUTLINE};
  border-radius: 50%;
  margin: -6px 0;
`;

export const TopPortNode = styled(PortNode)<PortNodeStyleProps>`
  top: 0;
  margin: -6px 0;
  align-items: flex-start;
`;

export const BottomPortNode = styled(PortNode)<PortNodeStyleProps>`
  bottom: 0;
  margin: -6px 0;
  align-items: flex-end;
`;

export const LeftPortNode = styled(PortNode)<PortNodeStyleProps>`
  left: 0;
  margin: 0 -6px;
  justify-content: flex-start;
`;

export const RightPortNode = styled(PortNode)<PortNodeStyleProps>`
  right: 0;
  margin: 0 -6px;
  justify-content: flex-end;
`;
