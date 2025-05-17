import styled from 'styled-components';
import SessionControls from './SessionControls';
import React, { useEffect, useState, useCallback } from 'react';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useProjects } from '@/contexts/ProjectsContext';
import type { Session, SessionStatus } from '@/types/session';

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
  const [sessions, setSessions] = useState<Session[]>([]);
  const { projects, isLoading: projectsLoading } = useProjects();

  const fetchSessions = useCallback(async () => {
    if (!selectedProjectId) {
      console.log('SessionControls No currentProjectId, skipping fetch');
      return;
    }

    setIsSessionsLoading(true);
    setError(null);
    try {
      const dbSessions = (await getSessionsForProject(
        Number(selectedProjectId)
      )) as unknown as Array<{
        id: number;
        projectId?: number;
        project_id?: number;
        startTime?: string;
        start_time?: string;
        endTime?: string | null;
        end_time?: string | null;
        duration?: number;
        notes?: string;
        status?: string;
        totalPausedTime?: number;
        total_paused_time?: number;
        createdAt?: string;
        created_at?: string;
        updatedAt?: string;
        updated_at?: string;
      }>;
      const mappedSessions: Session[] = dbSessions.map(s => ({
        id: s.id,
        projectId: Number(s.project_id ?? selectedProjectId),
        startTime: new Date(s.startTime ?? s.start_time ?? new Date().toISOString()),
        endTime: (s.endTime ?? s.end_time) ? new Date(String(s.endTime ?? s.end_time)) : undefined,
        duration: typeof s.duration === 'number' ? s.duration : 0,
        notes: s.notes ?? '',
        status: (s.status ?? 'completed') as SessionStatus,
        totalPausedTime: s.totalPausedTime ?? s.total_paused_time ?? 0,
        createdAt: new Date(s.createdAt ?? s.created_at ?? new Date().toISOString()),
        updatedAt: new Date(s.updatedAt ?? s.updated_at ?? new Date().toISOString()),
        tags: [], // Initialize with empty array since we don't have tag data yet
      }));
      console.log('SessionControls Mapped sessions:', mappedSessions);
      setSessions(mappedSessions);
    } catch {
      console.log('SessionControls Error fetching sessions:', error);
      setError('Failed to load sessions');
    } finally {
      console.log('SessionControls Finished fetching sessions');
      setIsSessionsLoading(false);
    }
  }, [selectedProjectId, getSessionsForProject]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const projectSelected = (projectId: number) => {
    setSelectedProjectId(projectId);
    fetchSessions();
  };

  const sessionCompleted = () => {
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
        />
      )}
    </PageContainer>
  );
};

export default TimerPage;
