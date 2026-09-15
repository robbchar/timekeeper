import { registerTimingIndicator } from './timingIndicator';
import { IPC_CHANNELS } from '@/types/ipcChannels';

type IndicatorListener = (event: { sender: unknown }, isTiming: unknown) => void;

const DOT_ICON = { description: 'red dot' };

const setup = (platform: NodeJS.Platform = 'win32') => {
  const listeners = new Map<string, IndicatorListener>();
  const ipc = {
    on: vi.fn((channel: string, listener: IndicatorListener) => {
      listeners.set(channel, listener);
    }),
  };
  const window = {
    webContents: { id: 'timer window' },
    isDestroyed: vi.fn(() => false),
    setOverlayIcon: vi.fn<(overlay: typeof DOT_ICON | null, description: string) => void>(),
  };
  const createDotIcon = vi.fn(() => DOT_ICON);

  registerTimingIndicator(window, ipc, { platform, createDotIcon });

  const report = (isTiming: unknown, sender: unknown = window.webContents) => {
    listeners.get(IPC_CHANNELS.appWindow.setTimingIndicator)?.({ sender }, isTiming);
  };

  return { window, createDotIcon, report };
};

describe('registerTimingIndicator', () => {
  it('shows the dot while the renderer reports timing', () => {
    const { window, report } = setup();

    report(true);

    expect(window.setOverlayIcon).toHaveBeenCalledWith(DOT_ICON, 'Timer running');
  });

  it('clears the dot when timing stops', () => {
    const { window, report } = setup();

    report(true);
    report(false);

    expect(window.setOverlayIcon).toHaveBeenLastCalledWith(null, '');
  });

  it('treats anything other than true as not timing', () => {
    const { window, report } = setup();

    report('yes');

    expect(window.setOverlayIcon).toHaveBeenCalledWith(null, '');
  });

  it('builds the dot image only once', () => {
    const { createDotIcon, report } = setup();

    report(true);
    report(false);
    report(true);

    expect(createDotIcon).toHaveBeenCalledTimes(1);
  });

  it('ignores reports from another window', () => {
    const { window, report } = setup();

    report(true, { id: 'another window' });

    expect(window.setOverlayIcon).not.toHaveBeenCalled();
  });

  it('ignores reports once the window is gone', () => {
    const { window, report } = setup();
    window.isDestroyed.mockReturnValue(true);

    report(true);

    expect(window.setOverlayIcon).not.toHaveBeenCalled();
  });

  it('does nothing outside Windows, where taskbar overlays do not exist', () => {
    const { window, createDotIcon, report } = setup('darwin');

    report(true);

    expect(window.setOverlayIcon).not.toHaveBeenCalled();
    expect(createDotIcon).not.toHaveBeenCalled();
  });
});
