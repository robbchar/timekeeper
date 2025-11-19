import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SessionDurationEditBox } from './SessionDurationEditBox';
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('SessionDurationEditBox', () => {
  const onChange = vi.fn();

  beforeEach(() => {
    onChange.mockClear();
  });

  it('renders initial value correctly', () => {
    render(<SessionDurationEditBox initialDuration={3661} onChange={onChange} />);
    const inputs = screen.getAllByDisplayValue('01');
    expect(inputs.length).toBe(3);
  });

  it('calls onChange when inputs change', async () => {
    render(<SessionDurationEditBox initialDuration={0} onChange={onChange} />);
    const inputs = screen.getAllByRole('textbox');

    await userEvent.clear(inputs[0]);
    await userEvent.type(inputs[0], '02'); // hours

    await userEvent.clear(inputs[1]);
    await userEvent.type(inputs[1], '03'); // minutes

    await userEvent.clear(inputs[2]);
    await userEvent.type(inputs[2], '05'); // seconds

    expect(onChange).toHaveBeenLastCalledWith(2 * 3600 + 3 * 60 + 5);
  });

  it('increments time using arrow buttons', async () => {
    render(<SessionDurationEditBox initialDuration={0} onChange={onChange} />);

    // RC no idea why this has to be done it seems as thought userEvent.click
    // is changing the selected elements so they have to be re-selected
    const [up0] = screen.getAllByText('▲');
    await userEvent.click(up0); // increment hours
    const [, up1] = screen.getAllByText('▲');
    await userEvent.click(up1); // increment minutes
    const [, , up2] = screen.getAllByText('▲');
    await userEvent.click(up2); // increment seconds

    expect(onChange).toHaveBeenLastCalledWith(1 * 3600 + 1 * 60 + 1);
  });

  it('decrements time using arrow buttons', async () => {
    render(<SessionDurationEditBox initialDuration={0} onChange={onChange} />);

    // RC no idea why this has to be done it seems as thought userEvent.click
    // is changing the selected elements so they have to be re-selected
    const [down0] = screen.getAllByText('▼');
    await userEvent.click(down0); // wrap to 99
    const [, down1] = screen.getAllByText('▼');
    await userEvent.click(down1); // wrap to 59
    const [, , down2] = screen.getAllByText('▼');
    await userEvent.click(down2); // wrap to 59

    expect(onChange).toHaveBeenCalledTimes(4);
    expect(onChange).toHaveBeenLastCalledWith(99 * 3600 + 59 * 60 + 59);
  });

  it('prevents invalid input (negative or large numbers)', async () => {
    render(<SessionDurationEditBox initialDuration={0} onChange={onChange} />);
    const [minutesInput, secondsInput] = screen.getAllByRole('textbox');

    await userEvent.clear(minutesInput);
    await userEvent.type(minutesInput, '65'); // larger than 59
    await userEvent.clear(secondsInput);
    await userEvent.type(secondsInput, '-1'); // negative

    // Final value should still be a non-negative duration within a sane range
    const lastCall = onChange.mock.calls.at(-1);
    expect(lastCall).toBeTruthy();
    const lastValue = lastCall?.[0] as number;
    expect(lastValue).toBeGreaterThanOrEqual(0);
    expect(lastValue).toBeLessThan(100 * 3600);
  });
});
