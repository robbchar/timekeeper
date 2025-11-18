import React from 'react';
import { describe, it, expect } from 'vitest';
import App from './App';
import { render } from '@testing-library/react';
import { TestProviders } from '@/test-utils/test-db-context';

describe('App', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <TestProviders>
        <App />
      </TestProviders>
    );
    expect(container).toBeInTheDocument();
  });
});
