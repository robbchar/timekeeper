import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import TimerControls from './TimerControls';
import { ThemeProvider } from 'styled-components';
import { theme } from '@/styles/theme';

const renderWithTheme = (component: React.ReactNode) => {
  return render(<ThemeProvider theme={theme}>{component}</ThemeProvider>);
};

describe('TimerControls', () => {
  const defaultProps = {
    isSessionActive: false,
    isTimingActive: false,
    elapsedTime: 0,
    onStartTimer: vi.fn(),
    onStopTimer: vi.fn(),
    onStopSession: vi.fn(),
  };

  it('renders without crashing', () => {
    renderWithTheme(<TimerControls {...defaultProps} />);
    expect(screen.getByText('Start Timing')).toBeInTheDocument();
  });

  it('shows correct button text based on timing state', () => {
    const { rerender } = renderWithTheme(<TimerControls {...defaultProps} />);
    expect(screen.getByText('Start Timing')).toBeInTheDocument();

    rerender(
      <ThemeProvider theme={theme}>
        <TimerControls {...defaultProps} isTimingActive={true} />
      </ThemeProvider>
    );
    expect(screen.getByText('Stop Timing')).toBeInTheDocument();
  });

  it('displays formatted time correctly', () => {
    renderWithTheme(<TimerControls {...defaultProps} elapsedTime={3661000} />);
    expect(screen.getByText('01:01:01')).toBeInTheDocument();
  });

  it('calls onStartTimer when clicking start button', () => {
    renderWithTheme(<TimerControls {...defaultProps} isSessionActive={true} />);
    fireEvent.click(screen.getByText('Start Timing'));
    expect(defaultProps.onStartTimer).toHaveBeenCalledTimes(1);
  });

  it('calls onStopTimer when clicking stop button', () => {
    renderWithTheme(
      <TimerControls {...defaultProps} isSessionActive={true} isTimingActive={true} />
    );
    fireEvent.click(screen.getByText('Stop Timing'));
    expect(defaultProps.onStopTimer).toHaveBeenCalledTimes(1);
  });

  it('shows stop session button when session is active', () => {
    renderWithTheme(<TimerControls {...defaultProps} isSessionActive={true} />);
    expect(screen.getByText('Stop Session')).toBeInTheDocument();
  });

  it('hides stop session button when session is not active', () => {
    renderWithTheme(<TimerControls {...defaultProps} isSessionActive={false} />);
    expect(screen.queryByText('Stop Session')).not.toBeInTheDocument();
  });

  it('calls onStopSession when clicking stop session button', () => {
    renderWithTheme(<TimerControls {...defaultProps} isSessionActive={true} />);
    fireEvent.click(screen.getByText('Stop Session'));
    expect(defaultProps.onStopSession).toHaveBeenCalledTimes(1);
  });

  it('disables timer button when session is not active', () => {
    renderWithTheme(<TimerControls {...defaultProps} isSessionActive={false} />);
    const button = screen.getByText('Start Timing');
    expect(button).toBeDisabled();
  });

  it('enables timer button when session is active', () => {
    renderWithTheme(<TimerControls {...defaultProps} isSessionActive={true} />);
    const button = screen.getByText('Start Timing');
    expect(button).not.toBeDisabled();
  });

  it('changes button color based on timing state', () => {
    const { rerender } = renderWithTheme(<TimerControls {...defaultProps} />);
    const button = screen.getByText('Start Timing');
    expect(button).toHaveStyle({ backgroundColor: theme.colors.success });

    rerender(
      <ThemeProvider theme={theme}>
        <TimerControls {...defaultProps} isTimingActive={true} isSessionActive={true} />
      </ThemeProvider>
    );
    expect(button).toHaveStyle({ backgroundColor: theme.colors.error });
  });
});
