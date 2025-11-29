import type { Tag, TagDatabase } from '@/types/tag';

export function mapDbTagToTag(dbTag: TagDatabase): Tag {
  return {
    id: dbTag.tagId,
    name: dbTag.name,
    color: dbTag.color,
    createdAt: new Date(dbTag.createdAt),
    updatedAt: new Date(dbTag.updatedAt),
  };
}

export function mapDbTagsToTags(dbTags: readonly TagDatabase[]): Tag[] {
  return dbTags.map(mapDbTagToTag);
}
