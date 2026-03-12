import { describe, expect, it } from 'vitest';
import { normalizeLabWorkspaceState } from '../src/lab/LabProvider';

describe('lab provider normalization', () => {
  it('handles malformed/null entries in persisted arrays without crashing', () => {
    const malformedState = {
      assistantProjects: [null, undefined, { id: 'p-1', kind: 'strategy' }],
      notes: [undefined, null, { id: 'n-1', kind: 'capture' }],
      automations: [null, { id: 'a-1' }],
      templates: [undefined, { id: 't-1' }],
      mediaAccounts: [undefined, { id: 'ma-1', platform: 'x' }],
      mediaCampaigns: [null, { id: 'mc-1' }],
      mediaQueue: [undefined, { id: 'mq-1' }],
    } as any;

    const normalized = normalizeLabWorkspaceState(malformedState);

    expect(normalized.assistantProjects).toHaveLength(3);
    expect(normalized.assistantProjects[0].title).toBe('Untitled project');
    expect(normalized.notes).toHaveLength(3);
    expect(normalized.notes[0].title).toBe('Untitled note');
    expect(normalized.automations).toHaveLength(2);
    expect(normalized.automations[0].name).toBe('Untitled automation');
    expect(normalized.templates).toHaveLength(2);
    expect(normalized.templates[0].title).toBe('Untitled template');
    expect(normalized.mediaAccounts).toHaveLength(2);
    expect(normalized.mediaAccounts[0].handle).toBe('@untitled');
    expect(normalized.mediaCampaigns).toHaveLength(2);
    expect(normalized.mediaCampaigns[0].title).toBe('Untitled campaign');
    expect(normalized.mediaQueue).toHaveLength(2);
    expect(normalized.mediaQueue[0].title).toBe('Untitled queue item');
  });
});
