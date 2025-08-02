import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from 'react';
import { useDatabase } from '@/contexts/DatabaseContext';
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

  const refreshProjects = useCallback(async () => {
    try {
      setIsLoading(true);
      const fetchedProjects = await getAllProjects();

      if (!Array.isArray(fetchedProjects)) {
        throw new Error('Invalid response from database: expected an array of projects');
      }

      const mappedProjects: Project[] = fetchedProjects.map(project => ({
        projectId: project.projectId,
        name: project.name,
        description: project.description || '',
        createdAt: new Date(project.createdAt),
        updatedAt: new Date(project.createdAt),
      }));

      setProjects(mappedProjects);
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch projects';
      console.error('Error fetching projects:', err);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [getAllProjects]);

  useEffect(() => {
    let mounted = true;

    const loadProjects = async () => {
      if (mounted) {
        await refreshProjects();
      }
    };

    loadProjects();

    return () => {
      mounted = false;
    };
  }, [refreshProjects]);

  const value = {
    projects,
    isLoading,
    error,
    refreshProjects,
  };

  return <ProjectsContext.Provider value={value}>{children}</ProjectsContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useProjects = (): ProjectsContextType => {
  const context = useContext(ProjectsContext);
  if (context === undefined) {
    throw new Error('useProjects must be used within a ProjectsProvider');
  }
  return context;
};
