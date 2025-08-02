import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from '@/App.tsx';
import { AppProvider } from '@/contexts/AppProvider';
import { ThemeProvider } from 'styled-components';
import { theme } from '@/styles/theme';
import { DatabaseProvider } from '@/contexts/DatabaseContext';
import { ProjectsProvider } from '@/contexts/ProjectsContext';
import { HeroUIProvider } from '@heroui/react';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <HeroUIProvider>
        <DatabaseProvider>
          <AppProvider>
            <ProjectsProvider>
              <App />
            </ProjectsProvider>
          </AppProvider>
        </DatabaseProvider>
      </HeroUIProvider>
    </ThemeProvider>
  </StrictMode>
);
