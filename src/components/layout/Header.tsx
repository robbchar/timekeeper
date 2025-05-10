import styled from 'styled-components';

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

const Clock = styled.div`
  font-size: 1.25rem;
  font-weight: 500;
  color: #333;
`;

const Header = () => {
  const currentTime = new Date().toLocaleTimeString();

  return (
    <HeaderContainer>
      <ProjectSwitcher>
        <span>Current Project:</span>
        <select>
          <option value="">Select Project</option>
          {/* Project options will be populated dynamically */}
        </select>
      </ProjectSwitcher>
      <Clock>{currentTime}</Clock>
    </HeaderContainer>
  );
};

export default Header;
