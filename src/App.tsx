import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import styled from 'styled-components';
import Layout from './components/layout/Layout';

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
            <Route index element={<div>Timer Page</div>} />
            <Route path="projects" element={<div>Projects Page</div>} />
            <Route path="settings" element={<div>Settings Page</div>} />
          </Route>
        </Routes>
      </AppContainer>
    </Router>
  );
}

export default App;
