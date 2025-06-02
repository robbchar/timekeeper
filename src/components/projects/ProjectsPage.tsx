import React, { useState } from 'react';
import styled from 'styled-components';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useProjects } from '@/contexts/ProjectsContext';
import type { Project } from '@/types/project';
import { formatDuration } from '@/utils/time';
import { Button } from '@heroui/react';
import { ConfirmModal } from '@/components/ConfirmModal';

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

const ProjectList = styled.div`
  display: grid;
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

const StatsContent = styled.div<{ $isExpanded: boolean }>`
  display: ${({ $isExpanded }) => ($isExpanded ? 'block' : 'none')};
  padding: 0.5rem;
`;

const StatRow = styled.div`
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
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
  existingProjects?: Project[];
}

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
            <Button type="button" onPress={onClose} color="primary">
              Cancel
            </Button>
            <Button type="submit" color="primary">
              {title === 'Add New Project' ? 'Add Project' : 'Save Changes'}
            </Button>
          </ButtonGroup>
        </Form>
      </ModalContent>
    </Modal>
  );
};

export const ProjectsPage: React.FC = () => {
  const { createProject, deleteProject, updateProject } = useDatabase();
  const { projects, isLoading, error, refreshProjects } = useProjects();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [expandedStats, setExpandedStats] = useState<Set<number>>(new Set());

  const handleAddSubmit = async (name: string) => {
    try {
      await createProject(name);
      await refreshProjects();
      setIsAddModalOpen(false);
    } catch (error) {
      console.error('Failed to create project:', error);
    }
  };

  const handleEditSubmit = async (name: string) => {
    if (!selectedProject) return;
    try {
      await updateProject(selectedProject.id, name);
      await refreshProjects();
      setIsEditModalOpen(false);
    } catch (error) {
      console.error('Failed to edit project:', error);
    }
  };

  const handleEditClick = (project: Project) => {
    setSelectedProject(project);
    setIsEditModalOpen(true);
  };

  const handleDeleteClick = (project: Project) => {
    setSelectedProject(project);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedProject) return;
    try {
      await deleteProject(selectedProject.id);
      await refreshProjects();
      setIsDeleteModalOpen(false);
    } catch (error) {
      console.error('Failed to delete project:', error);
    }
  };

  const toggleProjectStats = (projectId: number) => {
    setExpandedStats(prev => {
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
        <Button onPress={() => setIsAddModalOpen(true)} color="primary">
          Add Project
        </Button>
      </Header>

      <ProjectList>
        {projects.map(project => (
          <ProjectCard key={project.id} data-testid={`project-card-${project.id}`}>
            <ProjectName>{project.name}</ProjectName>
            <ProjectDate>Created {new Date(project.createdAt).toLocaleDateString()}</ProjectDate>
            <ProjectActions>
              <Button
                className="bg-transparent"
                isIconOnly
                aria-label="Edit Project"
                onPress={() => handleEditClick(project)}
                title="Edit Project"
              >
                ✏️
              </Button>
              <Button
                className="bg-transparent"
                isIconOnly
                onPress={() => handleDeleteClick(project)}
                title="Delete Project"
                aria-label="Delete Project"
              >
                🗑️
              </Button>
            </ProjectActions>
            <StatsSection data-testid={`stats-section-${project.id}`}>
              <StatsToggle onClick={() => toggleProjectStats(project.id)}>
                {expandedStats.has(project.id) ? '▼' : '▶'} Project Stats
              </StatsToggle>
              <StatsContent $isExpanded={expandedStats.has(project.id)}>
                <StatRow>
                  <span>Total Time:</span>
                  <span>{formatDuration(project.totalTime)}</span>
                </StatRow>
                <StatRow>
                  <span>Sessions:</span>
                  <span>{project.sessionCount}</span>
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
        onClose={() => setIsEditModalOpen(false)}
        onSubmit={handleEditSubmit}
        initialName={selectedProject?.name}
        title="Edit Project"
        existingProjects={projects}
      />

      <ConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete Project"
        message={`Are you sure you want to delete "${selectedProject?.name}"? This action cannot be undone.`}
      />
    </PageContainer>
  );
};
