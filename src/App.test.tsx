import React from 'react';
import { describe, it, expect } from 'vitest';
import App from './App';
import { render } from '@testing-library/react';

describe('App', () => {
  it('renders without crashing', () => {
    const { container } = render(<App />);
    expect(container).toBeInTheDocument();
  });
});
