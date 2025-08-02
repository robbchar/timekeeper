import React from 'react';
import { AppProvider } from '@/contexts/AppProvider';
import { ThemeProvider } from 'styled-components';
import { theme } from '@/styles/theme';
import { DatabaseProvider } from '@/contexts/DatabaseContext';
import { ProjectsProvider } from '@/contexts/ProjectsContext';
import { HeroUIProvider } from '@heroui/react';

export const TestProviders = ({ children }: { children: React.ReactNode }) => (
  <HeroUIProvider>
    <DatabaseProvider>
      <AppProvider>
        <ProjectsProvider>
          <ThemeProvider theme={theme}>{children}</ThemeProvider>
        </ProjectsProvider>
      </AppProvider>
    </DatabaseProvider>
  </HeroUIProvider>
);
