import type { AppWindowAPI, BeforeCloseHandler } from '@/types/appWindow';
import { IPC_CHANNELS } from '@/types/ipcChannels';

/** The slice of `ipcRenderer` the bridge needs. */
export interface RendererIpc {
  on(channel: string, listener: () => void): unknown;
  send(channel: string): void;
}

/** Builds `window.appWindow`. Reports ready to close only once every registered handler settles. */
export const makeAppWindowShape = (ipc: RendererIpc): AppWindowAPI => {
  const beforeCloseHandlers = new Set<BeforeCloseHandler>();

  ipc.on(IPC_CHANNELS.appWindow.beforeClose, async () => {
    // Failed work must not keep the window open.
    await Promise.allSettled([...beforeCloseHandlers].map(async handler => handler()));
    ipc.send(IPC_CHANNELS.appWindow.readyToClose);
  });

  return {
    onBeforeClose: handler => {
      beforeCloseHandlers.add(handler);
      return () => {
        beforeCloseHandlers.delete(handler);
      };
    },
  };
};
