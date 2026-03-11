import { describe, expect, it } from 'vitest';
import {
  buildAuthTransitionPreviewDescriptor,
  buildAuthTransitionResultDescriptor,
} from '../src/auth/authTransitionDescriptor';

describe('authTransitionDescriptor', () => {
  it('builds a continuity-aware preview for guest sign-in', () => {
    const descriptor = buildAuthTransitionPreviewDescriptor({
      mode: 'login',
      fromGuestMode: true,
      workspaceLabel: 'Lab',
      continuityStatus: {
        mode: 'resume',
        eyebrow: 'Local station',
        title: 'Resume local station',
        detail: 'Resume locally.',
        workspaceLabel: 'Lab',
        connectHint: 'XTATION will review keep/import/return before any overwrite.',
        actionLabel: 'Resume',
        statusLabel: 'State',
        statusValue: 'Saved record',
        chips: ['Offline-first'],
        metrics: [],
        relayTitle: null,
      },
    });

    expect(descriptor.title).toMatch(/review local continuity/i);
    expect(descriptor.detail).toContain('Target workspace: Lab.');
    expect(descriptor.chips).toContain('Lab target');
  });

  it('builds a cloud-active result for direct google sign-in', () => {
    const descriptor = buildAuthTransitionResultDescriptor({
      mode: 'oauth',
      fromGuestMode: false,
      workspaceLabel: 'Profile',
    });

    expect(descriptor.title).toBe('Google account active');
    expect(descriptor.chips).toContain('Google sign-in');
    expect(descriptor.chips).toContain('Profile resumed');
  });
});
