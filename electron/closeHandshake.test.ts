import { registerCloseHandshake } from './closeHandshake';
import { IPC_CHANNELS } from '@/types/ipcChannels';

type CloseEvent = { preventDefault: ReturnType<typeof vi.fn> };
type ReadyListener = (event: { sender: unknown }) => void;

const TIMEOUT_MS = 500;

const createFakeWindow = () => {
  let closeListener: ((event: CloseEvent) => void) | undefined;
  const closeEvents: CloseEvent[] = [];

  const requestClose = () => {
    const event = { preventDefault: vi.fn() };
    closeEvents.push(event);
    closeListener?.(event);
    return event;
  };

  const window = {
    webContents: { send: vi.fn<(channel: string) => void>() },
    on: vi.fn((_event: 'close', listener: (event: CloseEvent) => void) => {
      closeListener = listener;
    }),
    isDestroyed: vi.fn(() => false),
    // Electron emits 'close' again when a window is closed programmatically.
    close: vi.fn(() => {
      requestClose();
    }),
  };

  return { window, requestClose, closeEvents };
};

const createFakeIpcMain = () => {
  const listenersByChannel = new Map<string, Set<ReadyListener>>();
  const listenersFor = (channel: string) => {
    if (!listenersByChannel.has(channel)) listenersByChannel.set(channel, new Set());
    return listenersByChannel.get(channel)!;
  };

  return {
    on: vi.fn((channel: string, listener: ReadyListener) => {
      listenersFor(channel).add(listener);
    }),
    removeListener: vi.fn((channel: string, listener: ReadyListener) => {
      listenersFor(channel).delete(listener);
    }),
    reportReady: (sender: unknown) => {
      listenersFor(IPC_CHANNELS.appWindow.readyToClose).forEach(listener => listener({ sender }));
    },
  };
};

describe('registerCloseHandshake', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const setup = () => {
    const fakeWindow = createFakeWindow();
    const ipc = createFakeIpcMain();
    registerCloseHandshake(fakeWindow.window, ipc, TIMEOUT_MS);
    return { ...fakeWindow, ipc };
  };

  it('holds the window open when a close is requested', () => {
    const { window, requestClose } = setup();

    const event = requestClose();

    expect(event.preventDefault).toHaveBeenCalled();
    expect(window.close).not.toHaveBeenCalled();
  });

  it('asks the renderer to finish its pending work', () => {
    const { window, requestClose } = setup();

    requestClose();

    expect(window.webContents.send).toHaveBeenCalledWith(IPC_CHANNELS.appWindow.beforeClose);
  });

  it('closes once the renderer reports ready', () => {
    const { window, requestClose, ipc } = setup();

    requestClose();
    ipc.reportReady(window.webContents);

    expect(window.close).toHaveBeenCalledTimes(1);
  });

  it('lets the approved close through', () => {
    const { window, requestClose, closeEvents, ipc } = setup();

    requestClose();
    ipc.reportReady(window.webContents);

    expect(closeEvents).toHaveLength(2);
    expect(closeEvents[1].preventDefault).not.toHaveBeenCalled();
  });

  it('ignores a ready report from another window', () => {
    const { window, requestClose, ipc } = setup();

    requestClose();
    ipc.reportReady({ id: 'another window' });

    expect(window.close).not.toHaveBeenCalled();
  });

  it('asks only once when close is requested again while waiting', () => {
    const { window, requestClose } = setup();

    requestClose();
    const secondEvent = requestClose();

    expect(window.webContents.send).toHaveBeenCalledTimes(1);
    expect(secondEvent.preventDefault).toHaveBeenCalled();
  });

  it('closes anyway when the renderer does not answer in time', () => {
    const { window, requestClose } = setup();

    requestClose();
    vi.advanceTimersByTime(TIMEOUT_MS - 1);
    expect(window.close).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(window.close).toHaveBeenCalledTimes(1);
  });

  it('closes only once when the renderer answers after the timeout', () => {
    const { window, requestClose, ipc } = setup();

    requestClose();
    vi.advanceTimersByTime(TIMEOUT_MS);
    ipc.reportReady(window.webContents);

    expect(window.close).toHaveBeenCalledTimes(1);
  });

  it('does not wait for the timeout after the renderer answers', () => {
    const { window, requestClose, ipc } = setup();

    requestClose();
    ipc.reportReady(window.webContents);
    vi.advanceTimersByTime(TIMEOUT_MS);

    expect(window.close).toHaveBeenCalledTimes(1);
  });

  it('closes straight away when the renderer cannot be reached', () => {
    const { window, requestClose } = setup();
    window.webContents.send.mockImplementation(() => {
      throw new Error('Object has been destroyed');
    });

    requestClose();

    expect(window.close).toHaveBeenCalledTimes(1);
  });

  it('does not close a window that is already gone', () => {
    const { window, requestClose } = setup();

    requestClose();
    window.isDestroyed.mockReturnValue(true);
    vi.advanceTimersByTime(TIMEOUT_MS);

    expect(window.close).not.toHaveBeenCalled();
  });
});
