import React from 'react';
import { render, renderHook } from '@testing-library/react';
import { AppProvider } from './state/context/AppContext';
import { ThemeProvider } from 'styled-components';
import { theme } from './styles/theme';
import type { AppContextType } from './state/context/AppContext';
import { useAppContext } from './state/context/AppContext';

const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  return (
    <AppProvider>
      <ThemeProvider theme={theme}>{children}</ThemeProvider>
    </AppProvider>
  );
};

const customRender = (ui: React.ReactElement, options = {}) =>
  render(ui, { wrapper: AllTheProviders, ...options });

// Helper to get the AppContext from a rendered component
const getAppContext = (): AppContextType => {
  const { result } = renderHook(() => useAppContext(), {
    wrapper: AllTheProviders,
  });
  return result.current;
};

export * from '@testing-library/react';
export { customRender as render, getAppContext };
