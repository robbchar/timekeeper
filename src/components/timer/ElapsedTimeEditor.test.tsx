import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { ElapsedTimeEditor } from './ElapsedTimeEditor';

type OnSave = (seconds: number) => void;
type OnCancel = () => void;

describe('ElapsedTimeEditor', () => {
  let user: UserEvent;
  let onSave: ReturnType<typeof vi.fn<OnSave>>;
  let onCancel: ReturnType<typeof vi.fn<OnCancel>>;

  const renderEditor = (initialSeconds = 0) =>
    render(
      <div>
        <ElapsedTimeEditor initialSeconds={initialSeconds} onSave={onSave} onCancel={onCancel} />
        <button type="button">Outside</button>
      </div>
    );

  const setMinutes = async (minutes: string) => {
    await user.tripleClick(screen.getByLabelText('Minutes'));
    await user.keyboard(minutes);
  };

  beforeEach(() => {
    user = userEvent.setup();
    onSave = vi.fn<OnSave>();
    onCancel = vi.fn<OnCancel>();
  });

  it('starts from the time it was opened with', () => {
    renderEditor(3723);

    expect(screen.getByLabelText('Hours')).toHaveValue('01');
    expect(screen.getByLabelText('Minutes')).toHaveValue('02');
    expect(screen.getByLabelText('Seconds')).toHaveValue('03');
  });

  it('puts focus in the hours field when opened', () => {
    renderEditor();

    expect(screen.getByLabelText('Hours')).toHaveFocus();
  });

  it('saves the typed time on Enter', async () => {
    renderEditor();
    await setMinutes('5');

    await user.keyboard('{Enter}');

    expect(onSave).toHaveBeenCalledWith(300);
  });

  it('saves the typed time when focus leaves the editor', async () => {
    renderEditor();
    await setMinutes('5');

    await user.click(screen.getByRole('button', { name: 'Outside' }));

    expect(onSave).toHaveBeenCalledWith(300);
  });

  it('saves the typed time when clicking on nothing in particular', async () => {
    renderEditor();
    await setMinutes('5');

    await user.click(document.body);

    expect(onSave).toHaveBeenCalledWith(300);
  });

  it('keeps editing while focus moves between its fields', async () => {
    renderEditor();

    await user.click(screen.getByLabelText('Seconds'));

    expect(onSave).not.toHaveBeenCalled();
  });

  it('keeps editing while the arrow controls are used', async () => {
    renderEditor();

    const [, minutesUp] = screen.getAllByText('▲');
    await user.click(minutesUp);

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Minutes')).toHaveValue('01');
  });

  it('cancels on Escape without saving', async () => {
    renderEditor();
    await setMinutes('5');

    await user.keyboard('{Escape}');

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('finishes only once when Escape is followed by focus leaving', async () => {
    renderEditor();

    await user.keyboard('{Escape}');
    await user.click(document.body);

    expect(onSave).not.toHaveBeenCalled();
  });

  it('finishes only once when Enter is followed by focus leaving', async () => {
    renderEditor();
    await setMinutes('5');

    await user.keyboard('{Enter}');
    await user.click(document.body);

    expect(onSave).toHaveBeenCalledTimes(1);
  });
});
