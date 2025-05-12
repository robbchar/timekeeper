import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, within, waitFor } from '@testing-library/react';
import { render, mockDatabase } from '@/test-utils';
import { ProjectsPage } from './ProjectsPage';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useProjects } from '@/contexts/ProjectsContext';

// Mock the useDatabase hook
vi.mock('@/contexts/DatabaseContext', () => ({
  useDatabase: vi.fn().mockReturnValue({
    getAllProjects: vi.fn().mockResolvedValue([]),
    createProject: vi.fn().mockResolvedValue(1),
    updateProject: vi.fn().mockResolvedValue(undefined),
    deleteProject: vi.fn().mockResolvedValue(undefined),
  }),
  DatabaseProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock the useProjects hook
vi.mock('@/contexts/ProjectsContext', () => ({
  useProjects: vi.fn().mockReturnValue({
    projects: [],
    isLoading: false,
    error: null,
    refreshProjects: vi.fn().mockResolvedValue(undefined),
  }),
  ProjectsProvider: ({ children }: { children: React.ReactNode }) => {
    const mockContext: {
      projects: Array<{
        id: string;
        name: string;
        description: string;
        totalTime: number;
        sessionCount: number;
        createdAt: Date;
        updatedAt: Date;
      }>;
      isLoading: boolean;
      error: Error | null;
      refreshProjects: () => Promise<unknown>;
    } = {
      projects: [],
      isLoading: false,
      error: null,
      refreshProjects: vi.fn().mockImplementation(async () => {
        const dbProjects = await mockDatabase.getProjects();
        mockContext.projects = dbProjects.map(p => ({
          id: p.id.toString(),
          name: p.name,
          description: p.description || '',
          totalTime: 0,
          sessionCount: 0,
          createdAt: new Date(p.created_at),
          updatedAt: new Date(p.created_at),
        }));
        return dbProjects;
      }),
    };
    return <>{children}</>;
  },
}));

describe('ProjectsPage', () => {
  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();
  });

  it('renders the projects page with title', async () => {
    render(<ProjectsPage />);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Projects' })).toBeInTheDocument();
    });
  });

  it('shows add project modal when clicking add button', async () => {
    render(<ProjectsPage />);
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    const addButton = screen.getByRole('button', { name: /add project/i });
    fireEvent.click(addButton);

    expect(screen.getByRole('heading', { name: 'Add New Project' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /project name/i })).toBeInTheDocument();
  });

  it('adds a new project when submitting the form', async () => {
    // Create a variable to store our projects
    let projects: Array<{ id: number; name: string; description: string; created_at: string }> = [];

    // Set up both database mocks to use the same projects array
    (mockDatabase.getProjects as ReturnType<typeof vi.fn>).mockImplementation(async () => projects);
    (mockDatabase.createProject as ReturnType<typeof vi.fn>).mockImplementation(
      async (name: string) => {
        const newProject = {
          id: 1,
          name,
          description: '',
          created_at: new Date().toISOString(),
        };
        projects = [newProject];
        return newProject.id;
      }
    );

    // Mock the database context to use our mock
    (useDatabase as ReturnType<typeof vi.fn>).mockReturnValue({
      getAllProjects: mockDatabase.getProjects,
      createProject: mockDatabase.createProject,
      updateProject: mockDatabase.updateProject,
      deleteProject: mockDatabase.deleteProject,
    });

    // Mock the ProjectsContext to use our database mock
    const projectsContext: {
      projects: Array<{
        id: string;
        name: string;
        description: string;
        totalTime: number;
        sessionCount: number;
        createdAt: Date;
        updatedAt: Date;
      }>;
      isLoading: boolean;
      error: Error | null;
      refreshProjects: () => Promise<unknown>;
    } = {
      projects: [],
      isLoading: false,
      error: null,
      refreshProjects: vi.fn().mockImplementation(async () => {
        const dbProjects = await mockDatabase.getProjects();
        projectsContext.projects = dbProjects.map(p => ({
          id: p.id.toString(),
          name: p.name,
          description: p.description || '',
          totalTime: 0,
          sessionCount: 0,
          createdAt: new Date(p.created_at),
          updatedAt: new Date(p.created_at),
        }));
        return dbProjects;
      }),
    };

    (useProjects as ReturnType<typeof vi.fn>).mockReturnValue(projectsContext);

    render(<ProjectsPage />);
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    // Open modal
    const addButton = screen.getByRole('button', { name: /add project/i });
    fireEvent.click(addButton);

    // Fill and submit form
    const input = screen.getByRole('textbox', { name: /project name/i });
    fireEvent.change(input, { target: { value: 'New Test Project' } });

    // Find the submit button within the form
    const form = screen.getByRole('form');
    const submitButton = within(form).getByRole('button', { name: /add project/i });
    fireEvent.click(submitButton);

    // Wait for the project to appear
    await waitFor(() => {
      expect(screen.getByText('New Test Project')).toBeInTheDocument();
    });
  });

  it('closes modal when clicking cancel', async () => {
    render(<ProjectsPage />);
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    // Open modal
    const addButton = screen.getByRole('button', { name: /add project/i });
    fireEvent.click(addButton);

    // Click cancel
    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelButton);

    // Check if modal is closed
    expect(screen.queryByRole('heading', { name: 'Add New Project' })).not.toBeInTheDocument();
  });

  it('closes modal when clicking outside', async () => {
    render(<ProjectsPage />);
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    // Open modal
    const addButton = screen.getByRole('button', { name: /add project/i });
    fireEvent.click(addButton);

    // Click outside modal
    const modal = screen.getByRole('dialog');
    fireEvent.click(modal);

    // Check if modal is closed
    expect(screen.queryByRole('heading', { name: 'Add New Project' })).not.toBeInTheDocument();
  });

  it('shows edit modal when clicking edit button', async () => {
    // Create a variable to store our projects
    let projects: Array<{ id: number; name: string; description: string; created_at: string }> = [];

    // Set up both database mocks to use the same projects array
    (mockDatabase.getProjects as ReturnType<typeof vi.fn>).mockImplementation(async () => projects);
    (mockDatabase.createProject as ReturnType<typeof vi.fn>).mockImplementation(
      async (name: string) => {
        const newProject = {
          id: 1,
          name,
          description: '',
          created_at: new Date().toISOString(),
        };
        projects = [newProject];
        return newProject.id;
      }
    );

    // Mock the database context to use our mock
    (useDatabase as ReturnType<typeof vi.fn>).mockReturnValue({
      getAllProjects: mockDatabase.getProjects,
      createProject: mockDatabase.createProject,
      updateProject: mockDatabase.updateProject,
      deleteProject: mockDatabase.deleteProject,
    });

    // Mock the ProjectsContext to use our database mock
    const projectsContext: {
      projects: Array<{
        id: string;
        name: string;
        description: string;
        totalTime: number;
        sessionCount: number;
        createdAt: Date;
        updatedAt: Date;
      }>;
      isLoading: boolean;
      error: Error | null;
      refreshProjects: () => Promise<unknown>;
    } = {
      projects: [],
      isLoading: false,
      error: null,
      refreshProjects: vi.fn().mockImplementation(async () => {
        const dbProjects = await mockDatabase.getProjects();
        projectsContext.projects = dbProjects.map(p => ({
          id: p.id.toString(),
          name: p.name,
          description: p.description || '',
          totalTime: 0,
          sessionCount: 0,
          createdAt: new Date(p.created_at),
          updatedAt: new Date(p.created_at),
        }));
        return dbProjects;
      }),
    };

    (useProjects as ReturnType<typeof vi.fn>).mockReturnValue(projectsContext);

    render(<ProjectsPage />);

    // Wait for loading to finish
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    // Add a project
    const addButton = screen.getByRole('button', { name: /add project/i });
    fireEvent.click(addButton);
    const input = screen.getByRole('textbox', { name: /project name/i });
    fireEvent.change(input, { target: { value: 'Test Project' } });
    const form = screen.getByRole('form');
    const submitButton = within(form).getByRole('button', { name: /add project/i });
    fireEvent.click(submitButton);

    // Wait for the project to appear
    await waitFor(() => {
      expect(screen.getByText('Test Project')).toBeInTheDocument();
    });

    // Click edit button
    const editButton = screen.getByRole('button', { name: /edit project/i });
    fireEvent.click(editButton);

    // Check if edit modal is shown
    expect(screen.getByRole('heading', { name: 'Edit Project' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /project name/i })).toHaveValue('Test Project');
  });

  it('updates project when submitting edit form', async () => {
    // Create a variable to store our projects
    let projects: Array<{ id: number; name: string; description: string; created_at: string }> = [];

    // Set up both database mocks to use the same projects array
    (mockDatabase.getProjects as ReturnType<typeof vi.fn>).mockImplementation(async () => projects);
    (mockDatabase.createProject as ReturnType<typeof vi.fn>).mockImplementation(
      async (name: string) => {
        const newProject = {
          id: 1,
          name,
          description: '',
          created_at: new Date().toISOString(),
        };
        projects = [newProject];
        return newProject.id;
      }
    );
    (mockDatabase.updateProject as ReturnType<typeof vi.fn>).mockImplementation(
      async (id: number, name: string) => {
        const project = projects.find(p => p.id === id);
        if (project) {
          project.name = name;
        }
        return undefined;
      }
    );

    // Mock the database context to use our mock
    (useDatabase as ReturnType<typeof vi.fn>).mockReturnValue({
      getAllProjects: mockDatabase.getProjects,
      createProject: mockDatabase.createProject,
      updateProject: mockDatabase.updateProject,
      deleteProject: mockDatabase.deleteProject,
    });

    // Mock the ProjectsContext to use our database mock
    const projectsContext: {
      projects: Array<{
        id: string;
        name: string;
        description: string;
        totalTime: number;
        sessionCount: number;
        createdAt: Date;
        updatedAt: Date;
      }>;
      isLoading: boolean;
      error: Error | null;
      refreshProjects: () => Promise<unknown>;
    } = {
      projects: [],
      isLoading: false,
      error: null,
      refreshProjects: vi.fn().mockImplementation(async () => {
        const dbProjects = await mockDatabase.getProjects();
        projectsContext.projects = dbProjects.map(p => ({
          id: p.id.toString(),
          name: p.name,
          description: p.description || '',
          totalTime: 0,
          sessionCount: 0,
          createdAt: new Date(p.created_at),
          updatedAt: new Date(p.created_at),
        }));
        return dbProjects;
      }),
    };

    (useProjects as ReturnType<typeof vi.fn>).mockReturnValue(projectsContext);

    render(<ProjectsPage />);

    // Wait for loading to finish
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    // Add a project
    const addButton = screen.getByRole('button', { name: /add project/i });
    fireEvent.click(addButton);
    const input = screen.getByRole('textbox', { name: /project name/i });
    fireEvent.change(input, { target: { value: 'Test Project' } });
    const form = screen.getByRole('form');
    const submitButton = within(form).getByRole('button', { name: /add project/i });
    fireEvent.click(submitButton);

    // Wait for the project to appear
    await waitFor(() => {
      expect(screen.getByText('Test Project')).toBeInTheDocument();
    });

    // Click edit button
    const editButton = screen.getByRole('button', { name: /edit project/i });
    fireEvent.click(editButton);

    // Update project name
    const editInput = screen.getByRole('textbox', { name: /project name/i });
    fireEvent.change(editInput, { target: { value: 'Updated Project' } });

    // Submit edit form
    const editForm = screen.getByRole('form');
    const saveButton = within(editForm).getByRole('button', { name: /save changes/i });
    fireEvent.click(saveButton);

    // Update the mock to return the updated project
    (mockDatabase.getProjects as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      async () => [
        {
          id: 1,
          name: 'Updated Project',
          description: '',
          created_at: new Date().toISOString(),
        },
      ]
    );

    // Check if project was updated
    await waitFor(() => {
      expect(screen.getByText('Updated Project')).toBeInTheDocument();
      expect(screen.queryByText('Test Project')).not.toBeInTheDocument();
    });
  });

  it('shows delete confirmation modal when clicking delete button', async () => {
    // Create a variable to store our projects
    let projects: Array<{ id: number; name: string; description: string; created_at: string }> = [];

    // Set up both database mocks to use the same projects array
    (mockDatabase.getProjects as ReturnType<typeof vi.fn>).mockImplementation(async () => projects);
    (mockDatabase.createProject as ReturnType<typeof vi.fn>).mockImplementation(
      async (name: string) => {
        const newProject = {
          id: 1,
          name,
          description: '',
          created_at: new Date().toISOString(),
        };
        projects = [newProject];
        return newProject.id;
      }
    );

    // Mock the database context to use our mock
    (useDatabase as ReturnType<typeof vi.fn>).mockReturnValue({
      getAllProjects: mockDatabase.getProjects,
      createProject: mockDatabase.createProject,
      updateProject: mockDatabase.updateProject,
      deleteProject: mockDatabase.deleteProject,
    });

    // Mock the ProjectsContext to use our database mock
    const projectsContext: {
      projects: Array<{
        id: string;
        name: string;
        description: string;
        totalTime: number;
        sessionCount: number;
        createdAt: Date;
        updatedAt: Date;
      }>;
      isLoading: boolean;
      error: Error | null;
      refreshProjects: () => Promise<unknown>;
    } = {
      projects: [],
      isLoading: false,
      error: null,
      refreshProjects: vi.fn().mockImplementation(async () => {
        const dbProjects = await mockDatabase.getProjects();
        projectsContext.projects = dbProjects.map(p => ({
          id: p.id.toString(),
          name: p.name,
          description: p.description || '',
          totalTime: 0,
          sessionCount: 0,
          createdAt: new Date(p.created_at),
          updatedAt: new Date(p.created_at),
        }));
        return dbProjects;
      }),
    };

    (useProjects as ReturnType<typeof vi.fn>).mockReturnValue(projectsContext);

    render(<ProjectsPage />);

    // Wait for loading to finish
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    // Add a project
    const addButton = screen.getByRole('button', { name: /add project/i });
    fireEvent.click(addButton);
    const input = screen.getByRole('textbox', { name: /project name/i });
    fireEvent.change(input, { target: { value: 'Test Project' } });
    const form = screen.getByRole('form');
    const submitButton = within(form).getByRole('button', { name: /add project/i });
    fireEvent.click(submitButton);

    // Wait for the project to appear
    await waitFor(() => {
      expect(screen.getByText('Test Project')).toBeInTheDocument();
    });

    // Click delete button
    const deleteButton = screen.getByRole('button', { name: /delete project/i });
    fireEvent.click(deleteButton);

    // Check if confirmation modal is shown
    expect(screen.getByRole('heading', { name: 'Delete Project' })).toBeInTheDocument();
    expect(screen.getByText(/are you sure you want to delete "Test Project"/i)).toBeInTheDocument();
  });

  it('deletes project when confirming deletion', async () => {
    // Create a variable to store our projects
    let projects: Array<{ id: number; name: string; description: string; created_at: string }> = [];

    // Set up the global mockDatabase to use our projects array
    (mockDatabase.getProjects as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      async () => projects
    );
    (mockDatabase.createProject as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      async (name: string) => {
        const newProject = {
          id: 1,
          name,
          description: '',
          created_at: new Date().toISOString(),
        };
        projects = [newProject];
        return { lastInsertRowid: newProject.id, changes: 1 };
      }
    );
    (mockDatabase.deleteProject as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      async (id: number) => {
        projects = projects.filter(p => p.id !== id);
        return { changes: 1 };
      }
    );

    // Mock the database context to use our mock
    (useDatabase as ReturnType<typeof vi.fn>).mockReturnValue({
      getAllProjects: mockDatabase.getProjects,
      createProject: mockDatabase.createProject,
      updateProject: mockDatabase.updateProject,
      deleteProject: mockDatabase.deleteProject,
    });

    // Mock the ProjectsContext to use our database mock
    const projectsContext: {
      projects: Array<{
        id: string;
        name: string;
        description: string;
        totalTime: number;
        sessionCount: number;
        createdAt: Date;
        updatedAt: Date;
      }>;
      isLoading: boolean;
      error: Error | null;
      refreshProjects: () => Promise<unknown>;
    } = {
      projects: [],
      isLoading: false,
      error: null,
      refreshProjects: vi.fn().mockImplementation(async () => {
        const dbProjects = await mockDatabase.getProjects();
        projectsContext.projects = dbProjects.map(p => ({
          id: p.id.toString(),
          name: p.name,
          description: p.description || '',
          totalTime: 0,
          sessionCount: 0,
          createdAt: new Date(p.created_at),
          updatedAt: new Date(p.created_at),
        }));
        return dbProjects;
      }),
    };

    (useProjects as ReturnType<typeof vi.fn>).mockReturnValue(projectsContext);

    // Initial render
    render(<ProjectsPage />);

    // Wait for loading to finish
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    // Add a project
    const addButton = screen.getByRole('button', { name: /add project/i });
    fireEvent.click(addButton);
    const input = screen.getByRole('textbox', { name: /project name/i });
    fireEvent.change(input, { target: { value: 'Test Project' } });
    const form = screen.getByRole('form');
    const submitButton = within(form).getByRole('button', { name: /add project/i });
    fireEvent.click(submitButton);

    // Wait for the project to appear
    await waitFor(() => {
      expect(screen.getByText('Test Project')).toBeInTheDocument();
    });

    // Click delete button
    const deleteButton = screen.getByRole('button', { name: /delete project/i });
    fireEvent.click(deleteButton);

    // Confirm deletion
    const confirmButton = screen.getByRole('button', { name: /^delete$/i });
    fireEvent.click(confirmButton);

    // since we are mocking the db, make sure the mock sends back what the data should be after the delete
    (mockDatabase.getProjects as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      async () => []
    );

    // Wait for the project to be removed from the UI
    await waitFor(
      () => {
        expect(screen.queryByText('Test Project')).not.toBeInTheDocument();
      },
      { timeout: 2000 }
    ); // Increase timeout to give more time for async operations
  });

  it('cancels deletion when clicking cancel', async () => {
    // Create a variable to store our projects
    let projects: Array<{ id: number; name: string; description: string; created_at: string }> = [];

    // Set up both database mocks to use the same projects array
    (mockDatabase.getProjects as ReturnType<typeof vi.fn>).mockImplementation(async () => projects);
    (mockDatabase.createProject as ReturnType<typeof vi.fn>).mockImplementation(
      async (name: string) => {
        const newProject = {
          id: 1,
          name,
          description: '',
          created_at: new Date().toISOString(),
        };
        projects = [newProject];
        return newProject.id;
      }
    );

    // Mock the database context to use our mock
    (useDatabase as ReturnType<typeof vi.fn>).mockReturnValue({
      getAllProjects: mockDatabase.getProjects,
      createProject: mockDatabase.createProject,
      updateProject: mockDatabase.updateProject,
      deleteProject: mockDatabase.deleteProject,
    });

    // Mock the ProjectsContext to use our database mock
    const projectsContext: {
      projects: Array<{
        id: string;
        name: string;
        description: string;
        totalTime: number;
        sessionCount: number;
        createdAt: Date;
        updatedAt: Date;
      }>;
      isLoading: boolean;
      error: Error | null;
      refreshProjects: () => Promise<unknown>;
    } = {
      projects: [],
      isLoading: false,
      error: null,
      refreshProjects: vi.fn().mockImplementation(async () => {
        const dbProjects = await mockDatabase.getProjects();
        projectsContext.projects = dbProjects.map(p => ({
          id: p.id.toString(),
          name: p.name,
          description: p.description || '',
          totalTime: 0,
          sessionCount: 0,
          createdAt: new Date(p.created_at),
          updatedAt: new Date(p.created_at),
        }));
        return dbProjects;
      }),
    };

    (useProjects as ReturnType<typeof vi.fn>).mockReturnValue(projectsContext);

    render(<ProjectsPage />);

    // Wait for loading to finish
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    // Add a project
    const addButton = screen.getByRole('button', { name: /add project/i });
    fireEvent.click(addButton);
    const input = screen.getByRole('textbox', { name: /project name/i });
    fireEvent.change(input, { target: { value: 'Test Project' } });
    const form = screen.getByRole('form');
    const submitButton = within(form).getByRole('button', { name: /add project/i });
    fireEvent.click(submitButton);

    // Wait for the project to appear
    await waitFor(() => {
      expect(screen.getByText('Test Project')).toBeInTheDocument();
    });

    // Click delete button
    const deleteButton = screen.getByRole('button', { name: /delete project/i });
    fireEvent.click(deleteButton);

    // Click cancel
    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelButton);

    // Check if project still exists
    expect(screen.getByText('Test Project')).toBeInTheDocument();
  });

  it('cancels deletion when clicking outside modal', async () => {
    // Create a variable to store our projects
    let projects: Array<{ id: number; name: string; description: string; created_at: string }> = [];

    // Set up both database mocks to use the same projects array
    (mockDatabase.getProjects as ReturnType<typeof vi.fn>).mockImplementation(async () => projects);
    (mockDatabase.createProject as ReturnType<typeof vi.fn>).mockImplementation(
      async (name: string) => {
        const newProject = {
          id: 1,
          name,
          description: '',
          created_at: new Date().toISOString(),
        };
        projects = [newProject];
        return newProject.id;
      }
    );

    // Mock the database context to use our mock
    (useDatabase as ReturnType<typeof vi.fn>).mockReturnValue({
      getAllProjects: mockDatabase.getProjects,
      createProject: mockDatabase.createProject,
      updateProject: mockDatabase.updateProject,
      deleteProject: mockDatabase.deleteProject,
    });

    // Mock the ProjectsContext to use our database mock
    const projectsContext: {
      projects: Array<{
        id: string;
        name: string;
        description: string;
        totalTime: number;
        sessionCount: number;
        createdAt: Date;
        updatedAt: Date;
      }>;
      isLoading: boolean;
      error: Error | null;
      refreshProjects: () => Promise<unknown>;
    } = {
      projects: [],
      isLoading: false,
      error: null,
      refreshProjects: vi.fn().mockImplementation(async () => {
        const dbProjects = await mockDatabase.getProjects();
        projectsContext.projects = dbProjects.map(p => ({
          id: p.id.toString(),
          name: p.name,
          description: p.description || '',
          totalTime: 0,
          sessionCount: 0,
          createdAt: new Date(p.created_at),
          updatedAt: new Date(p.created_at),
        }));
        return dbProjects;
      }),
    };

    (useProjects as ReturnType<typeof vi.fn>).mockReturnValue(projectsContext);

    render(<ProjectsPage />);

    // Wait for loading to finish
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    // Add a project
    const addButton = screen.getByRole('button', { name: /add project/i });
    fireEvent.click(addButton);
    const input = screen.getByRole('textbox', { name: /project name/i });
    fireEvent.change(input, { target: { value: 'Test Project' } });
    const form = screen.getByRole('form');
    const submitButton = within(form).getByRole('button', { name: /add project/i });
    fireEvent.click(submitButton);

    // Wait for the project to appear
    await waitFor(() => {
      expect(screen.getByText('Test Project')).toBeInTheDocument();
    });

    // Click delete button
    const deleteButton = screen.getByRole('button', { name: /delete project/i });
    fireEvent.click(deleteButton);

    // Click outside modal
    const modal = screen.getByRole('dialog');
    fireEvent.click(modal);

    // Check if project still exists
    expect(screen.getByText('Test Project')).toBeInTheDocument();
  });

  it('shows error when submitting empty project name', async () => {
    render(<ProjectsPage />);

    // Wait for loading to finish
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    // Open modal
    const addButton = screen.getByRole('button', { name: /add project/i });
    fireEvent.click(addButton);

    // Submit empty form
    const form = screen.getByRole('form');
    const submitButton = within(form).getByRole('button', { name: /add project/i });
    fireEvent.click(submitButton);

    // Check for error message
    expect(screen.getByRole('alert')).toHaveTextContent('Project name is required');
  });

  it('shows error when creating project with duplicate name', async () => {
    // Create a variable to store our projects
    let projects: Array<{ id: number; name: string; description: string; created_at: string }> = [];

    // Set up both database mocks to use the same projects array
    (mockDatabase.getProjects as ReturnType<typeof vi.fn>).mockImplementation(async () => projects);
    (mockDatabase.createProject as ReturnType<typeof vi.fn>).mockImplementation(
      async (name: string) => {
        // Check for duplicate name
        if (projects.some(p => p.name === name)) {
          throw new Error('A project with this name already exists');
        }
        const newProject = {
          id: projects.length + 1,
          name,
          description: '',
          created_at: new Date().toISOString(),
        };
        projects = [...projects, newProject];
        return newProject.id;
      }
    );

    // Mock the database context to use our mock
    (useDatabase as ReturnType<typeof vi.fn>).mockReturnValue({
      getAllProjects: mockDatabase.getProjects,
      createProject: mockDatabase.createProject,
      updateProject: mockDatabase.updateProject,
      deleteProject: mockDatabase.deleteProject,
    });

    // Mock the ProjectsContext to use our database mock
    const projectsContext: {
      projects: Array<{
        id: string;
        name: string;
        description: string;
        totalTime: number;
        sessionCount: number;
        createdAt: Date;
        updatedAt: Date;
      }>;
      isLoading: boolean;
      error: Error | null;
      refreshProjects: () => Promise<unknown>;
    } = {
      projects: [],
      isLoading: false,
      error: null,
      refreshProjects: vi.fn().mockImplementation(async () => {
        const dbProjects = await mockDatabase.getProjects();
        projectsContext.projects = dbProjects.map(p => ({
          id: p.id.toString(),
          name: p.name,
          description: p.description || '',
          totalTime: 0,
          sessionCount: 0,
          createdAt: new Date(p.created_at),
          updatedAt: new Date(p.created_at),
        }));
        return dbProjects;
      }),
    };

    (useProjects as ReturnType<typeof vi.fn>).mockReturnValue(projectsContext);

    render(<ProjectsPage />);

    // Wait for loading to finish
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    // Add first project
    const addButton = screen.getByRole('button', { name: /add project/i });
    fireEvent.click(addButton);
    const input = screen.getByRole('textbox', { name: /project name/i });
    fireEvent.change(input, { target: { value: 'Test Project' } });
    const form = screen.getByRole('form');
    const submitButton = within(form).getByRole('button', { name: /add project/i });
    fireEvent.click(submitButton);

    // Wait for first project to appear
    await waitFor(() => {
      expect(screen.getByText('Test Project')).toBeInTheDocument();
    });

    // Try to add duplicate project
    fireEvent.click(addButton);
    const newInput = screen.getByRole('textbox', { name: /project name/i });
    fireEvent.change(newInput, { target: { value: 'Test Project' } });
    const newForm = screen.getByRole('form');
    const newSubmitButton = within(newForm).getByRole('button', { name: /add project/i });
    fireEvent.click(newSubmitButton);

    // Check for error message
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'A project with this name already exists'
      );
    });
  });

  it('allows editing project name to same name', async () => {
    // Create a variable to store our projects
    let projects: Array<{ id: number; name: string; description: string; created_at: string }> = [];

    // Set up both database mocks to use the same projects array
    (mockDatabase.getProjects as ReturnType<typeof vi.fn>).mockImplementation(async () => projects);
    (mockDatabase.createProject as ReturnType<typeof vi.fn>).mockImplementation(
      async (name: string) => {
        const newProject = {
          id: 1,
          name,
          description: '',
          created_at: new Date().toISOString(),
        };
        projects = [newProject];
        return newProject.id;
      }
    );

    // Mock the database context to use our mock
    (useDatabase as ReturnType<typeof vi.fn>).mockReturnValue({
      getAllProjects: mockDatabase.getProjects,
      createProject: mockDatabase.createProject,
      updateProject: mockDatabase.updateProject,
      deleteProject: mockDatabase.deleteProject,
    });

    // Mock the ProjectsContext to use our database mock
    const projectsContext: {
      projects: Array<{
        id: string;
        name: string;
        description: string;
        totalTime: number;
        sessionCount: number;
        createdAt: Date;
        updatedAt: Date;
      }>;
      isLoading: boolean;
      error: Error | null;
      refreshProjects: () => Promise<unknown>;
    } = {
      projects: [],
      isLoading: false,
      error: null,
      refreshProjects: vi.fn().mockImplementation(async () => {
        const dbProjects = await mockDatabase.getProjects();
        projectsContext.projects = dbProjects.map(p => ({
          id: p.id.toString(),
          name: p.name,
          description: p.description || '',
          totalTime: 0,
          sessionCount: 0,
          createdAt: new Date(p.created_at),
          updatedAt: new Date(p.created_at),
        }));
        return dbProjects;
      }),
    };

    (useProjects as ReturnType<typeof vi.fn>).mockReturnValue(projectsContext);

    render(<ProjectsPage />);

    // Wait for loading to finish
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    // Add a project
    const addButton = screen.getByRole('button', { name: /add project/i });
    fireEvent.click(addButton);
    const input = screen.getByRole('textbox', { name: /project name/i });
    fireEvent.change(input, { target: { value: 'Test Project' } });
    const form = screen.getByRole('form');
    const submitButton = within(form).getByRole('button', { name: /add project/i });
    fireEvent.click(submitButton);

    // Wait for the project to appear
    await waitFor(() => {
      expect(screen.getByText('Test Project')).toBeInTheDocument();
    });

    // Edit the project
    const editButton = screen.getByRole('button', { name: /edit project/i });
    fireEvent.click(editButton);

    // Submit with same name
    const editForm = screen.getByRole('form');
    const saveButton = within(editForm).getByRole('button', { name: /save changes/i });
    fireEvent.click(saveButton);

    // Check if project still exists
    expect(screen.getByText('Test Project')).toBeInTheDocument();
  });

  it('shows error when editing project to duplicate name', async () => {
    // Create a variable to store our projects
    let projects: Array<{ id: number; name: string; description: string; created_at: string }> = [];

    // Set up both database mocks to use the same projects array
    (mockDatabase.getProjects as ReturnType<typeof vi.fn>).mockImplementation(async () => projects);
    (mockDatabase.createProject as ReturnType<typeof vi.fn>).mockImplementation(
      async (name: string) => {
        const newProject = {
          id: projects.length + 1,
          name,
          description: '',
          created_at: new Date().toISOString(),
        };
        projects = [...projects, newProject];
        return newProject.id;
      }
    );

    // Mock the database context to use our mock
    (useDatabase as ReturnType<typeof vi.fn>).mockReturnValue({
      getAllProjects: mockDatabase.getProjects,
      createProject: mockDatabase.createProject,
      updateProject: mockDatabase.updateProject,
      deleteProject: mockDatabase.deleteProject,
    });

    // Mock the ProjectsContext to use our database mock
    const projectsContext: {
      projects: Array<{
        id: string;
        name: string;
        description: string;
        totalTime: number;
        sessionCount: number;
        createdAt: Date;
        updatedAt: Date;
      }>;
      isLoading: boolean;
      error: Error | null;
      refreshProjects: () => Promise<unknown>;
    } = {
      projects: [],
      isLoading: false,
      error: null,
      refreshProjects: vi.fn().mockImplementation(async () => {
        const dbProjects = await mockDatabase.getProjects();
        projectsContext.projects = dbProjects.map(p => ({
          id: p.id.toString(),
          name: p.name,
          description: p.description || '',
          totalTime: 0,
          sessionCount: 0,
          createdAt: new Date(p.created_at),
          updatedAt: new Date(p.created_at),
        }));
        return dbProjects;
      }),
    };

    (useProjects as ReturnType<typeof vi.fn>).mockReturnValue(projectsContext);

    render(<ProjectsPage />);

    // Wait for loading to finish
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    // Add first project
    const addButton = screen.getByRole('button', { name: /add project/i });
    fireEvent.click(addButton);
    const input = screen.getByRole('textbox', { name: /project name/i });
    fireEvent.change(input, { target: { value: 'Project One' } });
    const form = screen.getByRole('form');
    const submitButton = within(form).getByRole('button', { name: /add project/i });
    fireEvent.click(submitButton);

    // Wait for first project to appear
    await waitFor(() => {
      expect(screen.getByText('Project One')).toBeInTheDocument();
    });

    // Add second project
    fireEvent.click(addButton);
    const input2 = screen.getByRole('textbox', { name: /project name/i });
    fireEvent.change(input2, { target: { value: 'Project Two' } });
    const form2 = screen.getByRole('form');
    const submitButton2 = within(form2).getByRole('button', { name: /add project/i });
    fireEvent.click(submitButton2);

    // Wait for second project to appear
    await waitFor(() => {
      expect(screen.getByText('Project Two')).toBeInTheDocument();
    });

    // Try to edit second project to first project's name
    const editButtons = screen.getAllByRole('button', { name: /edit project/i });
    fireEvent.click(editButtons[1]); // Click edit on second project

    const editForm = screen.getByRole('form');
    const editInput = screen.getByRole('textbox', { name: /project name/i });
    fireEvent.change(editInput, { target: { value: 'Project One' } });
    const saveButton = within(editForm).getByRole('button', { name: /save changes/i });
    fireEvent.click(saveButton);

    // Check for error message
    expect(screen.getByRole('alert')).toHaveTextContent('A project with this name already exists');
  });

  it('fetches projects on mount', async () => {
    // Create a variable to store our projects
    const projects = [
      {
        id: 1,
        name: 'Project 1',
        description: '',
        created_at: new Date().toISOString(),
      },
      {
        id: 2,
        name: 'Project 2',
        description: '',
        created_at: new Date().toISOString(),
      },
    ];

    // Set up both database mocks to use the same projects array
    (mockDatabase.getProjects as ReturnType<typeof vi.fn>).mockResolvedValue(projects);

    // Mock the database context to use our mock
    (useDatabase as ReturnType<typeof vi.fn>).mockReturnValue({
      getAllProjects: mockDatabase.getProjects,
      createProject: mockDatabase.createProject,
      updateProject: mockDatabase.updateProject,
      deleteProject: mockDatabase.deleteProject,
    });

    // Mock the ProjectsContext to use our database mock
    (useProjects as ReturnType<typeof vi.fn>).mockReturnValue({
      projects: projects.map(p => ({
        id: p.id.toString(),
        name: p.name,
        description: p.description || '',
        totalTime: 0,
        sessionCount: 0,
        createdAt: new Date(p.created_at),
        updatedAt: new Date(p.created_at),
      })),
      isLoading: false,
      error: null,
      refreshProjects: vi.fn().mockImplementation(async () => {
        const dbProjects = await mockDatabase.getProjects();
        return dbProjects;
      }),
    });

    render(<ProjectsPage />);

    await waitFor(() => {
      expect(screen.getByText('Project 1')).toBeInTheDocument();
      expect(screen.getByText('Project 2')).toBeInTheDocument();
    });
  });
});

describe('Project Stats', () => {
  it('shows stats when expanded', async () => {
    // Create a variable to store our projects
    let projects: Array<{ id: number; name: string; description: string; created_at: string }> = [];

    // Set up both database mocks to use the same projects array
    (mockDatabase.getProjects as ReturnType<typeof vi.fn>).mockImplementation(async () => projects);
    (mockDatabase.createProject as ReturnType<typeof vi.fn>).mockImplementation(
      async (name: string) => {
        const newProject = {
          id: 1,
          name,
          description: '',
          created_at: new Date().toISOString(),
        };
        projects = [newProject];
        return newProject.id;
      }
    );

    // Mock the database context to use our mock
    (useDatabase as ReturnType<typeof vi.fn>).mockReturnValue({
      getAllProjects: mockDatabase.getProjects,
      createProject: mockDatabase.createProject,
      updateProject: mockDatabase.updateProject,
      deleteProject: mockDatabase.deleteProject,
    });

    // Mock the ProjectsContext to use our database mock
    const projectsContext: {
      projects: Array<{
        id: string;
        name: string;
        description: string;
        totalTime: number;
        sessionCount: number;
        createdAt: Date;
        updatedAt: Date;
      }>;
      isLoading: boolean;
      error: Error | null;
      refreshProjects: () => Promise<unknown>;
    } = {
      projects: [],
      isLoading: false,
      error: null,
      refreshProjects: vi.fn().mockImplementation(async () => {
        const dbProjects = await mockDatabase.getProjects();
        projectsContext.projects = dbProjects.map(p => ({
          id: p.id.toString(),
          name: p.name,
          description: p.description || '',
          totalTime: 0,
          sessionCount: 0,
          createdAt: new Date(p.created_at),
          updatedAt: new Date(p.created_at),
        }));
        return dbProjects;
      }),
    };

    (useProjects as ReturnType<typeof vi.fn>).mockReturnValue(projectsContext);

    render(<ProjectsPage />);

    // Wait for loading to finish
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    // Add a project first
    const addButton = screen.getByRole('button', { name: /add project/i });
    fireEvent.click(addButton);

    // Fill in the form
    fireEvent.change(screen.getByLabelText(/project name/i), {
      target: { value: 'Test Project2' },
    });

    // Submit the form
    const form = screen.getByRole('form');
    const submitButton = within(form).getByRole('button', { name: /add project/i });
    fireEvent.click(submitButton);

    // Wait for the form to close
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Add New Project' })).not.toBeInTheDocument();
    });

    // Wait for the project to appear and the form to be gone
    await waitFor(() => {
      expect(screen.getByText('Test Project2')).toBeInTheDocument();
      expect(screen.queryByRole('form')).not.toBeInTheDocument();
    });

    // Find the Test Project card and get the toggle button within it
    const testProjectCard = screen.getByText('Test Project2').closest('div');
    if (!testProjectCard) {
      throw new Error('Test Project card not found');
    }
    const toggleButton = within(testProjectCard).getByRole('button', {
      name: /project stats/i,
    });
    expect(toggleButton).toHaveTextContent('▶ Project Stats');

    fireEvent.click(toggleButton);
    expect(toggleButton).toHaveTextContent('▼ Project Stats');

    // Check if stats are displayed
    expect(within(testProjectCard).getByText('Total Time:')).toBeInTheDocument();
    expect(within(testProjectCard).getByText('0s')).toBeInTheDocument();
    expect(within(testProjectCard).getByText('Sessions:')).toBeInTheDocument();
    expect(within(testProjectCard).getByText('0')).toBeInTheDocument();
  });

  it('hides stats when collapsed', async () => {
    // Create a variable to store our projects
    let projects: Array<{ id: number; name: string; description: string; created_at: string }> = [];

    // Set up both database mocks to use the same projects array
    (mockDatabase.getProjects as ReturnType<typeof vi.fn>).mockImplementation(async () => projects);
    (mockDatabase.createProject as ReturnType<typeof vi.fn>).mockImplementation(
      async (name: string) => {
        const newProject = {
          id: 1,
          name,
          description: '',
          created_at: new Date().toISOString(),
        };
        projects = [newProject];
        return newProject.id;
      }
    );

    // Mock the database context to use our mock
    (useDatabase as ReturnType<typeof vi.fn>).mockReturnValue({
      getAllProjects: mockDatabase.getProjects,
      createProject: mockDatabase.createProject,
      updateProject: mockDatabase.updateProject,
      deleteProject: mockDatabase.deleteProject,
    });

    // Mock the ProjectsContext to use our database mock
    const projectsContext: {
      projects: Array<{
        id: string;
        name: string;
        description: string;
        totalTime: number;
        sessionCount: number;
        createdAt: Date;
        updatedAt: Date;
      }>;
      isLoading: boolean;
      error: Error | null;
      refreshProjects: () => Promise<unknown>;
    } = {
      projects: [],
      isLoading: false,
      error: null,
      refreshProjects: vi.fn().mockImplementation(async () => {
        const dbProjects = await mockDatabase.getProjects();
        projectsContext.projects = dbProjects.map(p => ({
          id: p.id.toString(),
          name: p.name,
          description: p.description || '',
          totalTime: 0,
          sessionCount: 0,
          createdAt: new Date(p.created_at),
          updatedAt: new Date(p.created_at),
        }));
        return dbProjects;
      }),
    };

    (useProjects as ReturnType<typeof vi.fn>).mockReturnValue(projectsContext);

    render(<ProjectsPage />);

    // Wait for loading to finish
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    // Add a project first
    const addButton = screen.getByRole('button', { name: /add project/i });
    fireEvent.click(addButton);

    // Fill in the form
    fireEvent.change(screen.getByLabelText(/project name/i), {
      target: { value: 'Test Project2' },
    });

    // Submit the form
    const form = screen.getByRole('form');
    const submitButton = within(form).getByRole('button', { name: /add project/i });
    fireEvent.click(submitButton);

    // Wait for the form to close
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Add New Project' })).not.toBeInTheDocument();
    });

    // Wait for the project to appear and the form to be gone
    await waitFor(() => {
      expect(screen.getByText('Test Project2')).toBeInTheDocument();
      expect(screen.queryByRole('form')).not.toBeInTheDocument();
    });

    // Find and click the stats toggle button
    const projectCard = screen.getByText('Test Project2').closest('div');
    if (!projectCard) {
      throw new Error('Test Project card not found');
    }
    const toggleButton = within(projectCard).getByRole('button', { name: /project stats/i });

    // Check initial state (collapsed)
    expect(toggleButton).toHaveTextContent('▶ Project Stats');

    // Click to expand
    fireEvent.click(toggleButton);
    expect(toggleButton).toHaveTextContent('▼ Project Stats');

    // Click to collapse
    fireEvent.click(toggleButton);
    expect(toggleButton).toHaveTextContent('▶ Project Stats');
  });

  it('shows zero time for new projects', async () => {
    // Mock the useProjects hook to return a new project
    (useProjects as ReturnType<typeof vi.fn>).mockReturnValue({
      projects: [
        {
          id: '1',
          name: 'New Project',
          description: '',
          totalTime: 0,
          sessionCount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      isLoading: false,
      error: null,
      refreshProjects: vi.fn().mockResolvedValue(undefined),
    });

    render(<ProjectsPage />);

    // Wait for the new project to appear
    await waitFor(() => {
      expect(screen.getByText('New Project')).toBeInTheDocument();
    });

    // Expand stats
    const newProjectCard = screen.getByText('New Project').closest('.sc-jMpmlX');
    if (!newProjectCard) {
      throw new Error('New Project card not found');
    }
    const toggleButton = within(newProjectCard as HTMLElement).getByText(/project stats/i);
    fireEvent.click(toggleButton);

    // Check if zero stats are displayed
    const statsSection = within(newProjectCard as HTMLElement)
      .getByText('Total Time:')
      .closest('.sc-hLyRwt');
    if (!statsSection) {
      throw new Error('Stats section not found');
    }

    expect(within(statsSection as HTMLElement).getByText('Total Time:')).toBeInTheDocument();
    expect(within(statsSection as HTMLElement).getByText('0s')).toBeInTheDocument();
    expect(within(statsSection as HTMLElement).getByText('Sessions:')).toBeInTheDocument();
    expect(within(statsSection as HTMLElement).getByText('0')).toBeInTheDocument();
  });
});
