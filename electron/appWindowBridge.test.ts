import { makeAppWindowShape } from './appWindowBridge';
import { IPC_CHANNELS } from '@/types/ipcChannels';

const createFakeRendererIpc = () => {
  const listeners = new Map<string, () => void>();

  return {
    on: vi.fn((channel: string, listener: () => void) => {
      listeners.set(channel, listener);
    }),
    send: vi.fn<(channel: string) => void>(),
    emit: (channel: string) => listeners.get(channel)?.(),
  };
};

const flushPromises = () => new Promise(resolve => setTimeout(resolve, 0));

describe('makeAppWindowShape', () => {
  describe('when the window is about to close', () => {
    it('reports ready straight away when no work is registered', async () => {
      const ipc = createFakeRendererIpc();
      makeAppWindowShape(ipc);

      ipc.emit(IPC_CHANNELS.appWindow.beforeClose);
      await flushPromises();

      expect(ipc.send).toHaveBeenCalledWith(IPC_CHANNELS.appWindow.readyToClose);
    });

    it('waits for registered work before reporting ready', async () => {
      const ipc = createFakeRendererIpc();
      let finishWork!: () => void;
      makeAppWindowShape(ipc).onBeforeClose(
        () =>
          new Promise<void>(resolve => {
            finishWork = resolve;
          })
      );

      ipc.emit(IPC_CHANNELS.appWindow.beforeClose);
      await flushPromises();
      expect(ipc.send).not.toHaveBeenCalled();

      finishWork();
      await flushPromises();
      expect(ipc.send).toHaveBeenCalledWith(IPC_CHANNELS.appWindow.readyToClose);
    });

    it('runs every registered handler', async () => {
      const ipc = createFakeRendererIpc();
      const appWindow = makeAppWindowShape(ipc);
      const saveTime = vi.fn();
      const saveDraft = vi.fn();
      appWindow.onBeforeClose(saveTime);
      appWindow.onBeforeClose(saveDraft);

      ipc.emit(IPC_CHANNELS.appWindow.beforeClose);
      await flushPromises();

      expect(saveTime).toHaveBeenCalledTimes(1);
      expect(saveDraft).toHaveBeenCalledTimes(1);
    });

    it('still reports ready when registered work rejects', async () => {
      const ipc = createFakeRendererIpc();
      makeAppWindowShape(ipc).onBeforeClose(() => Promise.reject(new Error('disk full')));

      ipc.emit(IPC_CHANNELS.appWindow.beforeClose);
      await flushPromises();

      expect(ipc.send).toHaveBeenCalledWith(IPC_CHANNELS.appWindow.readyToClose);
    });

    it('still reports ready when registered work throws', async () => {
      const ipc = createFakeRendererIpc();
      makeAppWindowShape(ipc).onBeforeClose(() => {
        throw new Error('disk full');
      });

      ipc.emit(IPC_CHANNELS.appWindow.beforeClose);
      await flushPromises();

      expect(ipc.send).toHaveBeenCalledWith(IPC_CHANNELS.appWindow.readyToClose);
    });

    it('skips work that has been unregistered', async () => {
      const ipc = createFakeRendererIpc();
      const saveTime = vi.fn();
      const unregister = makeAppWindowShape(ipc).onBeforeClose(saveTime);

      unregister();
      ipc.emit(IPC_CHANNELS.appWindow.beforeClose);
      await flushPromises();

      expect(saveTime).not.toHaveBeenCalled();
    });
  });
});
