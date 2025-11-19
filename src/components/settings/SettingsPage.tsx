import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { Button, Chip, Input, Select, SelectItem } from '@heroui/react';
import { useDatabase } from '@/contexts/DatabaseContext';
import type { Tag } from '@/types/tag';
import { ConfirmModal } from '@/components/ConfirmModal';

const PageContainer = styled.div`
  padding: 2rem;
  max-width: 800px;
  margin: 0 auto;
`;

const Section = styled.section`
  margin-bottom: 2rem;
`;

const SectionTitle = styled.h2`
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: 1rem;
  color: ${({ theme }) => theme.colors.text.primary};
`;

const TagsContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 1rem;
`;

const NewTagForm = styled.form`
  display: flex;
  gap: 0.75rem;
  align-items: center;
  max-width: 400px;
`;

const EditTagForm = styled.form`
  display: flex;
  gap: 0.75rem;
  align-items: center;
  max-width: 400px;
  margin-top: 1rem;
`;

const COLOR_OPTIONS = [
  { label: 'Blue', value: '#007bff' },
  { label: 'Green', value: '#22c55e' },
  { label: 'Purple', value: '#6366f1' },
  { label: 'Orange', value: '#f97316' },
  { label: 'Pink', value: '#ec4899' },
  { label: 'Gray', value: '#6b7280' },
];

export const SettingsPage: React.FC = () => {
  const { createTag, getAllTags, updateTag, deleteTag } = useDatabase();
  const [isLoading, setIsLoading] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState('');
  const [tags, setTags] = useState<Tag[]>([]);
  const [tagToDelete, setTagToDelete] = useState<Tag | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingColor, setEditingColor] = useState('');

  useEffect(() => {
    const loadTags = async () => {
      setIsLoading(true);
      try {
        const existing = await getAllTags();
        setTags(existing);
      } finally {
        setIsLoading(false);
      }
    };
    void loadTags();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAddTag = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    // prevent duplicate names (case-insensitive)
    if (tags.some(t => t.name.toLowerCase() === trimmed.toLowerCase())) {
      return;
    }
    setIsLoading(true);
    try {
      const created = await createTag(trimmed, color || undefined);
      setTags(prev => [...prev, created]);
      setName('');
      setColor('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteTag = (tag: Tag) => {
    setTagToDelete(tag);
    setIsDeleteModalOpen(true);
  };

  const confirmDeleteTag = async () => {
    if (!tagToDelete) return;
    setIsLoading(true);
    try {
      await deleteTag(tagToDelete.id);
      setTags(prev => prev.filter(t => t.id !== tagToDelete.id));
    } finally {
      setIsLoading(false);
      setIsDeleteModalOpen(false);
      setTagToDelete(null);
    }
  };

  const handleRenameTag = async (id: number, newName: string, newColor?: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setIsLoading(true);
    try {
      const updated = await updateTag(id, trimmed, newColor);
      setTags(prev => prev.map(t => (t.id === updated.id ? updated : t)));
    } finally {
      setIsLoading(false);
    }
  };

  const selectedNewColorKeys =
    color && COLOR_OPTIONS.some(option => option.value === color) ? [color] : [];

  const selectedEditingColorKeys =
    editingColor && COLOR_OPTIONS.some(option => option.value === editingColor)
      ? [editingColor]
      : [];

  return (
    <PageContainer>
      <Section>
        <SectionTitle>Tags</SectionTitle>
        <NewTagForm onSubmit={handleAddTag} role="form">
          <Input
            label="New tag name"
            value={name}
            onChange={e => setName(e.target.value)}
            isDisabled={isLoading}
          />
          <Select
            label="Color"
            selectedKeys={selectedNewColorKeys}
            onChange={e => setColor(e.target.value)}
            isDisabled={isLoading}
            className="min-w-[160px]"
          >
            {COLOR_OPTIONS.map(option => (
              <SelectItem key={option.value}>{option.label}</SelectItem>
            ))}
          </Select>
          <Button type="submit" color="primary" isDisabled={!name.trim() || isLoading}>
            Add Tag
          </Button>
        </NewTagForm>

        <TagsContainer>
          {tags.map(tag => (
            <Chip
              key={tag.id}
              color="default"
              variant="flat"
              className="cursor-pointer"
              style={tag.color ? { backgroundColor: tag.color, color: '#ffffff' } : undefined}
              onClose={() => handleDeleteTag(tag)}
              onClick={() => {
                setEditingTag(tag);
                setEditingName(tag.name);
                setEditingColor(tag.color ?? '');
              }}
            >
              {tag.name}
            </Chip>
          ))}
          {tags.length === 0 && !isLoading && <span>No tags yet. Create one above.</span>}
        </TagsContainer>
        {editingTag && (
          <EditTagForm
            onSubmit={e => {
              e.preventDefault();
              if (!editingTag) return;
              void handleRenameTag(editingTag.id, editingName.trim(), editingColor || undefined);
              setEditingTag(null);
              setEditingName('');
              setEditingColor('');
            }}
          >
            <Input
              label="Rename tag"
              value={editingName}
              onChange={e => setEditingName(e.target.value)}
              isDisabled={isLoading}
              className="min-w-[220px] flex-1"
            />
            <Select
              label="Color"
              selectedKeys={selectedEditingColorKeys}
              onChange={e => setEditingColor(e.target.value)}
              isDisabled={isLoading}
              className="min-w-[160px]"
            >
              {COLOR_OPTIONS.map(option => (
                <SelectItem key={option.value}>{option.label}</SelectItem>
              ))}
            </Select>
            <Button type="submit" color="primary" isDisabled={!editingName.trim() || isLoading}>
              Save
            </Button>
            <Button
              type="button"
              variant="bordered"
              onPress={() => {
                setEditingTag(null);
                setEditingName('');
                setEditingColor('');
              }}
            >
              Cancel
            </Button>
          </EditTagForm>
        )}
      </Section>

      <ConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={confirmDeleteTag}
        title="Delete Tag"
        message={
          tagToDelete
            ? `Are you sure you want to delete the tag "${tagToDelete.name}"?`
            : 'Are you sure you want to delete this tag?'
        }
        cancelLabel="Cancel"
        confirmLabel="Delete"
      />
    </PageContainer>
  );
};
