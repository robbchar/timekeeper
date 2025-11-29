/**
 * IPC channel names shared across renderer/preload/main.
 *
 * IMPORTANT: Keep strings stable. Do not rename channels without coordinating
 * both sides of the IPC boundary.
 */
export const IPC_CHANNELS = {
  database: {
    // Project operations
    createProject: 'database:createProject',
    getProjects: 'database:getProjects',
    getProject: 'database:getProject',
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
