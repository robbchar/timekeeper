/**
 * Centralized IPC channel names.
 *
 * IMPORTANT:
 * - Keep these string values stable (no renames), as they are part of the IPC contract
 *   between Electron (main/preload) and the renderer boundary.
 */
export const IPC_CHANNELS = {
  database: {
    createProject: 'database:createProject',
    updateProject: 'database:updateProject',
    getProjects: 'database:getProjects',
    getProject: 'database:getProject',
    deleteProject: 'database:deleteProject',

    createSession: 'database:createSession',
    endSession: 'database:endSession',
    getSessions: 'database:getSessions',
    getSessionsForProject: 'database:getSessionsForProject',
    updateSessionNotes: 'database:updateSessionNotes',
    updateSessionDuration: 'database:updateSessionDuration',
    deleteSession: 'database:deleteSession',

    createTag: 'database:createTag',
    getTags: 'database:getTags',
    updateTag: 'database:updateTag',
    deleteTag: 'database:deleteTag',

    getTagsForProject: 'database:getTagsForProject',
    setProjectTags: 'database:setProjectTags',

    getSetting: 'database:getSetting',
    setSetting: 'database:setSetting',

    reset: 'database:reset',
  },
} as const;

export type IpcChannel =
  (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS][keyof (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS]];
