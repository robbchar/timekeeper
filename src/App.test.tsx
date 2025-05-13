import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from './test-utils';
import App from './App';

describe('App', () => {
  it('renders without crashing', () => {
    const { container } = render(<App />);
    expect(container).toBeInTheDocument();
  });
});
