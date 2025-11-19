import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { useProjects } from '@/contexts/ProjectsContext';
import type { Project } from '@/types/project';
import { formatDuration } from '@/utils/time';
import { Button, Chip } from '@heroui/react';
import type { Tag } from '@/types/tag';
import { ConfirmModal } from '@/components/ConfirmModal';
import { useSessions } from '@/state/hooks/useAppState';
import { useDatabase } from '@/contexts/DatabaseContext';

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

const ProjectHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.75rem;
`;

const ProjectHeaderLeft = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
`;

const ProjectHeaderRight = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const ProjectActions = styled.div`
  display: flex;
  gap: 0.5rem;
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
  margin-top: 0.75rem;
`;

const StatRow = styled.div`
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
`;

const TagRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-top: 0.5rem;
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
  availableTags: Tag[];
  currentProjectId?: number;
}

const ProjectModal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialName = '',
  title,
  existingProjects = [],
  availableTags,
  currentProjectId,
}) => {
  const [projectName, setProjectName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);

  React.useEffect(() => {
    setProjectName(initialName);
    setError(null);
    setSelectedTagIds([]);
  }, [initialName, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim()) {
      setError('Project name is required');
      return;
    }

    const trimmedName = projectName.trim();
    const isDuplicate = existingProjects.some(project => {
      if (currentProjectId && project.projectId === currentProjectId) {
        // Allow keeping the same name on the project being edited
        return false;
      }
      return project.name.toLowerCase() === trimmedName.toLowerCase();
    });

    if (isDuplicate) {
      setError('A project with this name already exists');
      return;
    }

    // For now tags are visual metadata only, so we ignore selectedTagIds here.
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
          {availableTags && availableTags.length > 0 && (
            <TagRow>
              {availableTags.map(tag => {
                const isSelected = selectedTagIds.includes(tag.id);
                return (
                  <Chip
                    key={tag.id}
                    className="cursor-pointer"
                    color="default"
                    variant={isSelected ? 'flat' : 'bordered'}
                    style={
                      isSelected && tag.color
                        ? { backgroundColor: tag.color, color: '#ffffff' }
                        : undefined
                    }
                    onClick={() =>
                      setSelectedTagIds(prev =>
                        prev.includes(tag.id) ? prev.filter(id => id !== tag.id) : [...prev, tag.id]
                      )
                    }
                  >
                    {tag.name}
                  </Chip>
                );
              })}
            </TagRow>
          )}
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
  const { createProject, deleteProject, updateProject, getSessions, getAllTags } = useDatabase();
  const { projects, isLoading, error, refreshProjects } = useProjects();
  const { sessions, setSessions } = useSessions();
  const [tags, setTags] = useState<Tag[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [expandedStats, setExpandedStats] = useState<Set<number>>(new Set());

  useEffect(() => {
    const fetchSessionsAndTags = async () => {
      const [allSessions, allTags] = await Promise.all([getSessions(), getAllTags()]);
      setSessions(allSessions);
      setTags(allTags);
    };
    void fetchSessionsAndTags();
    // We intentionally run this once on mount to avoid an update loop with setSessions/addTag
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAddSubmit = async (name: string) => {
    try {
      await createProject(name);
      await refreshProjects();
      // tag-to-project linking can be added here in a future iteration
      setIsAddModalOpen(false);
    } catch (error) {
      console.error('Failed to create project:', error);
    }
  };

  const handleEditSubmit = async (name: string) => {
    if (!selectedProject) return;
    try {
      await updateProject(selectedProject.projectId, name);
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
      await deleteProject(selectedProject.projectId);
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
          <ProjectCard key={project.projectId} data-testid={`project-card-${project.projectId}`}>
            <ProjectHeader>
              <ProjectHeaderLeft>
                <ProjectName>{project.name}</ProjectName>
                <ProjectDate>
                  Created {new Date(project.createdAt).toLocaleDateString()}
                </ProjectDate>
              </ProjectHeaderLeft>
              <ProjectHeaderRight>
                <StatsToggle onClick={() => toggleProjectStats(project.projectId)}>
                  {expandedStats.has(project.projectId) ? '▼' : '▶'}
                </StatsToggle>
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
              </ProjectHeaderRight>
            </ProjectHeader>
            <StatsContent
              $isExpanded={expandedStats.has(project.projectId)}
              data-testid={`stats-section-${project.projectId}`}
            >
              <StatRow>
                <span>Total Time:</span>
                <span>
                  {formatDuration(
                    sessions
                      .filter(session => session.projectId === project.projectId)
                      .reduce((acc, session) => acc + session.duration, 0)
                  )}
                </span>
              </StatRow>
              <StatRow>
                <span>Sessions:</span>
                <span>
                  {sessions.filter(session => session.projectId === project.projectId).length}
                </span>
              </StatRow>
            </StatsContent>
          </ProjectCard>
        ))}
      </ProjectList>

      <ProjectModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={handleAddSubmit}
        title="Add New Project"
        existingProjects={projects}
        availableTags={tags}
      />

      <ProjectModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSubmit={handleEditSubmit}
        initialName={selectedProject?.name}
        title="Edit Project"
        existingProjects={projects}
        availableTags={tags}
        currentProjectId={selectedProject?.projectId}
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
