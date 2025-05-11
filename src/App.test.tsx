import { describe, it, expect } from 'vitest';
import { render } from './test-utils';
import App from './App';
import { DatabaseProvider } from '@/contexts/DatabaseContext';

describe('App', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <DatabaseProvider>
        <App />
      </DatabaseProvider>
    );
    expect(container).toBeInTheDocument();
  });
});
