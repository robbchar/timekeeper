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

  it('pauses timer when pause button is clicked', () => {
    render(<TimerPage />);

    // Start the timer
    fireEvent.click(screen.getByText('Start'));

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // Pause the timer
    fireEvent.click(screen.getByText('Pause'));

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // Time should not have changed
    expect(screen.getByText('00:00:01')).toBeInTheDocument();
  });

  it('resumes timer when start button is clicked after pause', () => {
    render(<TimerPage />);

    // Start the timer
    fireEvent.click(screen.getByText('Start'));

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // Pause the timer
    fireEvent.click(screen.getByText('Pause'));

    // Resume the timer
    fireEvent.click(screen.getByText('Start'));

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // Time should have increased
    expect(screen.getByText('00:00:02')).toBeInTheDocument();
  });
});
