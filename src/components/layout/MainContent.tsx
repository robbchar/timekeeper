import React from 'react';
import { Outlet } from 'react-router-dom';
import styled from 'styled-components';

const MainContainer = styled.main`
  flex: 1;
  padding: 1.5rem;
  background-color: white;
  overflow-y: auto;
`;

const MainContent: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  return <MainContainer>{children ? children : <Outlet />}</MainContainer>;
};

export default MainContent;
