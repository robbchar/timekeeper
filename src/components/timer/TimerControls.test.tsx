import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
    onElapsedTimeEdited: vi.fn(),
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
    renderWithTheme(<TimerControls {...defaultProps} elapsedTime={3661} />);
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

  describe('editing the elapsed time', () => {
    const pausedProps = { ...defaultProps, isSessionActive: true, elapsedTime: 90 };

    const setMinutes = async (user: ReturnType<typeof userEvent.setup>, minutes: string) => {
      await user.tripleClick(screen.getByLabelText('Minutes'));
      await user.keyboard(minutes);
    };

    it('offers the clock for editing while paused', () => {
      renderWithTheme(<TimerControls {...pausedProps} />);

      expect(screen.getByRole('button', { name: 'Edit elapsed time' })).toHaveTextContent(
        '00:01:30'
      );
    });

    it('does not offer the clock for editing while timing', () => {
      renderWithTheme(<TimerControls {...pausedProps} isTimingActive={true} />);

      expect(screen.queryByRole('button', { name: 'Edit elapsed time' })).not.toBeInTheDocument();
      expect(screen.getByText('00:01:30')).toBeInTheDocument();
    });

    it('does not offer the clock for editing without a session', () => {
      renderWithTheme(<TimerControls {...pausedProps} isSessionActive={false} />);

      expect(screen.queryByRole('button', { name: 'Edit elapsed time' })).not.toBeInTheDocument();
    });

    it('opens the editor at the current time', async () => {
      const user = userEvent.setup();
      renderWithTheme(<TimerControls {...pausedProps} />);

      await user.click(screen.getByRole('button', { name: 'Edit elapsed time' }));

      expect(screen.getByLabelText('Minutes')).toHaveValue('01');
      expect(screen.getByLabelText('Seconds')).toHaveValue('30');
    });

    it('reports the saved time and closes the editor', async () => {
      const user = userEvent.setup();
      const onElapsedTimeEdited = vi.fn();
      renderWithTheme(<TimerControls {...pausedProps} onElapsedTimeEdited={onElapsedTimeEdited} />);

      await user.click(screen.getByRole('button', { name: 'Edit elapsed time' }));
      await setMinutes(user, '5');
      await user.keyboard('{Enter}');

      expect(onElapsedTimeEdited).toHaveBeenCalledWith(330);
      expect(screen.queryByLabelText('Minutes')).not.toBeInTheDocument();
    });

    it('does not report a time that did not change', async () => {
      const user = userEvent.setup();
      const onElapsedTimeEdited = vi.fn();
      renderWithTheme(<TimerControls {...pausedProps} onElapsedTimeEdited={onElapsedTimeEdited} />);

      await user.click(screen.getByRole('button', { name: 'Edit elapsed time' }));
      await user.keyboard('{Enter}');

      expect(onElapsedTimeEdited).not.toHaveBeenCalled();
    });

    it('closes the editor without reporting when cancelled', async () => {
      const user = userEvent.setup();
      const onElapsedTimeEdited = vi.fn();
      renderWithTheme(<TimerControls {...pausedProps} onElapsedTimeEdited={onElapsedTimeEdited} />);

      await user.click(screen.getByRole('button', { name: 'Edit elapsed time' }));
      await setMinutes(user, '5');
      await user.keyboard('{Escape}');

      expect(onElapsedTimeEdited).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Edit elapsed time' })).toHaveTextContent(
        '00:01:30'
      );
    });
  });
});
