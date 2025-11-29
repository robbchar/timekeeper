import type { Tag, TagDatabase } from '@/types/tag';
import { dbTagToTag, dbTagsToTags, tagToDbTag } from './tag-mappers';

describe('tag mappers', () => {
  it('dbTagToTag maps DB row to domain Tag (including Date parsing)', () => {
    const createdAt = new Date('2025-01-02T03:04:05.000Z');
    const updatedAt = new Date('2025-02-03T04:05:06.000Z');

    const dbTag: TagDatabase = {
      tagId: 123,
      name: 'Focus',
      color: '#ff00ff',
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
    };

    const tag = dbTagToTag(dbTag);
    expect(tag).toEqual({
      id: 123,
      name: 'Focus',
      color: '#ff00ff',
      createdAt,
      updatedAt,
    });
  });

  it('dbTagsToTags maps arrays using the same rules', () => {
    const now = new Date('2025-01-02T03:04:05.000Z');
    const dbTags: TagDatabase[] = [
      { tagId: 1, name: 'A', createdAt: now.toISOString(), updatedAt: now.toISOString() },
      {
        tagId: 2,
        name: 'B',
        color: '#000000',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      },
    ];

    const tags = dbTagsToTags(dbTags);
    expect(tags).toHaveLength(2);
    expect(tags[0].id).toBe(1);
    expect(tags[0].createdAt).toBeInstanceOf(Date);
    expect(tags[1].color).toBe('#000000');
  });

  it('tagToDbTag maps domain Tag to DB row shape (including ISO dates)', () => {
    const tag: Tag = {
      id: 7,
      name: 'Inbox',
      color: '#111111',
      createdAt: new Date('2025-03-04T05:06:07.000Z'),
      updatedAt: new Date('2025-04-05T06:07:08.000Z'),
    };

    expect(tagToDbTag(tag)).toEqual({
      tagId: 7,
      name: 'Inbox',
      color: '#111111',
      createdAt: '2025-03-04T05:06:07.000Z',
      updatedAt: '2025-04-05T06:07:08.000Z',
    });
  });
});
