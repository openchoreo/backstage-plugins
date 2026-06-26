import styled from '@emotion/styled';

interface HeaderProps {}

const HeaderContainer = styled.div`
  align-items: center;
  color: ${({ theme }) => theme.colors.ON_SURFACE_VARIANT};
  display: flex;
  flex-direction: row;
  font-family: GilmerBold;
  font-size: 16px;
  height: 50px;
  justify-content: space-between;
  min-width: 350px;
  padding-inline: 10px;
  width: calc(100vw - 20px);
`;

export function HeaderWidget(_props: HeaderProps) {
  return <HeaderContainer>Cell Diagram</HeaderContainer>;
}
