import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, within, waitFor } from '@testing-library/react';
import { render, mockDatabase } from '@/test-utils';
import { ProjectsPage } from './ProjectsPage';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useProjects } from '@/contexts/ProjectsContext';

// Mock the useProjects hook and provider
vi.mock('@/contexts/ProjectsContext', () => {
  const mockProjectsContext: {
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
      mockProjectsContext.projects = dbProjects.map(p => ({
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

  return {
    useProjects: vi.fn().mockReturnValue(mockProjectsContext),
    ProjectsProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

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

describe('ProjectsPage', () => {
  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Reset mock database state
    (mockDatabase.getProjects as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (mockDatabase.createProject as ReturnType<typeof vi.fn>).mockResolvedValue(1);
    (mockDatabase.updateProject as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (mockDatabase.deleteProject as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    // Reset mock database context
    (useDatabase as ReturnType<typeof vi.fn>).mockReturnValue({
      getAllProjects: mockDatabase.getProjects,
      createProject: mockDatabase.createProject,
      updateProject: mockDatabase.updateProject,
      deleteProject: mockDatabase.deleteProject,
    });

    // Reset mock projects context
    const mockProjectsContext = useProjects();
    mockProjectsContext.projects = [];
    mockProjectsContext.isLoading = false;
    mockProjectsContext.error = null;
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
    // Set up the mock projects context with our test projects
    const mockProjectsContext = useProjects();
    mockProjectsContext.projects = [
      {
        id: 1,
        name: 'Project 1',
        description: '',
        totalTime: 0,
        sessionCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 2,
        name: 'Project 2',
        description: '',
        totalTime: 0,
        sessionCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    mockProjectsContext.isLoading = false;
    mockProjectsContext.error = null;

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
    // Start with a clean state - no projects
    const mockProjectsContext = useProjects();
    mockProjectsContext.projects = [];
    mockProjectsContext.isLoading = false;
    mockProjectsContext.error = null;

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
    // Create a new project
    const newProject = {
      id: '1',
      name: 'New Project',
      description: '',
      totalTime: 0,
      sessionCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Mock the useProjects hook to return our project
    (useProjects as ReturnType<typeof vi.fn>).mockReturnValue({
      projects: [newProject],
      isLoading: false,
      error: null,
      refreshProjects: vi.fn().mockResolvedValue(undefined),
    });

    const { debug } = render(<ProjectsPage />);

    // Wait for the new project to appear
    const newProjectTitle = screen.getByText('New Project');
    await waitFor(() => {
      expect(newProjectTitle).toBeInTheDocument();
    });

    // Expand stats
    expect(newProjectTitle).toBeInTheDocument();
    const toggleButton = within(newProjectTitle.parentElement as HTMLElement).getByText(
      /▶ project stats/i
    );
    fireEvent.click(toggleButton);
    debug();
    // Check if zero stats are displayed
    const statsSection = within(newProjectTitle.parentElement as HTMLElement)
      .getByText('Total Time:')
      .closest('[data-testid="stats-section-1"]');
    expect(statsSection).toBeInTheDocument();

    expect(within(statsSection as HTMLElement).getByText('Total Time:')).toBeInTheDocument();
    expect(within(statsSection as HTMLElement).getByText('0s')).toBeInTheDocument();
    expect(within(statsSection as HTMLElement).getByText('Sessions:')).toBeInTheDocument();
    expect(within(statsSection as HTMLElement).getByText('0')).toBeInTheDocument();
  });
});
