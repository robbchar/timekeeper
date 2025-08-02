type HandlerFn = (event: unknown, ...args: unknown[]) => unknown;

const handlers = new Map<string, HandlerFn>();

export const mockIpcMain = {
  handle: (channel: string, fn: HandlerFn) => {
    handlers.set(channel, fn);
  },

  __invoke: async (channel: string, ...args: unknown[]) => {
    const handler = handlers.get(channel);
    if (!handler) {
      console.error('No handler for', channel);
      throw new Error(`No ipcMain handler registered for "${channel}"`);
    }
    return await handler({} as unknown, ...args);
  },

  __handlers: handlers,

  reset: () => {
    handlers.clear();
  },
};
