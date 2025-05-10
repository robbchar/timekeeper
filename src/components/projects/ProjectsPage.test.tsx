import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProjectsPage } from './ProjectsPage';
import { AppProvider } from '@/state/context/AppContext';
import { ThemeProvider } from 'styled-components';
import { theme } from '@/styles/theme';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AppProvider>
    <ThemeProvider theme={theme}>{children}</ThemeProvider>
  </AppProvider>
);

describe('ProjectsPage', () => {
  it('renders the projects page with title', () => {
    render(<ProjectsPage />, { wrapper });
    expect(screen.getByText('Projects')).toBeInTheDocument();
  });

  it('shows add project modal when clicking add button', () => {
    render(<ProjectsPage />, { wrapper });

    const addButton = screen.getByText('Add Project');
    fireEvent.click(addButton);

    expect(screen.getByText('Add New Project')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Project Name')).toBeInTheDocument();
  });

  it('adds a new project when submitting the form', () => {
    render(<ProjectsPage />, { wrapper });

    // Open modal
    const addButton = screen.getByText('Add Project');
    fireEvent.click(addButton);

    // Fill and submit form
    const input = screen.getByPlaceholderText('Project Name');
    fireEvent.change(input, { target: { value: 'New Test Project' } });

    const submitButton = screen.getByText('Add Project');
    fireEvent.click(submitButton);

    // Check if project was added
    expect(screen.getByText('New Test Project')).toBeInTheDocument();
  });

  it('closes modal when clicking cancel', () => {
    render(<ProjectsPage />, { wrapper });

    // Open modal
    const addButton = screen.getByText('Add Project');
    fireEvent.click(addButton);

    // Click cancel
    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    // Check if modal is closed
    expect(screen.queryByText('Add New Project')).not.toBeInTheDocument();
  });

  it('closes modal when clicking outside', () => {
    render(<ProjectsPage />, { wrapper });

    // Open modal
    const addButton = screen.getByText('Add Project');
    fireEvent.click(addButton);

    // Click outside modal
    const modal = screen.getByRole('dialog');
    fireEvent.click(modal);

    // Check if modal is closed
    expect(screen.queryByText('Add New Project')).not.toBeInTheDocument();
  });

  it('shows edit modal when clicking edit button', () => {
    render(<ProjectsPage />, { wrapper });

    // Add a project first
    const addButton = screen.getByText('Add Project');
    fireEvent.click(addButton);
    const input = screen.getByPlaceholderText('Project Name');
    fireEvent.change(input, { target: { value: 'Test Project' } });
    const submitButton = screen.getByText('Add Project');
    fireEvent.click(submitButton);

    // Click edit button
    const editButton = screen.getByTitle('Edit Project');
    fireEvent.click(editButton);

    // Check if edit modal is shown
    expect(screen.getByText('Edit Project')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Test Project')).toBeInTheDocument();
  });

  it('updates project when submitting edit form', () => {
    render(<ProjectsPage />, { wrapper });

    // Add a project first
    const addButton = screen.getByText('Add Project');
    fireEvent.click(addButton);
    const input = screen.getByPlaceholderText('Project Name');
    fireEvent.change(input, { target: { value: 'Test Project' } });
    const submitButton = screen.getByText('Add Project');
    fireEvent.click(submitButton);

    // Click edit button
    const editButton = screen.getByTitle('Edit Project');
    fireEvent.click(editButton);

    // Update project name
    const editInput = screen.getByDisplayValue('Test Project');
    fireEvent.change(editInput, { target: { value: 'Updated Project' } });

    // Submit edit form
    const saveButton = screen.getByText('Save Changes');
    fireEvent.click(saveButton);

    // Check if project was updated
    expect(screen.getByText('Updated Project')).toBeInTheDocument();
    expect(screen.queryByText('Test Project')).not.toBeInTheDocument();
  });
});
