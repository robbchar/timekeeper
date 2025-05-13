import React from 'react';
import styled from 'styled-components';
import { useProjects } from '@/contexts/ProjectsContext';

const HeaderContainer = styled.header`
  height: 60px;
  background-color: white;
  border-bottom: 1px solid #e0e0e0;
  padding: 0 1.5rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const ProjectSwitcher = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const Select = styled.select`
  padding: 0.5rem;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  background-color: white;
  font-size: 1rem;
  min-width: 200px;

  &:focus {
    outline: none;
    border-color: #007bff;
  }
`;

const Clock = styled.div`
  font-size: 1.25rem;
  font-weight: 500;
  color: #333;
`;

const Header = () => {
  const { projects, isLoading } = useProjects();
  const currentTime = new Date().toLocaleTimeString();

  return (
    <HeaderContainer>
      <ProjectSwitcher>
        <span>Current Project:</span>
        <Select>
          <option value="">Select Project</option>
          {!isLoading &&
            projects.map(project => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
        </Select>
      </ProjectSwitcher>
      <Clock>{currentTime}</Clock>
    </HeaderContainer>
  );
};

export default Header;
