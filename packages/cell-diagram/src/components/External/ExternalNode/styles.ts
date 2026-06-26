import styled from '@emotion/styled';

interface StyleProps {
  isAnonymous: boolean;
  isSelected?: boolean;
  isClickable?: boolean;
  isCollapsed?: boolean;
  isFocused?: boolean;
  height?: number;
}

export const ExternalNode = styled.div<any>`
  width: ${(props: StyleProps) => props.height}px;
  height: ${(props: StyleProps) => props.height}px;
`;
