import { IPC_CHANNELS } from '@/types/ipcChannels';

/** The slice of `BrowserWindow` the handshake needs. */
export interface ClosableWindow {
  on(event: 'close', listener: (event: { preventDefault: () => void }) => void): unknown;
  close(): void;
  isDestroyed(): boolean;
  webContents: { send(channel: string): void };
}

/** The slice of `ipcMain` the handshake needs. */
export interface ReadyToCloseIpc {
  on(channel: string, listener: (event: { sender: unknown }) => void): unknown;
  removeListener(channel: string, listener: (event: { sender: unknown }) => void): unknown;
}

export const CLOSE_HANDSHAKE_TIMEOUT_MS = 2_000;

/**
 * Holds a window open on close until its renderer reports its pending work is saved,
 * or the timeout passes so a hung renderer cannot block quitting.
 */
export const registerCloseHandshake = (
  window: ClosableWindow,
  ipc: ReadyToCloseIpc,
  timeoutMs = CLOSE_HANDSHAKE_TIMEOUT_MS
): void => {
  let isCloseApproved = false;
  let isWaitingForRenderer = false;

  window.on('close', event => {
    if (isCloseApproved) return;

    event.preventDefault();
    if (isWaitingForRenderer) return;
    isWaitingForRenderer = true;

    const approveClose = () => {
      clearTimeout(timeoutId);
      ipc.removeListener(IPC_CHANNELS.appWindow.readyToClose, handleReadyToClose);
      isCloseApproved = true;

      if (!window.isDestroyed()) {
        window.close();
      }
    };

    const handleReadyToClose = (readyEvent: { sender: unknown }) => {
      if (readyEvent.sender === window.webContents) {
        approveClose();
      }
    };

    ipc.on(IPC_CHANNELS.appWindow.readyToClose, handleReadyToClose);
    const timeoutId = setTimeout(approveClose, timeoutMs);

    try {
      window.webContents.send(IPC_CHANNELS.appWindow.beforeClose);
    } catch {
      // The renderer is already gone, so there is nothing to wait for.
      approveClose();
    }
  });
};
