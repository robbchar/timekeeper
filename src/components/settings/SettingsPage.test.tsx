import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SettingsPage } from './SettingsPage';
import type { DatabaseContextType } from '@/contexts/DatabaseContext';
import { HeroUIProvider } from '@heroui/react';
import { ThemeProvider } from 'styled-components';
import { theme } from '@/styles/theme';

let mockDatabase: DatabaseContextType;

vi.mock('@/contexts/DatabaseContext', () => ({
  useDatabase: () => mockDatabase,
}));

describe('SettingsPage', () => {
  beforeEach(() => {
    mockDatabase = {
      // Projects (unused)
      createProject: vi.fn(),
      getProject: vi.fn(),
      getAllProjects: vi.fn(),
      deleteProject: vi.fn(),
      updateProject: vi.fn(),
      // Sessions (unused)
      createSession: vi.fn(),
      endSession: vi.fn(),
      updateSessionNotes: vi.fn(),
      updateSessionDuration: vi.fn(),
      getSessions: vi.fn(),
      getSessionsForProject: vi.fn(),
      deleteSession: vi.fn(),
      // Tags
      createTag: vi.fn(),
      getAllTags: vi.fn(),
      updateTag: vi.fn(),
      deleteTag: vi.fn(),
      // Settings (unused)
      getSetting: vi.fn(),
      setSetting: vi.fn(),
    };

    // Default: no tags loaded
    (mockDatabase.getAllTags as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (mockDatabase.createTag as ReturnType<typeof vi.fn>).mockImplementation(
      async (name: string, color?: string) => ({
        id: 1,
        name,
        color,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    );
    (mockDatabase.updateTag as ReturnType<typeof vi.fn>).mockImplementation(
      async (id: number, name: string, color?: string) => ({
        id,
        name,
        color,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    );
    (mockDatabase.deleteTag as ReturnType<typeof vi.fn>).mockResolvedValue({
      changes: 1,
    });
  });

  const renderSettings = () =>
    render(
      <HeroUIProvider>
        <ThemeProvider theme={theme}>
          <SettingsPage />
        </ThemeProvider>
      </HeroUIProvider>
    );

  it('loads and displays existing tags', async () => {
    (mockDatabase.getAllTags as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      {
        id: 1,
        name: 'Existing',
        color: '#007bff',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    renderSettings();

    await waitFor(() => expect(screen.getByRole('heading', { name: /tags/i })).toBeInTheDocument());

    expect(screen.getByText('Existing')).toBeInTheDocument();
  });

  it('creates a new tag with selected color', async () => {
    renderSettings();

    const nameInput = screen.getByLabelText(/new tag name/i);
    fireEvent.change(nameInput, { target: { value: 'Feature' } });

    const form = screen.getByRole('form');
    fireEvent.submit(form);

    await waitFor(() => {
      expect(mockDatabase.createTag).toHaveBeenCalledWith('Feature', undefined);
      expect(screen.getByText('Feature')).toBeInTheDocument();
    });
  });

  it('does not create duplicate tag names (case insensitive)', async () => {
    (mockDatabase.getAllTags as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      {
        id: 1,
        name: 'Feature',
        color: '#007bff',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    renderSettings();

    await waitFor(() => expect(screen.getByText('Feature')).toBeInTheDocument());

    const nameInput = screen.getByLabelText(/new tag name/i);
    fireEvent.change(nameInput, { target: { value: 'feature' } });

    const addButton = screen.getByRole('button', { name: /add tag/i });
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(mockDatabase.createTag).not.toHaveBeenCalled();
    });
  });

  it('opens delete confirmation and deletes a tag', async () => {
    (mockDatabase.getAllTags as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      {
        id: 1,
        name: 'Cleanup',
        color: '#6b7280',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    renderSettings();
    await waitFor(() => expect(screen.getByText('Cleanup')).toBeInTheDocument());

    // click close icon on chip (role button with label "close chip")
    const deleteButton = screen.getByRole('button', { name: /close chip/i });
    fireEvent.click(deleteButton);

    expect(
      screen.getByText(/are you sure you want to delete the tag "Cleanup"/i)
    ).toBeInTheDocument();

    const confirmButton = screen.getByRole('button', { name: /delete/i });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(mockDatabase.deleteTag).toHaveBeenCalledWith(1);
      expect(screen.queryByText('Cleanup')).not.toBeInTheDocument();
    });
  });

  it('opens edit form when clicking a tag and saves changes', async () => {
    (mockDatabase.getAllTags as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      {
        id: 1,
        name: 'Old',
        color: '#6b7280',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    renderSettings();
    await waitFor(() => expect(screen.getByText('Old')).toBeInTheDocument());

    // click chip to start editing
    const chip = screen.getByText('Old');
    fireEvent.click(chip);

    const renameInput = screen.getByLabelText(/rename tag/i);
    fireEvent.change(renameInput, { target: { value: 'New Name' } });

    const saveButton = screen.getByRole('button', { name: /save/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockDatabase.updateTag).toHaveBeenCalledWith(1, 'New Name', '#6b7280');
      expect(screen.getByText('New Name')).toBeInTheDocument();
    });

    // edit form should disappear after save
    expect(screen.queryByLabelText(/rename tag/i)).not.toBeInTheDocument();
  });
});
