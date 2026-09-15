import { IPC_CHANNELS } from '@/types/ipcChannels';

/** The slice of `BrowserWindow` the indicator needs. */
export interface OverlayWindow<Icon> {
  setOverlayIcon(overlay: Icon | null, description: string): void;
  isDestroyed(): boolean;
  webContents: unknown;
}

/** The slice of `ipcMain` the indicator needs. */
export interface TimingIndicatorIpc {
  on(channel: string, listener: (event: { sender: unknown }, isTiming: unknown) => void): unknown;
}

export interface TimingIndicatorOptions<Icon> {
  platform: NodeJS.Platform;
  createDotIcon: () => Icon;
}

/** Shows a dot on the window's taskbar icon while its renderer reports the timer is counting. */
export const registerTimingIndicator = <Icon>(
  window: OverlayWindow<Icon>,
  ipc: TimingIndicatorIpc,
  { platform, createDotIcon }: TimingIndicatorOptions<Icon>
): void => {
  // Taskbar overlay icons only exist on Windows.
  if (platform !== 'win32') return;

  let dotIcon: Icon | undefined;

  ipc.on(IPC_CHANNELS.appWindow.setTimingIndicator, (event, isTiming) => {
    if (event.sender !== window.webContents || window.isDestroyed()) return;

    if (isTiming === true) {
      dotIcon ??= createDotIcon();
      window.setOverlayIcon(dotIcon, 'Timer running');
    } else {
      window.setOverlayIcon(null, '');
    }
  });
};
