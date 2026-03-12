import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StationContinuityPanel } from '../components/Auth/StationContinuityPanel';
import { ClientView } from '../types';

const baseStatus = {
  eyebrow: 'Local station',
  title: 'Resume local station',
  detail: 'Continue from the latest recorded state.',
  workspaceLabel: 'Play',
  targetView: ClientView.PLAY,
  connectHint: 'Connect later if you want sync.',
  actionLabel: 'Resume Local Station',
  statusLabel: 'State',
  statusValue: 'Saved',
  chips: ['Offline-first'],
  metrics: [],
  relayTitle: null,
} as const;

describe('StationContinuityPanel', () => {
  it('hides the next-local-resume block when the station is fresh', () => {
    render(
      <StationContinuityPanel
        status={{
          ...baseStatus,
          mode: 'fresh',
        }}
        activity={[]}
        entryDescriptor={{
          title: 'Guided setup opened',
          detail: 'XTATION opened the local Play station and started the guided setup flow.',
          workspaceLabel: 'Play',
          targetView: ClientView.PLAY,
          chips: ['Offline-first', 'Starter flow'],
        }}
        variant="welcome"
      />
    );

    expect(screen.queryByText('Next local resume')).not.toBeInTheDocument();
  });

  it('hides the next-local-resume block for a fresh guided setup lane', () => {
    render(
      <StationContinuityPanel
        status={{
          ...baseStatus,
          mode: 'guided',
          entryState: 'fresh',
          eyebrow: 'Guided setup',
          title: 'Start local station',
          detail: 'Seed the first branch and let XTATION build the initial action room around it.',
          actionLabel: 'Start Guided Setup',
          statusLabel: 'Setup',
          statusValue: 'Pending',
          chips: ['Offline-first', 'Starter flow'],
        }}
        activity={[]}
        entryDescriptor={{
          title: 'Guided setup opened',
          detail: 'XTATION opened the local Play station and started the guided setup flow.',
          workspaceLabel: 'Play',
          targetView: ClientView.PLAY,
          chips: ['Offline-first', 'Starter flow'],
        }}
        variant="welcome"
      />
    );

    expect(screen.queryByText('Next local resume')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Continue Guided Setup' })).not.toBeInTheDocument();
  });

  it('shows the next-open path row for resume flows when the target differs', () => {
    render(
      <StationContinuityPanel
        status={{
          ...baseStatus,
          mode: 'resume',
          workspaceLabel: 'Profile',
        }}
        activity={[]}
        entryDescriptor={{
          title: 'Starter loop resumed',
          detail: 'XTATION will reopen Profile and continue the starter loop.',
          workspaceLabel: 'Play',
          targetView: ClientView.PLAY,
          chips: ['Starter loop'],
        }}
        variant="welcome"
      />
    );

    expect(screen.getByText('Next open')).toBeInTheDocument();
    expect(screen.queryByText('Next local resume')).not.toBeInTheDocument();
  });

  it('shows a return-to-guided-setup action when starter setup was skipped', () => {
    render(
      <StationContinuityPanel
        status={{
          ...baseStatus,
          mode: 'resume',
        }}
        activity={[]}
        latestTransitionActivity={{
          id: 'skip',
          createdAt: Date.now(),
          title: 'Starter setup skipped',
          detail:
            'XTATION left the local Play station open without seeding a starter loop. You can return to guided setup any time from Play.',
          workspaceLabel: 'Play',
        }}
        onOpenGuidedSetup={() => {}}
        variant="welcome"
      />
    );

    expect(screen.getByRole('button', { name: 'Return to Guided Setup' })).toBeInTheDocument();
  });

  it('does not duplicate the latest transition inside recent continuity', () => {
    const latestTransition = {
      id: 'skip',
      createdAt: Date.now(),
      title: 'Starter setup skipped',
      detail:
        'XTATION left the local Play station open without seeding a starter loop. You can return to guided setup any time from Play.',
      workspaceLabel: 'Play',
    };

    render(
      <StationContinuityPanel
        status={{
          ...baseStatus,
          mode: 'resume',
        }}
        activity={[latestTransition]}
        latestTransitionActivity={latestTransition}
        variant="welcome"
      />
    );

    expect(screen.queryByText('Recent continuity')).not.toBeInTheDocument();
    expect(screen.getByText('Latest transition outcome')).toBeInTheDocument();
  });

  it('hides the latest transition outcome when the primary summary already covers it', () => {
    const latestTransition = {
      id: 'skip',
      createdAt: Date.now(),
      title: 'Starter setup skipped',
      detail:
        'XTATION left the local Play station open without seeding a starter loop. You can return to guided setup any time from Play.',
      workspaceLabel: 'Play',
    };

    render(
      <StationContinuityPanel
        status={{
          ...baseStatus,
          mode: 'resume',
          title: 'Continue local station',
          detail:
            'XTATION left the local Play station open without seeding a starter loop. You can return to guided setup any time from Play. Resume in Play and keep the local station moving from the latest confirmed state.',
        }}
        activity={[]}
        latestTransitionActivity={latestTransition}
        variant="welcome"
      />
    );

    expect(screen.queryByText('Latest transition outcome')).not.toBeInTheDocument();
  });
});
