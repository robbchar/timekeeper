import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import TimerPage from './TimerPage';
import { AllTheProviders } from '@/test-utils';

// Create a wrapper that provides all contexts
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <AllTheProviders>{children}</AllTheProviders>
);

describe('TimerPage', () => {
  beforeEach(() => {});

  it('renders without crashing', () => {
    render(<TimerPage />, { wrapper: TestWrapper });
    expect(screen.getByTestId('timer-page')).toBeInTheDocument();
  });
});
