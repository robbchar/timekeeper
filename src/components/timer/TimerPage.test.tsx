import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import TimerPage from './TimerPage';
import { TestProviders } from '@/test-utils/test-db-context';

// Create a wrapper that provides all contexts
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <TestProviders>{children}</TestProviders>
);

describe('TimerPage', () => {
  beforeEach(() => {});

  it('renders without crashing', () => {
    render(<TimerPage />, { wrapper: TestWrapper });
    expect(screen.getByTestId('timer-page')).toBeInTheDocument();
  });
});
