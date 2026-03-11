import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ClientView } from '../types';

const mocks = vi.hoisted(() => ({
  getGuestStationSnapshot: vi.fn(),
  hasGuestStationData: vi.fn(),
  buildGuestStationSummary: vi.fn(),
  readXtationOnboardingState: vi.fn(),
  readXtationOnboardingHandoff: vi.fn(),
  readStoredXtationLastView: vi.fn(),
  resolveXtationLastView: vi.fn(),
  buildLocalStationStatus: vi.fn(),
}));

vi.mock('../src/auth/guestStation', () => ({
  getGuestStationSnapshot: mocks.getGuestStationSnapshot,
  hasGuestStationData: mocks.hasGuestStationData,
  buildGuestStationSummary: mocks.buildGuestStationSummary,
}));

vi.mock('../src/onboarding/storage', () => ({
  readXtationOnboardingState: mocks.readXtationOnboardingState,
  readXtationOnboardingHandoff: mocks.readXtationOnboardingHandoff,
}));

vi.mock('../src/navigation/lastView', () => ({
  readStoredXtationLastView: mocks.readStoredXtationLastView,
  resolveXtationLastView: mocks.resolveXtationLastView,
}));

vi.mock('../src/welcome/localStationStatus', () => ({
  buildLocalStationStatus: mocks.buildLocalStationStatus,
}));

describe('readGuestStationContinuityState', () => {
  beforeEach(() => {
    mocks.getGuestStationSnapshot.mockReset();
    mocks.hasGuestStationData.mockReset();
    mocks.buildGuestStationSummary.mockReset();
    mocks.readXtationOnboardingState.mockReset();
    mocks.readXtationOnboardingHandoff.mockReset();
    mocks.readStoredXtationLastView.mockReset();
    mocks.resolveXtationLastView.mockReset();
    mocks.buildLocalStationStatus.mockReset();
    mocks.resolveXtationLastView.mockImplementation((view) => view ?? ClientView.LOBBY);
  });

  it('builds local status from guest snapshot, onboarding state, and continuity inputs', async () => {
    const { readGuestStationContinuityState } = await import('../src/welcome/guestContinuity');

    const starterFlowSummary = {
      title: 'First session live',
      detail: 'Live starter loop',
      workspaceLabel: 'Profile',
      targetView: ClientView.PROFILE,
      chips: ['Mission'],
      tone: 'accent' as const,
      createdAt: 300,
      statusLabel: 'Session live' as const,
      statusDetail: 'The first live session has started.',
    };
    const latestTransitionActivity = {
      id: 'transition',
      createdAt: 200,
      title: 'Imported local station',
      detail: 'Imported into account state.',
      targetView: ClientView.LAB,
      workspaceLabel: 'Lab',
      chips: ['Imported'],
      tone: 'accent' as const,
    };
    const stationActivity = [latestTransitionActivity];
    const summary = {
      tasks: 3,
      sessions: 1,
      projects: 0,
      selfTreeNodes: 2,
      inventorySlots: 1,
      activeDays: 1,
      latestActivityAt: 123,
    };
    const onboardingState = { completedAt: 50 };
    const onboardingHandoff = { title: 'Ship first loop', branch: 'Systems', track: 'mission' };
    const localStatus = { title: 'Continue local station' };

    mocks.getGuestStationSnapshot.mockReturnValue({ ledger: true });
    mocks.hasGuestStationData.mockReturnValue(true);
    mocks.buildGuestStationSummary.mockReturnValue(summary);
    mocks.readXtationOnboardingState.mockReturnValue(onboardingState);
    mocks.readXtationOnboardingHandoff.mockReturnValue(onboardingHandoff);
    mocks.readStoredXtationLastView.mockReturnValue(ClientView.PROFILE);
    mocks.buildLocalStationStatus.mockReturnValue(localStatus);

    const result = readGuestStationContinuityState(
      stationActivity,
      starterFlowSummary,
      latestTransitionActivity,
      {
        canAccessAdmin: false,
        featureVisibility: { lab: true, multiplayer: true, store: true },
      }
    );

    expect(mocks.buildLocalStationStatus).toHaveBeenCalledWith(
      summary,
      onboardingState,
      onboardingHandoff,
      ClientView.PROFILE,
      starterFlowSummary,
      latestTransitionActivity,
      {
        canAccessAdmin: false,
        featureVisibility: { lab: true, multiplayer: true, store: true },
      }
    );
    expect(result).toEqual({
      stationActivity,
      starterFlowSummary,
      latestTransitionActivity,
      localStatus,
    });
  });

  it('passes null summary when guest storage has no recoverable data', async () => {
    const { readGuestStationContinuityState } = await import('../src/welcome/guestContinuity');

    mocks.getGuestStationSnapshot.mockReturnValue(null);
    mocks.hasGuestStationData.mockReturnValue(false);
    mocks.readXtationOnboardingState.mockReturnValue({});
    mocks.readXtationOnboardingHandoff.mockReturnValue(null);
    mocks.readStoredXtationLastView.mockReturnValue(ClientView.LOBBY);
    mocks.buildLocalStationStatus.mockReturnValue({ title: 'Fresh station' });

    readGuestStationContinuityState([], null, null);

    expect(mocks.buildGuestStationSummary).not.toHaveBeenCalled();
    expect(mocks.buildLocalStationStatus).toHaveBeenCalledWith(
      null,
      {},
      null,
      ClientView.LOBBY,
      null,
      null,
      undefined
    );
  });

  it('resolves the final guest resume view and transition descriptor from the same continuity state', async () => {
    const { resolveGuestStationEntryState } = await import('../src/welcome/guestContinuity');

    mocks.getGuestStationSnapshot.mockReturnValue({ ledger: true });
    mocks.hasGuestStationData.mockReturnValue(false);
    mocks.readXtationOnboardingState.mockReturnValue({});
    mocks.readXtationOnboardingHandoff.mockReturnValue(null);
    mocks.readStoredXtationLastView.mockReturnValue(ClientView.LOBBY);
    mocks.buildLocalStationStatus.mockReturnValue({
      mode: 'resume',
      eyebrow: 'Starter loop',
      title: 'Continue local station',
      detail: 'Continue from the starter loop.',
      workspaceLabel: 'Profile',
      targetView: ClientView.PROFILE,
      connectHint: 'Connect hint',
      actionLabel: 'Continue Starter Loop',
      statusLabel: 'Session live',
      statusValue: 'Profile',
      chips: ['Starter loop', 'Mission'],
      metrics: [],
      relayTitle: 'Ship first loop',
    });

    const result = resolveGuestStationEntryState([], null, null, {
      canAccessAdmin: false,
      featureVisibility: { lab: true, multiplayer: true, store: true },
    });

    expect(result.fallbackResumeView).toBe(ClientView.LOBBY);
    expect(result.resumeView).toBe(ClientView.PROFILE);
    expect(result.transitionDescriptor.title).toBe('Starter loop resumed');
    expect(result.transitionDescriptor.targetView).toBe(ClientView.PROFILE);
  });
});
