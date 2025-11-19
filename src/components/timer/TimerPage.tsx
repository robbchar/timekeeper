import styled from 'styled-components';
import SessionControls from './SessionControls';
import React, { useCallback, useEffect, useState } from 'react';
import { useDatabase } from '@/contexts/DatabaseContext';
import type { Tag } from '@/types/tag';
import { useProjects } from '@/contexts/ProjectsContext';
import { useSessions } from '@/state/hooks/useAppState';

const PageContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2rem;
  padding: 2rem;
  max-width: 800px;
  margin: 0 auto;
`;

const TimerPage = () => {
  const [isSessionsLoading, setIsSessionsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const { getSessionsForProject, getTagsForProject } = useDatabase();
  const {
    projects,
    isLoading: projectsLoading,
    selectedProjectId,
    setSelectedProjectId,
  } = useProjects();
  const { sessions, setSessions } = useSessions();
  const [projectTags, setProjectTags] = useState<Tag[]>([]);

  const fetchSessions = useCallback(async () => {
    if (!selectedProjectId || selectedProjectId <= 0) {
      console.log('SessionControls No currentProjectId, skipping fetch');
      setProjectTags([]);
      return;
    }

    setIsSessionsLoading(true);
    setError(null);
    try {
      const [dbSessions, tagsForProject] = await Promise.all([
        getSessionsForProject(selectedProjectId),
        getTagsForProject(selectedProjectId),
      ]);
      console.log('SessionControls Mapped sessions:', dbSessions);
      setSessions(dbSessions);
      setProjectTags(tagsForProject);
    } catch {
      console.log('SessionControls Error fetching sessions:', error);
      setError('Failed to load sessions');
    } finally {
      console.log('SessionControls Finished fetching sessions');
      setIsSessionsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProjectId]);

  useEffect(() => {
    fetchSessions();
  }, [selectedProjectId, fetchSessions]);

  const projectSelected = (projectId: number) => {
    setSelectedProjectId(projectId);
  };

  const sessionCompleted = () => {
    fetchSessions();
  };

  const sessionEdited = () => {
    fetchSessions();
  };

  return (
    <PageContainer data-testid="timer-page">
      {error && <div style={{ color: 'red' }}>{error}</div>}
      {!projectsLoading && !isSessionsLoading && !error && (
        <SessionControls
          projects={projects}
          sessions={sessions}
          projectSelected={projectSelected}
          sessionCompleted={sessionCompleted}
          selectedProjectId={selectedProjectId}
          isSessionsLoading={isSessionsLoading}
          isProjectsLoading={projectsLoading}
          sessionEdited={sessionEdited}
          projectTags={projectTags}
        />
      )}
    </PageContainer>
  );
};

export default TimerPage;
