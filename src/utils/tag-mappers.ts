import type { Tag, TagDatabase } from '@/types/tag';

/**
 * Convert a `TagDatabase` row (from the DB / IPC layer) into the UI/domain `Tag`.
 */
export const dbTagToTag = (dbTag: TagDatabase): Tag => {
  return {
    id: dbTag.tagId,
    name: dbTag.name,
    color: dbTag.color,
    createdAt: new Date(dbTag.createdAt),
    updatedAt: new Date(dbTag.updatedAt),
  };
};

export const dbTagsToTags = (dbTags: TagDatabase[]): Tag[] => {
  return dbTags.map(dbTagToTag);
};

/**
 * Convert a UI/domain `Tag` into the DB row shape.
 *
 * Note: the DB layer may not require the full row for all operations, but having
 * a single canonical conversion avoids repeating field mapping rules.
 */
export const tagToDbTag = (tag: Tag): TagDatabase => {
  return {
    tagId: tag.id,
    name: tag.name,
    color: tag.color,
    createdAt: tag.createdAt.toISOString(),
    updatedAt: tag.updatedAt.toISOString(),
  };
};
