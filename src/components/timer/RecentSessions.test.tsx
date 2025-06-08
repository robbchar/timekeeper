import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import RecentSessions from './RecentSessions';
import { ThemeProvider } from 'styled-components';
import { theme } from '@/styles/theme';
import type { Session } from '@/types/session';

describe('RecentSessions', () => {
  beforeEach(() => {});

  afterEach(() => {});

  const mockSessions: Session[] = [
    {
      sessionId: 1,
      projectId: 1,
      startTime: new Date(),
      duration: 0,
      status: 'active',
      notes: 'Test notes',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const renderSessions = (sessions: Session[] = mockSessions) => {
    render(
      <ThemeProvider theme={theme}>
        <RecentSessions sessions={sessions} sessionEdited={() => {}} />
      </ThemeProvider>
    );
  };

  it('renders the recent sessions', () => {
    renderSessions();
    expect(screen.getByText('Recent Sessions')).toBeInTheDocument();
  });

  it('renders the recent sessions  with no sessions', () => {
    renderSessions([]);
    expect(screen.getByText('No recent sessions')).toBeInTheDocument();
  });
});
