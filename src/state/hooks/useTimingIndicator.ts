import { useContext, useEffect } from 'react';
import { AppContext } from '@/contexts/AppContext';

/** Mirrors whether the current session is timing onto the taskbar indicator. */
export const useTimingIndicator = (): void => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useTimingIndicator must be used within an AppProvider');

  const isTiming = context.state.sessions.currentSession?.status === 'active';

  useEffect(() => {
    window.appWindow.setTimingIndicator(isTiming);
  }, [isTiming]);
};
