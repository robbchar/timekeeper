import React, { act } from 'react';
import { AppProvider } from '@/contexts/AppProvider';
import { DatabaseProvider } from '@/contexts/DatabaseContext';
import { ProjectsProvider } from '@/contexts/ProjectsContext';
import { ThemeProvider } from 'styled-components';
import { HeroUIProvider } from '@heroui/react';
import { theme } from '@/styles/theme';

// Create a wrapper that provides all contexts
export const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  return (
    <HeroUIProvider>
      <AppProvider>
        <DatabaseProvider>
          <ProjectsProvider>
            <ThemeProvider theme={theme}>{children}</ThemeProvider>
          </ProjectsProvider>
        </DatabaseProvider>
      </AppProvider>
    </HeroUIProvider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export async function actAsync<T>(fn: () => Promise<T>): Promise<T> {
  let result: T;
  await act(async () => {
    result = await fn();
  });
  // @ts-expect-error TS doesn't realize we initialized it
  return result;
}
