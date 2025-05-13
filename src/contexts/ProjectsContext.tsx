import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useDatabase } from './DatabaseContext';
import type { Project } from '@/types/state';

interface ProjectsContextType {
  projects: Project[];
  isLoading: boolean;
  error: string | null;
  refreshProjects: () => Promise<void>;
}

const ProjectsContext = createContext<ProjectsContextType | undefined>(undefined);

export const ProjectsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { getAllProjects } = useDatabase();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshProjects = async () => {
    try {
      setIsLoading(true);
      console.log('Fetching projects from database...');
      const fetchedProjects = await getAllProjects();
      console.log('Fetched projects:', fetchedProjects);

      if (!Array.isArray(fetchedProjects)) {
        throw new Error('Invalid response from database: expected an array of projects');
      }

      const mappedProjects: Project[] = fetchedProjects.map(project => ({
        id: project.id,
        name: project.name,
        description: project.description || '',
        totalTime: 0,
        sessionCount: 0,
        createdAt: new Date(project.created_at),
        updatedAt: new Date(project.created_at),
      }));

      console.log('Mapped projects:', mappedProjects);
      setProjects(mappedProjects);
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch projects';
      console.error('Error fetching projects:', err);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    console.log('ProjectsProvider mounted, refreshing projects...');

    const loadProjects = async () => {
      if (mounted) {
        await refreshProjects();
      }
    };

    loadProjects();

    return () => {
      mounted = false;
    };
  }, []); // Remove getAllProjects from dependencies to prevent double fetching

  const value = {
    projects,
    isLoading,
    error,
    refreshProjects,
  };

  return <ProjectsContext.Provider value={value}>{children}</ProjectsContext.Provider>;
};

export const useProjects = (): ProjectsContextType => {
  const context = useContext(ProjectsContext);
  if (context === undefined) {
    throw new Error('useProjects must be used within a ProjectsProvider');
  }
  return context;
};
