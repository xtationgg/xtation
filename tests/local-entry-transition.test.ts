import { describe, expect, it } from 'vitest';
import { ClientView } from '../types';
import {
  buildLocalEntryTransitionDescriptor,
  resolveLocalEntryTargetView,
} from '../src/welcome/localEntryTransition';
import type { LocalStationStatus } from '../src/welcome/localStationStatus';

const buildStatus = (overrides: Partial<LocalStationStatus>): LocalStationStatus => ({
  mode: 'resume',
  entryState: 'resume',
  eyebrow: 'Local station',
  title: 'Resume local station',
  detail: 'Resume detail',
  workspaceLabel: 'Play',
  connectHint: 'Connect hint',
  actionLabel: 'Resume Local Station',
  statusLabel: 'State',
  statusValue: 'Saved record',
  chips: ['Offline-first'],
  metrics: [],
  relayTitle: null,
  targetView: null,
  ...overrides,
});

describe('buildLocalEntryTransitionDescriptor', () => {
  it('builds an accented starter-loop resume notice', () => {
    const descriptor = buildLocalEntryTransitionDescriptor(
      buildStatus({
        eyebrow: 'Starter loop',
        workspaceLabel: 'Profile',
        chips: ['Starter loop', 'Checkpoint live'],
        relayTitle: 'Ship the onboarding loop',
      }),
      ClientView.PROFILE
    );

    expect(descriptor).toMatchObject({
      title: 'Starter loop resumed',
      tone: 'accent',
      targetView: ClientView.PROFILE,
      workspaceLabel: 'Profile',
    });
    expect(descriptor.detail).toContain('Ship the onboarding loop');
    expect(descriptor.chips).toContain('Profile reopened');
  });

  it('builds a guided setup notice', () => {
    const descriptor = buildLocalEntryTransitionDescriptor(
      buildStatus({
        mode: 'guided',
        entryState: 'resume',
        workspaceLabel: 'Play',
        chips: ['Offline-first', 'Starter flow'],
      }),
      ClientView.LOBBY
    );

    expect(descriptor).toMatchObject({
      title: 'Guided setup resumed',
      tone: 'default',
      targetView: ClientView.LOBBY,
    });
    expect(descriptor.detail).toContain('guided setup flow');
    expect(descriptor.chips).toContain('Setup resumed');
    expect(descriptor.chips).not.toContain('Play reopened');
  });

  it('builds a first-entry guided setup notice', () => {
    const descriptor = buildLocalEntryTransitionDescriptor(
      buildStatus({
        mode: 'guided',
        entryState: 'fresh',
        workspaceLabel: 'Play',
        chips: ['Offline-first', 'Starter flow'],
      }),
      ClientView.LOBBY
    );

    expect(descriptor).toMatchObject({
      title: 'Guided setup opened',
      tone: 'default',
      targetView: ClientView.LOBBY,
    });
    expect(descriptor.detail).toContain('started the guided setup flow');
    expect(descriptor.chips).toContain('Setup active');
    expect(descriptor.chips).not.toContain('Play reopened');
  });

  it('routes starter-loop resume into the starter workspace instead of fallback view', () => {
    const targetView = resolveLocalEntryTargetView(
      buildStatus({
        eyebrow: 'Starter loop',
        workspaceLabel: 'Lab',
        targetView: ClientView.LAB,
      }),
      ClientView.LOBBY
    );

    expect(targetView).toBe(ClientView.LAB);
  });

  it('routes latest-transition resume into the recorded transition view', () => {
    const targetView = resolveLocalEntryTargetView(
      buildStatus({
        eyebrow: 'Latest transition',
        workspaceLabel: 'Settings',
        targetView: ClientView.SETTINGS,
      }),
      ClientView.LOBBY
    );

    expect(targetView).toBe(ClientView.SETTINGS);
  });

  it('falls back when the recorded transition view is no longer allowed', () => {
    const targetView = resolveLocalEntryTargetView(
      buildStatus({
        eyebrow: 'Latest transition',
        workspaceLabel: 'Admin',
        targetView: ClientView.ADMIN,
      }),
      ClientView.LOBBY,
      {
        canAccessAdmin: false,
      }
    );

    expect(targetView).toBe(ClientView.LOBBY);
  });

  it('keeps fallback view for non-starter resumes', () => {
    const targetView = resolveLocalEntryTargetView(
      buildStatus({
        eyebrow: 'Local station',
        workspaceLabel: 'Profile',
      }),
      ClientView.LOBBY
    );

    expect(targetView).toBe(ClientView.LOBBY);
  });
});
