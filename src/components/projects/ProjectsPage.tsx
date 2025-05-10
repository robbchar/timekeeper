import React, { useState } from 'react';
import styled from 'styled-components';
import { useProjects } from '@/state/hooks/useAppState';
import type { Project } from '@/types/state';
import { v4 as uuidv4 } from 'uuid';

const PageContainer = styled.div`
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
`;

const Title = styled.h1`
  color: ${({ theme }) => theme.colors.text.primary};
  font-size: 1.875rem;
  font-weight: 600;
`;

const AddButton = styled.button`
  background: ${({ theme }) => theme.colors.primary};
  color: white;
  padding: 0.75rem 1.5rem;
  border-radius: 0.375rem;
  font-weight: 500;
  transition: background-color 0.2s;

  &:hover {
    background: ${({ theme }) => theme.colors.primaryHover};
  }
`;

const ProjectList = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.5rem;
`;

const ProjectCard = styled.div`
  background: ${({ theme }) => theme.colors.background.secondary};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 0.5rem;
  padding: 1.5rem;
  transition: all 0.2s ease-in-out;

  &:hover {
    transform: translateY(-2px);
    box-shadow:
      0 4px 6px -1px rgba(0, 0, 0, 0.1),
      0 2px 4px -1px rgba(0, 0, 0, 0.06);
  }
`;

const ProjectName = styled.h3`
  color: ${({ theme }) => theme.colors.text.primary};
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
`;

const ProjectDate = styled.p`
  color: ${({ theme }) => theme.colors.text.secondary};
  font-size: 0.875rem;
`;

const ProjectActions = styled.div`
  display: flex;
  gap: 0.5rem;
  margin-top: 1rem;
`;

const IconButton = styled.button`
  background: transparent;
  border: none;
  color: ${({ theme }) => theme.colors.text.secondary};
  padding: 0.5rem;
  cursor: pointer;
  border-radius: 0.25rem;
  transition: all 0.2s;

  &:hover {
    background: ${({ theme }) => theme.colors.background.primary};
    color: ${({ theme }) => theme.colors.text.primary};
  }
`;

const DeleteButton = styled(IconButton)`
  color: ${({ theme }) => theme.colors.error};

  &:hover {
    color: ${({ theme }) => theme.colors.errorHover};
  }
`;

const Modal = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
`;

const ModalContent = styled.div`
  background: ${({ theme }) => theme.colors.background.primary};
  padding: 2rem;
  border-radius: 0.5rem;
  width: 100%;
  max-width: 500px;
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const Input = styled.input`
  padding: 0.75rem;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 0.375rem;
  font-size: 1rem;

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.primary};
  }
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  margin-top: 1rem;
`;

const Button = styled.button<{ variant?: 'primary' | 'secondary' }>`
  padding: 0.75rem 1.5rem;
  border-radius: 0.375rem;
  font-weight: 500;
  transition: all 0.2s;

  ${({ variant, theme }) =>
    variant === 'primary'
      ? `
    background: ${theme.colors.primary};
    color: white;
    &:hover {
      background: ${theme.colors.primaryHover};
    }
  `
      : `
    background: transparent;
    color: ${theme.colors.text.primary};
    border: 1px solid ${theme.colors.border};
    &:hover {
      background: ${theme.colors.background.secondary};
    }
  `}
`;

const ModalTitle = styled.h2`
  color: ${({ theme }) => theme.colors.text.primary};
  margin-bottom: 1.5rem;
  font-size: 1.5rem;
`;

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string) => void;
  initialName?: string;
  title: string;
}

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
}) => {
  if (!isOpen) return null;

  return (
    <Modal onClick={onClose} role="dialog" aria-modal="true">
      <ModalContent onClick={e => e.stopPropagation()}>
        <ModalTitle>{title}</ModalTitle>
        <p>{message}</p>
        <ButtonGroup>
          <Button type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" variant="primary" onClick={onConfirm}>
            Delete
          </Button>
        </ButtonGroup>
      </ModalContent>
    </Modal>
  );
};

const ProjectModal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialName = '',
  title,
}) => {
  const [projectName, setProjectName] = useState(initialName);

  React.useEffect(() => {
    setProjectName(initialName);
  }, [initialName]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim()) return;
    onSubmit(projectName.trim());
  };

  if (!isOpen) return null;

  return (
    <Modal onClick={onClose} role="dialog" aria-modal="true">
      <ModalContent onClick={e => e.stopPropagation()}>
        <Form onSubmit={handleSubmit} role="form">
          <ModalTitle>{title}</ModalTitle>
          <Input
            type="text"
            placeholder="Project Name"
            value={projectName}
            onChange={e => setProjectName(e.target.value)}
            autoFocus
            aria-label="Project Name"
          />
          <ButtonGroup>
            <Button type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              {title === 'Add New Project' ? 'Add Project' : 'Save Changes'}
            </Button>
          </ButtonGroup>
        </Form>
      </ModalContent>
    </Modal>
  );
};

export const ProjectsPage: React.FC = () => {
  const { projects, addProject, updateProject, deleteProject } = useProjects();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);

  const handleAddSubmit = (name: string) => {
    const newProject: Project = {
      id: uuidv4(),
      name,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    addProject(newProject);
    setIsAddModalOpen(false);
  };

  const handleEditSubmit = (name: string) => {
    if (!editingProject) return;

    const updatedProject: Project = {
      ...editingProject,
      name,
      updatedAt: new Date(),
    };

    updateProject(updatedProject);
    setIsEditModalOpen(false);
    setEditingProject(null);
  };

  const handleEditClick = (project: Project) => {
    setEditingProject(project);
    setIsEditModalOpen(true);
  };

  const handleDeleteClick = (project: Project) => {
    setDeletingProject(project);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (!deletingProject) return;
    deleteProject(deletingProject.id);
    setIsDeleteModalOpen(false);
    setDeletingProject(null);
  };

  return (
    <PageContainer>
      <Header>
        <Title>Projects</Title>
        <AddButton onClick={() => setIsAddModalOpen(true)}>Add Project</AddButton>
      </Header>

      <ProjectList>
        {projects.map((project: Project) => (
          <ProjectCard key={project.id}>
            <ProjectName>{project.name}</ProjectName>
            <ProjectDate>Created: {new Date(project.createdAt).toLocaleDateString()}</ProjectDate>
            <ProjectActions>
              <IconButton
                onClick={() => handleEditClick(project)}
                title="Edit Project"
                aria-label="Edit Project"
              >
                ✏️
              </IconButton>
              <DeleteButton
                onClick={() => handleDeleteClick(project)}
                title="Delete Project"
                aria-label="Delete Project"
              >
                🗑️
              </DeleteButton>
            </ProjectActions>
          </ProjectCard>
        ))}
      </ProjectList>

      <ProjectModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={handleAddSubmit}
        title="Add New Project"
      />

      <ProjectModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingProject(null);
        }}
        onSubmit={handleEditSubmit}
        initialName={editingProject?.name}
        title="Edit Project"
      />

      <ConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setDeletingProject(null);
        }}
        onConfirm={handleDeleteConfirm}
        title="Delete Project"
        message={`Are you sure you want to delete "${deletingProject?.name}"? This action cannot be undone.`}
      />
    </PageContainer>
  );
};
