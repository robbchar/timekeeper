/** Work to finish before the window closes, such as saving elapsed time. */
export type BeforeCloseHandler = () => Promise<void> | void;

/** Window-level API exposed to the renderer as `window.appWindow` by `electron/preload.ts`. */
export interface AppWindowAPI {
  /** Registers work the main process waits for before closing; returns a function that unregisters it. */
  onBeforeClose: (handler: BeforeCloseHandler) => () => void;
  /** Shows or clears the taskbar indicator that the timer is counting. */
  setTimingIndicator: (isTiming: boolean) => void;
}

declare global {
  interface Window {
    appWindow: AppWindowAPI;
  }
}
