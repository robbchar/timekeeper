import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import styled from 'styled-components';
import Layout from './components/layout/Layout';
import TimerPage from './components/timer/TimerPage';

const AppContainer = styled.div`
  height: 100vh;
  width: 100vw;
`;

function App() {
  return (
    <Router>
      <AppContainer>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<TimerPage />} />
            <Route path="projects" element={<div>Projects Page</div>} />
            <Route path="settings" element={<div>Settings Page</div>} />
          </Route>
        </Routes>
      </AppContainer>
    </Router>
  );
}

export default App;
