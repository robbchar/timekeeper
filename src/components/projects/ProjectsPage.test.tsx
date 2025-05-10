import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
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
    expect(screen.getByRole('heading', { name: 'Projects' })).toBeInTheDocument();
  });

  it('shows add project modal when clicking add button', () => {
    render(<ProjectsPage />, { wrapper });

    const addButton = screen.getByRole('button', { name: /add project/i });
    fireEvent.click(addButton);

    expect(screen.getByRole('heading', { name: 'Add New Project' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /project name/i })).toBeInTheDocument();
  });

  it('adds a new project when submitting the form', () => {
    render(<ProjectsPage />, { wrapper });

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

    // Check if project was added
    expect(screen.getByText('New Test Project')).toBeInTheDocument();
  });

  it('closes modal when clicking cancel', () => {
    render(<ProjectsPage />, { wrapper });

    // Open modal
    const addButton = screen.getByRole('button', { name: /add project/i });
    fireEvent.click(addButton);

    // Click cancel
    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelButton);

    // Check if modal is closed
    expect(screen.queryByRole('heading', { name: 'Add New Project' })).not.toBeInTheDocument();
  });

  it('closes modal when clicking outside', () => {
    render(<ProjectsPage />, { wrapper });

    // Open modal
    const addButton = screen.getByRole('button', { name: /add project/i });
    fireEvent.click(addButton);

    // Click outside modal
    const modal = screen.getByRole('dialog');
    fireEvent.click(modal);

    // Check if modal is closed
    expect(screen.queryByRole('heading', { name: 'Add New Project' })).not.toBeInTheDocument();
  });

  it('shows edit modal when clicking edit button', () => {
    render(<ProjectsPage />, { wrapper });

    // Add a project first
    const addButton = screen.getByRole('button', { name: /add project/i });
    fireEvent.click(addButton);
    const input = screen.getByRole('textbox', { name: /project name/i });
    fireEvent.change(input, { target: { value: 'Test Project' } });
    const form = screen.getByRole('form');
    const submitButton = within(form).getByRole('button', { name: /add project/i });
    fireEvent.click(submitButton);

    // Click edit button
    const editButton = screen.getByRole('button', { name: /edit project/i });
    fireEvent.click(editButton);

    // Check if edit modal is shown
    expect(screen.getByRole('heading', { name: 'Edit Project' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /project name/i })).toHaveValue('Test Project');
  });

  it('updates project when submitting edit form', () => {
    render(<ProjectsPage />, { wrapper });

    // Add a project first
    const addButton = screen.getByRole('button', { name: /add project/i });
    fireEvent.click(addButton);
    const input = screen.getByRole('textbox', { name: /project name/i });
    fireEvent.change(input, { target: { value: 'Test Project' } });
    const form = screen.getByRole('form');
    const submitButton = within(form).getByRole('button', { name: /add project/i });
    fireEvent.click(submitButton);

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

    // Check if project was updated
    expect(screen.getByText('Updated Project')).toBeInTheDocument();
    expect(screen.queryByText('Test Project')).not.toBeInTheDocument();
  });

  it('shows delete confirmation modal when clicking delete button', () => {
    render(<ProjectsPage />, { wrapper });

    // Add a project first
    const addButton = screen.getByRole('button', { name: /add project/i });
    fireEvent.click(addButton);
    const input = screen.getByRole('textbox', { name: /project name/i });
    fireEvent.change(input, { target: { value: 'Test Project' } });
    const form = screen.getByRole('form');
    const submitButton = within(form).getByRole('button', { name: /add project/i });
    fireEvent.click(submitButton);

    // Click delete button
    const deleteButton = screen.getByRole('button', { name: /delete project/i });
    fireEvent.click(deleteButton);

    // Check if confirmation modal is shown
    expect(screen.getByRole('heading', { name: 'Delete Project' })).toBeInTheDocument();
    expect(screen.getByText(/are you sure you want to delete "Test Project"/i)).toBeInTheDocument();
  });

  it('deletes project when confirming deletion', () => {
    render(<ProjectsPage />, { wrapper });

    // Add a project first
    const addButton = screen.getByRole('button', { name: /add project/i });
    fireEvent.click(addButton);
    const input = screen.getByRole('textbox', { name: /project name/i });
    fireEvent.change(input, { target: { value: 'Test Project' } });
    const form = screen.getByRole('form');
    const submitButton = within(form).getByRole('button', { name: /add project/i });
    fireEvent.click(submitButton);

    // Click delete button
    const deleteButton = screen.getByRole('button', { name: /delete project/i });
    fireEvent.click(deleteButton);

    // Confirm deletion
    const confirmButton = screen.getByRole('button', { name: /^delete$/i });
    fireEvent.click(confirmButton);

    // Check if project was deleted
    expect(screen.queryByText('Test Project')).not.toBeInTheDocument();
  });

  it('cancels deletion when clicking cancel', () => {
    render(<ProjectsPage />, { wrapper });

    // Add a project first
    const addButton = screen.getByRole('button', { name: /add project/i });
    fireEvent.click(addButton);
    const input = screen.getByRole('textbox', { name: /project name/i });
    fireEvent.change(input, { target: { value: 'Test Project' } });
    const form = screen.getByRole('form');
    const submitButton = within(form).getByRole('button', { name: /add project/i });
    fireEvent.click(submitButton);

    // Click delete button
    const deleteButton = screen.getByRole('button', { name: /delete project/i });
    fireEvent.click(deleteButton);

    // Click cancel
    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelButton);

    // Check if project still exists
    expect(screen.getByText('Test Project')).toBeInTheDocument();
  });

  it('cancels deletion when clicking outside modal', () => {
    render(<ProjectsPage />, { wrapper });

    // Add a project first
    const addButton = screen.getByRole('button', { name: /add project/i });
    fireEvent.click(addButton);
    const input = screen.getByRole('textbox', { name: /project name/i });
    fireEvent.change(input, { target: { value: 'Test Project' } });
    const form = screen.getByRole('form');
    const submitButton = within(form).getByRole('button', { name: /add project/i });
    fireEvent.click(submitButton);

    // Click delete button
    const deleteButton = screen.getByRole('button', { name: /delete project/i });
    fireEvent.click(deleteButton);

    // Click outside modal
    const modal = screen.getByRole('dialog');
    fireEvent.click(modal);

    // Check if project still exists
    expect(screen.getByText('Test Project')).toBeInTheDocument();
  });

  it('shows error when submitting empty project name', () => {
    render(<ProjectsPage />, { wrapper });

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

  it('shows error when creating project with duplicate name', () => {
    render(<ProjectsPage />, { wrapper });

    // Add first project
    const addButton = screen.getByRole('button', { name: /add project/i });
    fireEvent.click(addButton);
    const input = screen.getByRole('textbox', { name: /project name/i });
    fireEvent.change(input, { target: { value: 'Test Project' } });
    const form = screen.getByRole('form');
    const submitButton = within(form).getByRole('button', { name: /add project/i });
    fireEvent.click(submitButton);

    // Try to add duplicate project
    fireEvent.click(addButton);
    const newInput = screen.getByRole('textbox', { name: /project name/i });
    fireEvent.change(newInput, { target: { value: 'Test Project' } });
    const newForm = screen.getByRole('form');
    const newSubmitButton = within(newForm).getByRole('button', { name: /add project/i });
    fireEvent.click(newSubmitButton);

    // Check for error message
    expect(screen.getByRole('alert')).toHaveTextContent('A project with this name already exists');
  });

  it('allows editing project name to same name', () => {
    render(<ProjectsPage />, { wrapper });

    // Add a project
    const addButton = screen.getByRole('button', { name: /add project/i });
    fireEvent.click(addButton);
    const input = screen.getByRole('textbox', { name: /project name/i });
    fireEvent.change(input, { target: { value: 'Test Project' } });
    const form = screen.getByRole('form');
    const submitButton = within(form).getByRole('button', { name: /add project/i });
    fireEvent.click(submitButton);

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

  it('shows error when editing project to duplicate name', () => {
    render(<ProjectsPage />, { wrapper });

    // Add first project
    const addButton = screen.getByRole('button', { name: /add project/i });
    fireEvent.click(addButton);
    const input = screen.getByRole('textbox', { name: /project name/i });
    fireEvent.change(input, { target: { value: 'Project One' } });
    const form = screen.getByRole('form');
    const submitButton = within(form).getByRole('button', { name: /add project/i });
    fireEvent.click(submitButton);

    // Add second project
    fireEvent.click(addButton);
    const input2 = screen.getByRole('textbox', { name: /project name/i });
    fireEvent.change(input2, { target: { value: 'Project Two' } });
    const form2 = screen.getByRole('form');
    const submitButton2 = within(form2).getByRole('button', { name: /add project/i });
    fireEvent.click(submitButton2);

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
});
