import React from 'react';
import styled from 'styled-components';
import Sidebar from './Sidebar';
import Header from './Header';
import MainContent from './MainContent';
import { useTimingIndicator } from '@/state/hooks/useTimingIndicator';

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

const Layout: React.FC = () => {
  // Layout stays mounted across pages, so the indicator does not depend on the page shown.
  useTimingIndicator();

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
