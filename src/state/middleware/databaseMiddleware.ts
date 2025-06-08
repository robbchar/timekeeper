import type { Action } from '@/types/state';
import type { Project, Tag, Settings } from '@/types/state';
import { ActionType } from '@/types/state';
import { useDatabase } from '@/contexts/DatabaseContext';

export const createDatabaseMiddleware = (database: ReturnType<typeof useDatabase>) => {
  return async (action: Action) => {
    try {
      switch (action.type) {
        case ActionType.ADD_PROJECT: {
          const project = action.payload as Project;
          if (!project?.name) return;
          await database.createProject(project.name, project.description, project.color);
          break;
        }

        case ActionType.UPDATE_PROJECT: {
          const project = action.payload as Project;
          if (!project?.id || !project?.name) return;
          await database.updateProject(project.id, project.name);
          break;
        }

        case ActionType.DELETE_PROJECT: {
          const id = Number(action.payload);
          if (isNaN(id)) return;
          await database.deleteProject(id);
          break;
        }

        case ActionType.ADD_TAG: {
          const tag = action.payload as Tag;
          if (!tag?.name) return;
          await database.createTag(tag.name, tag.color);
          break;
        }

        case ActionType.UPDATE_TAG: {
          const tag = action.payload as Tag;
          if (!tag?.id || !tag?.name) return;
          await database.updateTag(tag.id, tag.name, tag.color);
          break;
        }

        case ActionType.DELETE_TAG: {
          const id = Number(action.payload);
          if (isNaN(id)) return;
          await database.deleteTag(id);
          break;
        }

        case ActionType.UPDATE_SETTINGS: {
          const settings = action.payload as Partial<Settings>;
          if (!settings) return;
          for (const [key, value] of Object.entries(settings)) {
            await database.setSetting(key, JSON.stringify(value));
          }
          break;
        }
      }
    } catch (error) {
      console.error('Database middleware error:', error);
      // We could dispatch an error action here if needed
      throw error;
    }
  };
};
