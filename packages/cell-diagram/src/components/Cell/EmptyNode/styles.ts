import styled from '@emotion/styled';

interface StyleProps {
  width: number;
  previewMode: boolean;
}

export const EmptyNode = styled.div<any>`
  width: ${(props: StyleProps) => props.width}px;
  height: ${(props: StyleProps) => props.width}px;
  border-radius: 50%;
  background-color: none;
  cursor: ${(props: StyleProps) => (props.previewMode ? 'pointer' : 'move')};
`;
