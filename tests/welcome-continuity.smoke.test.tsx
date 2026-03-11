import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Welcome } from '../components/Views/Welcome';
import { ClientView } from '../types';

const mocks = vi.hoisted(() => ({
  authCard: vi.fn(() => <div data-testid="auth-card-mock">AuthCard</div>),
  useAdminConsole: vi.fn(),
  useXtationSettings: vi.fn(),
  readStoredXtationLastView: vi.fn(),
  readStationActivity: vi.fn(),
  buildStationContinuityContext: vi.fn(),
  resolveGuestStationEntryState: vi.fn(),
}));

vi.mock('../components/Auth/AuthCard', () => ({
  AuthCard: (props: unknown) => mocks.authCard(props),
}));

vi.mock('../src/admin/AdminConsoleProvider', () => ({
  useAdminConsole: () => mocks.useAdminConsole(),
}));

vi.mock('../src/settings/SettingsProvider', () => ({
  useXtationSettings: () => mocks.useXtationSettings(),
}));

vi.mock('../src/navigation/lastView', () => ({
  readStoredXtationLastView: () => mocks.readStoredXtationLastView(),
}));

vi.mock('../src/station/stationActivity', () => ({
  readStationActivity: () => mocks.readStationActivity(),
}));

vi.mock('../src/station/continuityContext', () => ({
  buildStationContinuityContext: (...args: unknown[]) => mocks.buildStationContinuityContext(...args),
}));

vi.mock('../src/welcome/guestContinuity', () => ({
  resolveGuestStationEntryState: (...args: unknown[]) => mocks.resolveGuestStationEntryState(...args),
}));

describe('Welcome continuity composition', () => {
  beforeEach(() => {
    mocks.authCard.mockClear();
    mocks.useAdminConsole.mockReturnValue({
      currentStation: {
        releaseChannel: 'internal',
        plan: 'trial',
        trialEndsAt: Date.now() + 1000 * 60 * 60 * 24 * 14,
      },
      access: { allowed: false },
    });
    mocks.useXtationSettings.mockReturnValue({
      settings: {
        features: {
          labEnabled: true,
          multiplayerEnabled: true,
          storeEnabled: true,
        },
      },
    });
    mocks.readStoredXtationLastView.mockReturnValue(ClientView.LOBBY);
    mocks.readStationActivity.mockReturnValue([]);
    mocks.buildStationContinuityContext.mockReturnValue({
      starterFlowSummary: {
        title: 'Starter loop landed',
        detail: 'First loop is visible.',
        workspaceLabel: 'Profile',
        targetView: ClientView.PROFILE,
        chips: ['Mission', 'Profile'],
        tone: 'accent',
        createdAt: Date.now(),
        statusLabel: 'Route live',
        statusDetail: 'Profile route live.',
      },
      latestTransitionActivity: {
        id: 'activity-1',
        createdAt: Date.now(),
        title: 'Guided setup opened',
        detail: 'XTATION opened Play and the setup flow.',
        targetView: ClientView.PLAY,
        workspaceLabel: 'Play',
        chips: ['Offline-first', 'Starter flow'],
        tone: 'accent',
      },
      visibleRecentStationActivity: [],
    });
    mocks.resolveGuestStationEntryState.mockReturnValue({
      localStatus: {
        mode: 'guided',
        entryState: 'resume',
        eyebrow: 'Guided setup',
        title: 'Continue local station',
        detail:
          'XTATION already has a local guided setup in progress. Reopen it and continue seeding the first branch and operating track.',
        workspaceLabel: 'Play',
        targetView: ClientView.PLAY,
        connectHint:
          'If you connect after setup, XTATION will carry your local starter flow into the signed-in handoff review.',
        actionLabel: 'Continue Guided Setup',
        statusLabel: 'Setup',
        statusValue: 'In progress',
        chips: ['Offline-first', 'Starter flow', 'Resume'],
        metrics: [],
        relayTitle: null,
      },
      stationActivity: [],
      starterFlowSummary: {
        title: 'Starter loop landed',
        detail: 'First loop is visible.',
        workspaceLabel: 'Profile',
        targetView: ClientView.PROFILE,
        chips: ['Mission', 'Profile'],
        tone: 'accent',
        createdAt: Date.now(),
        statusLabel: 'Route live',
        statusDetail: 'Profile route live.',
      },
      latestTransitionActivity: {
        id: 'activity-1',
        createdAt: Date.now(),
        title: 'Guided setup opened',
        detail: 'XTATION opened Play and the setup flow.',
        targetView: ClientView.PLAY,
        workspaceLabel: 'Play',
        chips: ['Offline-first', 'Starter flow'],
        tone: 'accent',
      },
      fallbackResumeView: ClientView.LOBBY,
      resumeView: ClientView.PLAY,
      transitionDescriptor: {
        title: 'Guided setup opened',
        detail: 'XTATION opened the local Play station and started the guided setup flow.',
        workspaceLabel: 'Play',
        targetView: ClientView.PLAY,
        chips: ['Offline-first', 'Starter flow', 'Play reopened'],
      },
    });
  });

  it('hides duplicate auth entry descriptors and shows the starter CTA', () => {
    render(<Welcome onEnterLocalMode={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Continue Guided Setup' })).toBeInTheDocument();
    expect(screen.getByText('Latest transition outcome')).toBeInTheDocument();
    expect(screen.getByText('Starter loop')).toBeInTheDocument();
    expect(screen.queryAllByText('Next local resume')).toHaveLength(1);

    expect(mocks.authCard).toHaveBeenCalledWith(
      expect.objectContaining({
        showEntryDescriptor: false,
      })
    );
  });
});
