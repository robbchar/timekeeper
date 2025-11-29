/**
 * Centralized IPC channel names shared between renderer boundary (preload) and main process handlers.
 *
 * IMPORTANT: Keep string values stable (do not rename channels) to preserve backwards compatibility.
 */
export const IPC_CHANNELS = {
  database: {
    // Project operations
    createProject: 'database:createProject',
    getProject: 'database:getProject',
    getProjects: 'database:getProjects',
    updateProject: 'database:updateProject',
    deleteProject: 'database:deleteProject',

    // Session operations
    createSession: 'database:createSession',
    endSession: 'database:endSession',
    getSessions: 'database:getSessions',
    getSessionsForProject: 'database:getSessionsForProject',
    updateSessionNotes: 'database:updateSessionNotes',
    updateSessionDuration: 'database:updateSessionDuration',
    deleteSession: 'database:deleteSession',

    // Tag operations
    createTag: 'database:createTag',
    getTags: 'database:getTags',
    updateTag: 'database:updateTag',
    deleteTag: 'database:deleteTag',

    // Project–Tag relationship operations
    getTagsForProject: 'database:getTagsForProject',
    setProjectTags: 'database:setProjectTags',

    // Settings operations
    getSetting: 'database:getSetting',
    setSetting: 'database:setSetting',

    // Test helper
    reset: 'database:reset',
  },
} as const;

export type DatabaseIpcChannel = (typeof IPC_CHANNELS.database)[keyof typeof IPC_CHANNELS.database];

export type IpcChannel = DatabaseIpcChannel;
