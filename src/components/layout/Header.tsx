import React from 'react';
import styled from 'styled-components';

const HeaderContainer = styled.header`
  height: 60px;
  background-color: white;
  border-bottom: 1px solid #e0e0e0;
  padding: 0 1.5rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const HeaderText = styled.div`
  font-size: 1.25rem;
  font-weight: 500;
  color: #333;
`;

const Header = () => {
  return (
    <HeaderContainer>
      <HeaderText>Time Keeper</HeaderText>
    </HeaderContainer>
  );
};

export default Header;
