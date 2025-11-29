type HandlerFn = (event: unknown, ...args: unknown[]) => unknown;
const handlers = new Map<string, HandlerFn>();

const mockIpcMain = {
  handle: (channel: string, fn: HandlerFn) => {
    handlers.set(channel, fn);
  },
  reset: () => {
    handlers.clear();
  },
  __handlers: handlers,
};

vi.mock('electron', () => ({ ipcMain: mockIpcMain }));

describe('database IPC handlers', () => {
  beforeEach(() => {
    mockIpcMain.reset();
    vi.resetModules();
  });

  it('registers getProject handler', async () => {
    const mod = await import('./database');
    mod.setupDatabaseHandlers();

    expect(mockIpcMain.__handlers.has('database:getProject')).toBe(true);
  });
});
