import { Outlet } from 'react-router-dom';
import styled from 'styled-components';

const MainContainer = styled.main`
  flex: 1;
  padding: 1.5rem;
  background-color: white;
  overflow-y: auto;
`;

const MainContent = () => {
  return (
    <MainContainer>
      <Outlet />
    </MainContainer>
  );
};

export default MainContent;
