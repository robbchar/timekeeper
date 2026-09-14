import { makeAppWindowShape } from '../../electron/appWindowBridge';
import { IPC_CHANNELS } from '@/types/ipcChannels';

/** A real `window.appWindow` bridge wired to an in-memory stand-in for the main process. */
export const createTestAppWindow = () => {
  let beforeCloseListener: (() => void) | undefined;
  let reportReadyToClose: (() => void) | undefined;

  const bridge = makeAppWindowShape({
    on: (channel, listener) => {
      if (channel === IPC_CHANNELS.appWindow.beforeClose) beforeCloseListener = listener;
    },
    send: channel => {
      if (channel === IPC_CHANNELS.appWindow.readyToClose) reportReadyToClose?.();
    },
  });

  /** Asks the renderer to finish up, as the main process does; resolves once it reports ready. */
  const requestClose = () =>
    new Promise<void>(resolve => {
      if (!beforeCloseListener) {
        throw new Error('The bridge never subscribed to the before-close channel');
      }
      reportReadyToClose = resolve;
      beforeCloseListener();
    });

  return { bridge, requestClose };
};
