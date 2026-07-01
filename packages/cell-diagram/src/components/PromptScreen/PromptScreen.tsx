import styled from '@emotion/styled';

const Container = styled.div`
  display: flex;
  align-items: center;
  flex-direction: row;
  justify-content: center;
  height: 100%;
  width: 100%;
  background-image: radial-gradient(
    ${({ theme }) => theme.colors.SURFACE_CONTAINER} 10%,
    transparent 0px
  );
  background-size: 16px 16px;
  background-color: ${({ theme }) => theme.colors.SURFACE_BRIGHT};
`;

const MassageBox = styled.h3`
  color: ${({ theme }) => theme.colors.ON_SURFACE_VARIANT};
  font-family: GilmerRegular;
  font-size: 16px;
  padding: 10px;
`;

export interface PromptScreenProps {
  userMessage: string;
}

export function PromptScreen(props: PromptScreenProps) {
  const { userMessage } = props;

  return (
    <Container>
      <MassageBox>{userMessage}</MassageBox>
    </Container>
  );
}
