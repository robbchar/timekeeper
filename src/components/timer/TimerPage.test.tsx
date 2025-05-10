import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TimerPage from './TimerPage';

describe('TimerPage', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('displays initial time as 00:00:00', () => {
    render(<TimerPage />);
    expect(screen.getByText('00:00:00')).toBeInTheDocument();
  });

  it('starts timer when start button is clicked', () => {
    render(<TimerPage />);

    fireEvent.click(screen.getByText('Start'));

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByText('00:00:01')).toBeInTheDocument();
  });

  it('stops timer when stop button is clicked', () => {
    render(<TimerPage />);

    // Start the timer
    fireEvent.click(screen.getByText('Start'));

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // Stop the timer
    fireEvent.click(screen.getByText('Stop'));

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // Time should not have changed
    expect(screen.getByText('00:00:01')).toBeInTheDocument();
  });

  it('shows start and resume buttons when timer is stopped', () => {
    render(<TimerPage />);

    // Initially shows Start button
    expect(screen.getByText('Start')).toBeInTheDocument();
    expect(screen.getByText('Resume')).toBeInTheDocument();

    // Start the timer
    fireEvent.click(screen.getByText('Start'));

    // Shows Stop button
    expect(screen.getByText('Stop')).toBeInTheDocument();

    // Stop the timer
    fireEvent.click(screen.getByText('Stop'));

    // Shows Start and Resume buttons again
    expect(screen.getByText('Start')).toBeInTheDocument();
    expect(screen.getByText('Resume')).toBeInTheDocument();
  });
});
