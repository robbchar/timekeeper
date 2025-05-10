import styled from 'styled-components';
import Sidebar from './Sidebar';
import Header from './Header';
import MainContent from './MainContent';

const LayoutContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
`;

const ContentWrapper = styled.div`
  display: flex;
  flex: 1;
  overflow: hidden;
`;

const Layout = () => {
  return (
    <LayoutContainer>
      <Header />
      <ContentWrapper>
        <Sidebar />
        <MainContent />
      </ContentWrapper>
    </LayoutContainer>
  );
};

export default Layout;
