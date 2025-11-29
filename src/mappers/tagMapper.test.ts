import type { TagDatabase } from '@/types/tag';
import { mapDbTagToTag, mapDbTagsToTags } from './tagMapper';

describe('tagMapper', () => {
  it('maps a TagDatabase row to a Tag', () => {
    const row: TagDatabase = {
      tagId: 123,
      name: 'Deep Work',
      color: '#ff0000',
      createdAt: '2025-01-02T03:04:05.000Z',
      updatedAt: '2025-01-03T03:04:05.000Z',
    };

    const tag = mapDbTagToTag(row);

    expect(tag.id).toBe(123);
    expect(tag.name).toBe('Deep Work');
    expect(tag.color).toBe('#ff0000');
    expect(tag.createdAt).toBeInstanceOf(Date);
    expect(tag.updatedAt).toBeInstanceOf(Date);
    expect(tag.createdAt.toISOString()).toBe('2025-01-02T03:04:05.000Z');
    expect(tag.updatedAt.toISOString()).toBe('2025-01-03T03:04:05.000Z');
  });

  it('maps many TagDatabase rows to Tags', () => {
    const rows: TagDatabase[] = [
      {
        tagId: 1,
        name: 'A',
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
      },
      {
        tagId: 2,
        name: 'B',
        color: '#00ff00',
        createdAt: '2025-01-01T00:00:01.000Z',
        updatedAt: '2025-01-01T00:00:02.000Z',
      },
    ];

    const tags = mapDbTagsToTags(rows);

    expect(tags).toHaveLength(2);
    expect(tags[0].id).toBe(1);
    expect(tags[1].id).toBe(2);
  });
});
