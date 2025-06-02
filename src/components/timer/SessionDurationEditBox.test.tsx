import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SessionDurationEditBox } from './SessionDurationEditBox';
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('SessionDurationEditBox', () => {
  let onChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onChange = vi.fn();
  });

  it('renders initial value correctly', () => {
    render(<SessionDurationEditBox initialSeconds={3661} onChange={onChange} />);
    expect(screen.getByDisplayValue('01')).toBeInTheDocument(); // hours
    expect(screen.getByDisplayValue('01')).toBeInTheDocument(); // minutes
    expect(screen.getByDisplayValue('01')).toBeInTheDocument(); // seconds
  });

  it('calls onChange when inputs change', async () => {
    render(<SessionDurationEditBox initialSeconds={0} onChange={onChange} />);
    const inputs = screen.getAllByRole('spinbutton');

    await userEvent.clear(inputs[0]);
    await userEvent.type(inputs[0], '02'); // hours

    await userEvent.clear(inputs[1]);
    await userEvent.type(inputs[1], '03'); // minutes

    await userEvent.clear(inputs[2]);
    await userEvent.type(inputs[2], '05'); // seconds

    expect(onChange).toHaveBeenLastCalledWith(2 * 3600 + 3 * 60 + 5);
  });

  it('increments time using arrow buttons', async () => {
    render(<SessionDurationEditBox initialSeconds={0} onChange={onChange} />);
    const arrows = screen.getAllByText('▲');

    await userEvent.click(arrows[0]); // increment hours
    await userEvent.click(arrows[1]); // increment minutes
    await userEvent.click(arrows[2]); // increment seconds

    expect(onChange).toHaveBeenLastCalledWith(1 * 3600 + 1 * 60 + 1);
  });

  it('decrements time using arrow buttons', async () => {
    render(<SessionDurationEditBox initialSeconds={0} onChange={onChange} />);
    const downs = screen.getAllByText('▼');

    await userEvent.click(downs[0]); // wrap to 99
    await userEvent.click(downs[1]); // wrap to 59
    await userEvent.click(downs[2]); // wrap to 59

    expect(onChange).toHaveBeenLastCalledWith(99 * 3600 + 59 * 60 + 59);
  });

  it('prevents invalid input (negative or large numbers)', async () => {
    render(<SessionDurationEditBox initialSeconds={0} onChange={onChange} />);
    const [minutesInput, secondsInput] = screen.getAllByRole('spinbutton');

    await userEvent.clear(minutesInput);
    await userEvent.type(minutesInput, '65'); // larger than 59
    expect(Number(minutesInput.getAttribute('value'))).toBeLessThan(60);

    await userEvent.clear(secondsInput);
    await userEvent.type(secondsInput, '-1'); // negative
    expect(Number(secondsInput.getAttribute('value'))).toBeGreaterThanOrEqual(0);
  });
});
