import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { useDatabase } from '@/contexts/DatabaseContext';
import type { Project } from '@/types/state';
import { v4 as uuidv4 } from 'uuid';
import { formatDuration } from '@/utils/time';

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

const ErrorMessage = styled.p`
  color: ${({ theme }) => theme.colors.error};
  font-size: 0.875rem;
  margin-top: 0.5rem;
`;

const StatsSection = styled.div`
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid ${({ theme }) => theme.colors.border};
`;

const StatsToggle = styled.button`
  background: none;
  border: none;
  color: ${({ theme }) => theme.colors.text};
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  width: 100%;
  text-align: left;
  font-size: 0.9rem;

  &:hover {
    color: ${({ theme }) => theme.colors.primary};
  }
`;

const StatsContent = styled.div<{ isExpanded: boolean }>`
  display: ${({ isExpanded }) => (isExpanded ? 'block' : 'none')};
  padding: 0.5rem;
`;

const StatRow = styled.div`
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
`;

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string) => void;
  initialName?: string;
  title: string;
  existingProjects?: Project[];
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
  existingProjects = [],
}) => {
  const [projectName, setProjectName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    setProjectName(initialName);
    setError(null);
  }, [initialName, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim()) {
      setError('Project name is required');
      return;
    }

    const trimmedName = projectName.trim();
    const isDuplicate = existingProjects.some(
      project => project.name.toLowerCase() === trimmedName.toLowerCase()
    );

    if (isDuplicate) {
      setError('A project with this name already exists');
      return;
    }

    onSubmit(trimmedName);
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
            onChange={e => {
              setProjectName(e.target.value);
              setError(null);
            }}
            autoFocus
            aria-label="Project Name"
            aria-invalid={!!error}
            aria-describedby={error ? 'project-name-error' : undefined}
          />
          {error && (
            <ErrorMessage id="project-name-error" role="alert">
              {error}
            </ErrorMessage>
          )}
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
  const { getAllProjects } = useDatabase();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const fetchedProjects = await getAllProjects();
        const mappedProjects: Project[] = fetchedProjects.map(project => ({
          id: project.id.toString(),
          name: project.name,
          description: project.description || '',
          totalTime: 0,
          sessionCount: 0,
          createdAt: new Date(project.created_at),
          updatedAt: new Date(project.created_at),
        }));
        setProjects(mappedProjects);
      } catch (err) {
        setError('Failed to fetch projects');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProjects();
  }, [getAllProjects]);

  const handleAddSubmit = (name: string) => {
    const newProject: Project = {
      id: uuidv4(),
      name,
      description: '',
      totalTime: 0,
      sessionCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    setProjects(prev => [...prev, newProject]);
    setIsAddModalOpen(false);
  };

  const handleEditSubmit = (name: string) => {
    if (!editingProject) return;
    const updatedProject: Project = {
      ...editingProject,
      name,
      updatedAt: new Date(),
    };
    setProjects(prev =>
      prev.map(project => (project.id === updatedProject.id ? updatedProject : project))
    );
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
    setProjects(prev => prev.filter(project => project.id !== deletingProject.id));
    setIsDeleteModalOpen(false);
    setDeletingProject(null);
  };

  const toggleProjectStats = (projectId: string) => {
    setExpandedProjects(prev => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  };

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>{error}</div>;

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
            <ProjectDate>Created: {project.createdAt.toLocaleDateString()}</ProjectDate>
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
            <StatsSection>
              <StatsToggle
                onClick={() => toggleProjectStats(project.id)}
                aria-expanded={expandedProjects.has(project.id)}
              >
                {expandedProjects.has(project.id) ? 'Hide Stats' : 'Show Stats'}
              </StatsToggle>
              <StatsContent isExpanded={expandedProjects.has(project.id)}>
                <StatRow>
                  <span>Total Time</span>
                  <span>{formatDuration(project.totalTime)}</span>
                </StatRow>
                <StatRow>
                  <span>Average Session</span>
                  <span>
                    {project.sessionCount
                      ? formatDuration((project.totalTime || 0) / project.sessionCount)
                      : 'No sessions'}
                  </span>
                </StatRow>
              </StatsContent>
            </StatsSection>
          </ProjectCard>
        ))}
      </ProjectList>

      <ProjectModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={handleAddSubmit}
        title="Add New Project"
        existingProjects={projects}
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
        existingProjects={projects}
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
