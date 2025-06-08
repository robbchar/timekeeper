import styled from 'styled-components';
import SessionControls from './SessionControls';
import React, { useState, useCallback, useEffect } from 'react';
import { useDatabase } from '@/contexts/DatabaseContext';
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
  const [selectedProjectId, setSelectedProjectId] = useState<number>(-1);
  const [isSessionsLoading, setIsSessionsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const { getSessionsForProject } = useDatabase();
  const { projects, isLoading: projectsLoading } = useProjects();
  const { sessions, setSessions } = useSessions();

  const fetchSessions = useCallback(async () => {
    if (!selectedProjectId || selectedProjectId <= 0) {
      console.log('SessionControls No currentProjectId, skipping fetch');
      return;
    }

    setIsSessionsLoading(true);
    setError(null);
    try {
      const dbSessions = await getSessionsForProject(selectedProjectId);
      console.log('SessionControls Mapped sessions:', dbSessions);
      setSessions(dbSessions);
    } catch {
      console.log('SessionControls Error fetching sessions:', error);
      setError('Failed to load sessions');
    } finally {
      console.log('SessionControls Finished fetching sessions');
      setIsSessionsLoading(false);
    }
  }, [selectedProjectId, getSessionsForProject, setSessions, error]);

  useEffect(() => {
    fetchSessions();
  }, [selectedProjectId]);

  const projectSelected = (projectId: number) => {
    setSelectedProjectId(projectId);
    fetchSessions();
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
        />
      )}
    </PageContainer>
  );
};

export default TimerPage;
