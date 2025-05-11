import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { AppProvider } from './state/context/AppContext';
import { ThemeProvider } from 'styled-components';
import { theme } from './styles/theme';
import { DatabaseProvider } from './contexts/DatabaseContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProvider>
      <DatabaseProvider>
        <ThemeProvider theme={theme}>
          <App />
        </ThemeProvider>
      </DatabaseProvider>
    </AppProvider>
  </StrictMode>
);
