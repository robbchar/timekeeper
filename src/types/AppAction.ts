import { AppState, ActionType, Settings } from '@/types/state';
import { ProjectAction } from '@/types/project';
import { SessionAction } from '@/types/session';
import { TagAction } from '@/types/tag';

export type AppAction =
  | ProjectAction
  | SessionAction
  | TagAction
  | { type: ActionType.UPDATE_SETTINGS; payload: Partial<Settings> }
  | { type: ActionType.TOGGLE_THEME }
  | { type: ActionType.SET_ERROR; payload: string | undefined }
  | { type: ActionType.SET_CURRENT_PROJECT; payload: string }
  | { type: ActionType.SET_LOADING; payload: boolean }
  | { type: ActionType.SET_ERROR; payload: string | undefined }
  | { type: ActionType.CLEAR_ERROR }
  | { type: ActionType.RESTORE_STATE; payload: AppState };
