import React from 'react';
import { NavLink } from 'react-router-dom';
import styled from 'styled-components';

const SidebarContainer = styled.nav`
  width: 250px;
  background-color: #f5f5f5;
  border-right: 1px solid #e0e0e0;
  padding: 1rem;
`;

const NavList = styled.ul`
  list-style: none;
  padding: 0;
`;

const NavItem = styled.li`
  margin-bottom: 0.5rem;
`;

const StyledNavLink = styled(NavLink)`
  display: block;
  padding: 0.75rem 1rem;
  text-decoration: none;
  color: #333;
  border-radius: 4px;
  transition: background-color 0.2s;

  &:hover {
    background-color: #e0e0e0;
  }

  &.active {
    background-color: #007bff;
    color: white;
  }
`;

const Sidebar = () => {
  return (
    <SidebarContainer>
      <NavList>
        <NavItem>
          <StyledNavLink to="/">Timer</StyledNavLink>
        </NavItem>
        <NavItem>
          <StyledNavLink to="/projects">Projects</StyledNavLink>
        </NavItem>
        <NavItem>
          <StyledNavLink to="/settings">Settings</StyledNavLink>
        </NavItem>
      </NavList>
    </SidebarContainer>
  );
};

export default Sidebar;
