import { describe, expect, it } from 'vitest';
import { ClientView } from '../types';
import { buildLocalStationStatus } from '../src/welcome/localStationStatus';
import { defaultXtationOnboardingState, type XtationOnboardingHandoff } from '../src/onboarding/storage';
import type { GuestStationSummary } from '../src/auth/guestStation';
import type { StationStarterFlowSummary } from '../src/station/starterFlow';
import type { StationActivityEntry } from '../src/station/stationActivity';

const baseSummary: GuestStationSummary = {
  tasks: 3,
  sessions: 4,
  projects: 1,
  selfTreeNodes: 2,
  inventorySlots: 1,
  activeDays: 3,
  latestActivityAt: Date.now(),
};

const latestTransitionActivity: StationActivityEntry = {
  id: 'transition-1',
  createdAt: Date.now(),
  title: 'Returned to local station',
  detail: 'The offline-first station was reopened on this device.',
  workspaceLabel: 'Play',
  targetView: ClientView.LOBBY,
  chips: ['Account unchanged', 'Play resumed'],
  tone: 'default',
};

describe('buildLocalStationStatus', () => {
  it('returns guided setup for a fresh pending station', () => {
    const status = buildLocalStationStatus(null, defaultXtationOnboardingState, null);
    expect(status.mode).toBe('guided');
    expect(status.entryState).toBe('fresh');
    expect(status.actionLabel).toBe('Start Guided Setup');
  });

  it('returns a guided setup resume CTA when pending setup already exists', () => {
    const status = buildLocalStationStatus(
      baseSummary,
      defaultXtationOnboardingState,
      null,
      ClientView.LOBBY,
      null,
      latestTransitionActivity
    );

    expect(status.mode).toBe('guided');
    expect(status.entryState).toBe('resume');
    expect(status.title).toBe('Continue local station');
    expect(status.actionLabel).toBe('Continue Guided Setup');
    expect(status.statusValue).toBe('In progress');
    expect(status.chips).toContain('Resume');
  });

  it('returns resume state when local station data exists', () => {
    const status = buildLocalStationStatus(baseSummary, { status: 'skipped', updatedAt: Date.now() }, null);
    expect(status.mode).toBe('resume');
    expect(status.actionLabel).toBe('Resume Local Station');
    expect(status.metrics[0]).toEqual({ label: 'Quests', value: '3' });
  });

  it('prioritizes starter relay when an undismissed handoff exists', () => {
    const handoff: XtationOnboardingHandoff = {
      questId: 'quest-1',
      title: 'Ship the first loop',
      branch: 'Systems',
      track: 'system',
      createdAt: Date.now(),
    };
    const status = buildLocalStationStatus(baseSummary, { status: 'completed', updatedAt: Date.now() }, handoff);
    expect(status.mode).toBe('relay');
    expect(status.statusValue).toContain('System');
    expect(status.actionLabel).toBe('Resume Starter Relay');
  });

  it('falls back to fresh open when setup is not pending and no data exists', () => {
    const status = buildLocalStationStatus(null, { status: 'skipped', updatedAt: Date.now() }, null);
    expect(status.mode).toBe('fresh');
    expect(status.actionLabel).toBe('Open Local Station');
  });

  it('shows resume state when a previous local workspace exists without quest data', () => {
    const status = buildLocalStationStatus(null, { status: 'skipped', updatedAt: Date.now() }, null, ClientView.PROFILE);
    expect(status.mode).toBe('resume');
    expect(status.statusValue).toBe(ClientView.PROFILE);
    expect(status.actionLabel).toBe('Resume Local Station');
  });

  it('prioritizes the latest starter loop once relay is cleared', () => {
    const starterFlowSummary: StationStarterFlowSummary = {
      title: 'Stats lane open',
      detail: 'The stats lane is open.',
      workspaceLabel: 'Profile',
      targetView: ClientView.PROFILE,
      chips: ['practice', 'physical'],
      tone: 'accent',
      createdAt: Date.now(),
      statusLabel: 'Action confirmed',
      statusDetail: 'The recommended first move has already been taken and recorded in this station.',
    };
    const status = buildLocalStationStatus(
      baseSummary,
      { status: 'completed', updatedAt: Date.now() },
      null,
      ClientView.PROFILE,
      starterFlowSummary
    );
    expect(status.mode).toBe('resume');
    expect(status.actionLabel).toBe('Continue Starter Loop');
    expect(status.statusLabel).toBe('Action confirmed');
    expect(status.workspaceLabel).toBe('Profile');
    expect(status.targetView).toBe(ClientView.PROFILE);
  });

  it('prioritizes a newer starter-loop milestone over an older active relay', () => {
    const handoff: XtationOnboardingHandoff = {
      questId: 'quest-1',
      title: 'Ship the first loop',
      branch: 'Systems',
      track: 'system',
      createdAt: 100,
    };
    const starterFlowSummary: StationStarterFlowSummary = {
      title: 'First session live',
      detail: 'The first live session has started.',
      workspaceLabel: 'Play',
      targetView: ClientView.LOBBY,
      chips: ['system', 'systems'],
      tone: 'accent',
      createdAt: 200,
      statusLabel: 'Session live',
      statusDetail: 'The first live session has started and XTATION is now tracking the starter loop in real time.',
    };

    const status = buildLocalStationStatus(
      baseSummary,
      { status: 'completed', updatedAt: Date.now() },
      handoff,
      ClientView.LOBBY,
      starterFlowSummary
    );

    expect(status.eyebrow).toBe('Starter loop');
    expect(status.actionLabel).toBe('Continue Starter Loop');
    expect(status.statusLabel).toBe('Session live');
    expect(status.workspaceLabel).toBe('Play');
  });

  it('uses the latest transition outcome when starter loop is absent', () => {
    const status = buildLocalStationStatus(
      baseSummary,
      { status: 'completed', updatedAt: Date.now() },
      null,
      ClientView.LOBBY,
      null,
      latestTransitionActivity
    );
    expect(status.eyebrow).toBe('Latest transition');
    expect(status.title).toBe('Continue local station');
    expect(status.statusLabel).toBe('Transition');
    expect(status.workspaceLabel).toBe('Play');
    expect(status.actionLabel).toBe('Continue Local Station');
    expect(status.targetView).toBe(ClientView.LOBBY);
  });

  it('downgrades inaccessible transition targets before rendering status copy', () => {
    const status = buildLocalStationStatus(
      baseSummary,
      { status: 'completed', updatedAt: Date.now() },
      null,
      ClientView.LOBBY,
      null,
      {
        ...latestTransitionActivity,
        workspaceLabel: 'Admin',
        targetView: ClientView.ADMIN,
      },
      {
        canAccessAdmin: false,
      }
    );

    expect(status.workspaceLabel).toBe('Play');
    expect(status.targetView).toBe(ClientView.LOBBY);
  });
});
