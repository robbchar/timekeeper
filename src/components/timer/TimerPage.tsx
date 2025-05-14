import styled from 'styled-components';
import SessionControls from '../SessionControls';
import React from 'react';

const PageContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2rem;
  padding: 2rem;
  max-width: 800px;
  margin: 0 auto;
`;

const TimerPage = () => {
  return (
    <PageContainer>
      <SessionControls />
    </PageContainer>
  );
};

export default TimerPage;
