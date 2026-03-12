import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { readUserScopedJSON, writeUserScopedJSON } from '../lib/userScopedStorage';
import type {
  LabAccent,
  LabAssistantProject,
  LabAutomation,
  LabAutomationMode,
  LabAutomationScope,
  LabCampaignStatus,
  LabMediaAccount,
  LabMediaAccountStatus,
  LabMediaCampaign,
  LabMediaPlatform,
  LabNote,
  LabNoteKind,
  LabPublishItem,
  LabPublishStatus,
  LabProjectKind,
  LabTemplate,
  LabWorkspaceState,
} from './types';

const LAB_STORAGE_KEY = 'xtationLabState';

const now = () => Date.now();

const createId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const accentByKind: Record<LabProjectKind, LabAccent> = {
  research: 'cyan',
  coding: 'emerald',
  design: 'rose',
  marketing: 'amber',
  strategy: 'cyan',
  writing: 'rose',
};

const defaultTemplates: LabTemplate[] = [
  {
    id: 'template-note-daily',
    title: 'Daily Capture',
    description: 'Spin up a structured note for goals, friction, and next actions.',
    type: 'note',
    accent: 'amber',
  },
  {
    id: 'template-project-research',
    title: 'Research Brief',
    description: 'Create an assistant project for structured research with notes and linked quests.',
    type: 'project',
    accent: 'cyan',
  },
  {
    id: 'template-automation-focus',
    title: 'Focus Start',
    description: 'Enable a session-start automation that nudges Play into a calmer focus mode.',
    type: 'automation',
    accent: 'emerald',
  },
];

const normalizeStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];

const safeLabObject = <T extends object>(value: Partial<T> | null | undefined): Partial<T> =>
  value && typeof value === 'object' ? value : {};

const normalizeNote = (value: Partial<LabNote> | null | undefined): LabNote => {
  const source = safeLabObject<LabNote>(value);
  return {
    id: typeof source.id === 'string' ? source.id : createId('lab-note'),
    title: typeof source.title === 'string' && source.title.trim() ? source.title : 'Untitled note',
    content: typeof source.content === 'string' ? source.content : '',
    kind: (source.kind as LabNoteKind) || 'capture',
    status: (source.status as LabNote['status']) || 'active',
    pinned: !!source.pinned,
    tags: normalizeStringArray(source.tags),
    linkedQuestIds: normalizeStringArray(source.linkedQuestIds),
    linkedProjectIds: normalizeStringArray(source.linkedProjectIds),
    createdAt: typeof source.createdAt === 'number' ? source.createdAt : now(),
    updatedAt: typeof source.updatedAt === 'number' ? source.updatedAt : now(),
  };
};

const normalizeProject = (value: Partial<LabAssistantProject> | null | undefined): LabAssistantProject => {
  const source = safeLabObject<LabAssistantProject>(value);
  const kind = (source.kind as LabProjectKind) || 'strategy';
  return {
    id: typeof source.id === 'string' ? source.id : createId('lab-project'),
    title: typeof source.title === 'string' && source.title.trim() ? source.title : 'Untitled project',
    kind,
    status: source.status || 'draft',
    summary: typeof source.summary === 'string' ? source.summary : '',
    nextAction: typeof source.nextAction === 'string' ? source.nextAction : 'Define the next concrete step.',
    accent: source.accent || accentByKind[kind],
    linkedQuestIds: normalizeStringArray(source.linkedQuestIds),
    linkedNoteIds: normalizeStringArray(source.linkedNoteIds),
    linkedAutomationIds: normalizeStringArray(source.linkedAutomationIds),
    createdAt: typeof source.createdAt === 'number' ? source.createdAt : now(),
    updatedAt: typeof source.updatedAt === 'number' ? source.updatedAt : now(),
  };
};

const normalizeAutomation = (value: Partial<LabAutomation> | null | undefined): LabAutomation => {
  const source = safeLabObject<LabAutomation>(value);
  return {
    id: typeof source.id === 'string' ? source.id : createId('lab-rule'),
    name: typeof source.name === 'string' && source.name.trim() ? source.name : 'Untitled automation',
    description: typeof source.description === 'string' ? source.description : '',
    enabled: !!source.enabled,
    triggerSummary: typeof source.triggerSummary === 'string' ? source.triggerSummary : 'Manual trigger',
    actionSummary: typeof source.actionSummary === 'string' ? source.actionSummary : 'Prepare a suggestion',
    scope: (source.scope as LabAutomationScope) || 'lab',
    mode: (source.mode as LabAutomationMode) || 'suggest',
    linkedNoteIds: normalizeStringArray(source.linkedNoteIds),
    linkedProjectIds: normalizeStringArray(source.linkedProjectIds),
    lastRunAt: typeof source.lastRunAt === 'number' ? source.lastRunAt : undefined,
    createdAt: typeof source.createdAt === 'number' ? source.createdAt : now(),
    updatedAt: typeof source.updatedAt === 'number' ? source.updatedAt : now(),
  };
};

const normalizeMediaAccount = (
  value: Partial<LabMediaAccount> | null | undefined
): LabMediaAccount => {
  const source = safeLabObject<LabMediaAccount>(value);
  return {
    id: typeof source.id === 'string' ? source.id : createId('lab-media-account'),
    platform: (source.platform as LabMediaPlatform) || 'website',
    handle: typeof source.handle === 'string' && source.handle.trim() ? source.handle : '@untitled',
    status: (source.status as LabMediaAccountStatus) || 'active',
    cadence: typeof source.cadence === 'string' && source.cadence.trim() ? source.cadence : 'Weekly',
    focus: typeof source.focus === 'string' ? source.focus : '',
    linkedProjectIds: normalizeStringArray(source.linkedProjectIds),
    createdAt: typeof source.createdAt === 'number' ? source.createdAt : now(),
    updatedAt: typeof source.updatedAt === 'number' ? source.updatedAt : now(),
  };
};

const normalizeMediaCampaign = (
  value: Partial<LabMediaCampaign> | null | undefined
): LabMediaCampaign => {
  const source = safeLabObject<LabMediaCampaign>(value);
  return {
    id: typeof source.id === 'string' ? source.id : createId('lab-media-campaign'),
    title: typeof source.title === 'string' && source.title.trim() ? source.title : 'Untitled campaign',
    status: (source.status as LabCampaignStatus) || 'planned',
    objective: typeof source.objective === 'string' ? source.objective : '',
    primaryChannel: (source.primaryChannel as LabMediaPlatform) || 'website',
    nextAction:
      typeof source.nextAction === 'string' && source.nextAction.trim()
        ? source.nextAction
        : 'Define the next content move.',
    linkedProjectIds: normalizeStringArray(source.linkedProjectIds),
    linkedNoteIds: normalizeStringArray(source.linkedNoteIds),
    createdAt: typeof source.createdAt === 'number' ? source.createdAt : now(),
    updatedAt: typeof source.updatedAt === 'number' ? source.updatedAt : now(),
  };
};

const normalizePublishItem = (
  value: Partial<LabPublishItem> | null | undefined
): LabPublishItem => {
  const source = safeLabObject<LabPublishItem>(value);
  return {
    id: typeof source.id === 'string' ? source.id : createId('lab-media-item'),
    title: typeof source.title === 'string' && source.title.trim() ? source.title : 'Untitled queue item',
    status: (source.status as LabPublishStatus) || 'draft',
    channel: (source.channel as LabMediaPlatform) || 'website',
    scheduledAt: typeof source.scheduledAt === 'number' ? source.scheduledAt : undefined,
    campaignId:
      typeof source.campaignId === 'string' && source.campaignId.trim()
        ? source.campaignId
        : undefined,
    summary: typeof source.summary === 'string' ? source.summary : '',
    createdAt: typeof source.createdAt === 'number' ? source.createdAt : now(),
    updatedAt: typeof source.updatedAt === 'number' ? source.updatedAt : now(),
  };
};

const normalizeTemplate = (
  value: Partial<LabTemplate> | null | undefined
): LabTemplate => {
  const source = safeLabObject<LabTemplate>(value);
  const type =
    source.type === 'note' || source.type === 'project' || source.type === 'automation'
      ? source.type
      : 'note';
  const accent =
    source.accent === 'amber' || source.accent === 'cyan' || source.accent === 'emerald' || source.accent === 'rose'
      ? source.accent
      : 'cyan';
  return {
    id: typeof source.id === 'string' ? source.id : createId('lab-template'),
    title: typeof source.title === 'string' && source.title.trim() ? source.title : 'Untitled template',
    description: typeof source.description === 'string' ? source.description : '',
    type,
    accent,
  };
};

const createDefaultState = (): LabWorkspaceState => {
  const seededNoteId = createId('lab-note');
  const seededAutomationId = createId('lab-rule');
  return {
    assistantProjects: [
      normalizeProject({
        title: 'XTATION architecture',
        kind: 'strategy',
        status: 'active',
        summary: 'Keep the product architecture, section boundaries, and next build phases aligned.',
        nextAction: 'Turn the next architecture decision into one implemented screen or workflow.',
        linkedNoteIds: [seededNoteId],
        linkedAutomationIds: [seededAutomationId],
      }),
      normalizeProject({
        title: 'Play room refinement',
        kind: 'design',
        status: 'active',
        summary: 'Track improvements to the action room, session flow, and reward/debrief clarity.',
        nextAction: 'Collect one friction point from Play and convert it into a cleaner interaction.',
      }),
    ],
    notes: [
      normalizeNote({
        id: seededNoteId,
        title: 'Lab direction',
        content:
          'Lab should be the workshop of Xtation: assistant projects, knowledge notes, templates, and event-driven automations that improve Play instead of distracting from it.',
        kind: 'brief',
        pinned: true,
        tags: ['lab', 'architecture'],
      }),
      normalizeNote({
        title: 'Dusk handoff idea',
        content:
          'Turn selected note, project, or automation context into a Dusk brief so the assistant opens with useful intent instead of blank space.',
        kind: 'plan',
        tags: ['dusk', 'assistant'],
      }),
    ],
    automations: [
      normalizeAutomation({
        id: seededAutomationId,
        name: 'Quest completion recap',
        description: 'When a quest completes, queue a short debrief note in Lab for reflection and reuse.',
        enabled: true,
        triggerSummary: 'Quest completed',
        actionSummary: 'Create a recap note and prepare the next quest suggestion.',
        scope: 'play',
        mode: 'suggest',
        linkedNoteIds: [seededNoteId],
      }),
      normalizeAutomation({
        name: 'Session start focus',
        description: 'When a session starts, bias the workspace toward current quest context and hide secondary noise.',
        enabled: false,
        triggerSummary: 'Session started',
        actionSummary: 'Switch Play and Lab into a cleaner focus posture.',
        scope: 'lab',
        mode: 'auto',
      }),
    ],
    templates: defaultTemplates,
    mediaAccounts: [
      normalizeMediaAccount({
        platform: 'x',
        handle: '@xtationhq',
        status: 'watching',
        cadence: '3x weekly',
        focus: 'Product signals and build updates',
      }),
      normalizeMediaAccount({
        platform: 'linkedin',
        handle: 'xtation-studio',
        status: 'active',
        cadence: 'Weekly',
        focus: 'Professional positioning and roadmap updates',
      }),
    ],
    mediaCampaigns: [
      normalizeMediaCampaign({
        title: 'Launch rhythm',
        status: 'active',
        objective: 'Ship consistent product logs and feature reveals without losing execution focus.',
        primaryChannel: 'x',
        nextAction: 'Turn the next build milestone into one public-facing recap.',
      }),
    ],
    mediaQueue: [
      normalizePublishItem({
        title: 'Play + Lab update log',
        status: 'queued',
        channel: 'x',
        summary: 'Short thread on Play v1 and Lab improvements with one screenshot and one next-step teaser.',
      }),
    ],
  };
};

export const normalizeLabWorkspaceState = (
  stored: LabWorkspaceState | null | undefined
): LabWorkspaceState => {
  if (!stored) return createDefaultState();
  const normalizedTemplates = Array.isArray(stored.templates)
    ? stored.templates.map((template) => normalizeTemplate(template))
    : [];
  return {
    assistantProjects: Array.isArray(stored.assistantProjects)
      ? stored.assistantProjects.map((project) => normalizeProject(project))
      : [],
    notes: Array.isArray(stored.notes) ? stored.notes.map((note) => normalizeNote(note)) : [],
    automations: Array.isArray(stored.automations)
      ? stored.automations.map((automation) => normalizeAutomation(automation))
      : [],
    templates: normalizedTemplates.length ? normalizedTemplates : defaultTemplates,
    mediaAccounts: Array.isArray(stored.mediaAccounts)
      ? stored.mediaAccounts.map((account) => normalizeMediaAccount(account))
      : [],
    mediaCampaigns: Array.isArray(stored.mediaCampaigns)
      ? stored.mediaCampaigns.map((campaign) => normalizeMediaCampaign(campaign))
      : [],
    mediaQueue: Array.isArray(stored.mediaQueue)
      ? stored.mediaQueue.map((item) => normalizePublishItem(item))
      : [],
  };
};

interface LabContextValue extends LabWorkspaceState {
  addNote: (
    payload: Pick<LabNote, 'title' | 'content' | 'tags' | 'linkedQuestIds'> &
      Partial<Pick<LabNote, 'kind' | 'status' | 'pinned' | 'linkedProjectIds'>>
  ) => string;
  updateNote: (
    id: string,
    patch: Partial<Pick<LabNote, 'title' | 'content' | 'tags' | 'linkedQuestIds' | 'kind' | 'status' | 'pinned' | 'linkedProjectIds'>>
  ) => void;
  deleteNote: (id: string) => void;
  addAssistantProject: (
    payload: Pick<LabAssistantProject, 'title' | 'kind' | 'summary'> &
      Partial<Pick<LabAssistantProject, 'nextAction' | 'accent'>>
  ) => string;
  updateAssistantProject: (
    id: string,
    patch: Partial<
      Pick<
        LabAssistantProject,
        'title' | 'kind' | 'summary' | 'status' | 'linkedQuestIds' | 'linkedNoteIds' | 'linkedAutomationIds' | 'nextAction' | 'accent'
      >
    >
  ) => void;
  deleteAssistantProject: (id: string) => void;
  addAutomation: (
    payload: Pick<LabAutomation, 'name' | 'description' | 'triggerSummary' | 'actionSummary' | 'scope'> &
      Partial<Pick<LabAutomation, 'mode' | 'linkedNoteIds' | 'linkedProjectIds'>>
  ) => string;
  updateAutomation: (
    id: string,
    patch: Partial<
      Pick<
        LabAutomation,
        'name' | 'description' | 'triggerSummary' | 'actionSummary' | 'scope' | 'mode' | 'enabled' | 'linkedNoteIds' | 'linkedProjectIds'
      >
    >
  ) => void;
  toggleAutomation: (id: string) => void;
  runAutomation: (id: string) => void;
  deleteAutomation: (id: string) => void;
  applyTemplate: (id: string) => void;
  addMediaAccount: (
    payload: Pick<LabMediaAccount, 'platform' | 'handle' | 'cadence' | 'focus'> &
      Partial<Pick<LabMediaAccount, 'status' | 'linkedProjectIds'>>
  ) => string;
  updateMediaAccount: (
    id: string,
    patch: Partial<Pick<LabMediaAccount, 'platform' | 'handle' | 'status' | 'cadence' | 'focus' | 'linkedProjectIds'>>
  ) => void;
  deleteMediaAccount: (id: string) => void;
  addMediaCampaign: (
    payload: Pick<LabMediaCampaign, 'title' | 'objective' | 'primaryChannel' | 'nextAction'> &
      Partial<Pick<LabMediaCampaign, 'status' | 'linkedProjectIds' | 'linkedNoteIds'>>
  ) => string;
  updateMediaCampaign: (
    id: string,
    patch: Partial<
      Pick<LabMediaCampaign, 'title' | 'status' | 'objective' | 'primaryChannel' | 'nextAction' | 'linkedProjectIds' | 'linkedNoteIds'>
    >
  ) => void;
  deleteMediaCampaign: (id: string) => void;
  addMediaQueueItem: (
    payload: Pick<LabPublishItem, 'title' | 'channel' | 'summary'> &
      Partial<Pick<LabPublishItem, 'status' | 'scheduledAt' | 'campaignId'>>
  ) => string;
  updateMediaQueueItem: (
    id: string,
    patch: Partial<Pick<LabPublishItem, 'title' | 'status' | 'channel' | 'summary' | 'scheduledAt' | 'campaignId'>>
  ) => void;
  deleteMediaQueueItem: (id: string) => void;
}

const LabContext = createContext<LabContextValue | null>(null);

export const useLab = () => {
  const ctx = useContext(LabContext);
  if (!ctx) throw new Error('useLab must be used within LabProvider');
  return ctx;
};

export const useOptionalLab = () => useContext(LabContext);

const GUEST_SCOPE_ID = 'anon';

export const LabProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const scopeId = user?.id || GUEST_SCOPE_ID;
  const [state, setState] = useState<LabWorkspaceState>(() => createDefaultState());

  useEffect(() => {
    const stored = readUserScopedJSON<LabWorkspaceState | null>(LAB_STORAGE_KEY, null, scopeId);
    const next = normalizeLabWorkspaceState(stored);
    setState(next);
    writeUserScopedJSON(LAB_STORAGE_KEY, next, scopeId);
  }, [scopeId]);

  useEffect(() => {
    writeUserScopedJSON(LAB_STORAGE_KEY, state, scopeId);
  }, [state, scopeId]);

  const value = useMemo<LabContextValue>(
    () => ({
      ...state,
      addNote: (payload) => {
        const note = normalizeNote({
          title: payload.title,
          content: payload.content,
          kind: payload.kind || 'capture',
          status: payload.status || 'active',
          pinned: payload.pinned,
          tags: payload.tags,
          linkedQuestIds: payload.linkedQuestIds,
          linkedProjectIds: payload.linkedProjectIds,
        });
        setState((prev) => ({ ...prev, notes: [note, ...prev.notes] }));
        return note.id;
      },
      updateNote: (id, patch) => {
        setState((prev) => ({
          ...prev,
          notes: prev.notes.map((note) =>
            note.id === id
              ? normalizeNote({
                  ...note,
                  ...patch,
                  updatedAt: now(),
                })
              : note
          ),
        }));
      },
      deleteNote: (id) => {
        setState((prev) => ({
          ...prev,
          notes: prev.notes.filter((note) => note.id !== id),
          assistantProjects: prev.assistantProjects.map((project) =>
            normalizeProject({
              ...project,
              linkedNoteIds: project.linkedNoteIds.filter((noteId) => noteId !== id),
            })
          ),
          automations: prev.automations.map((automation) =>
            normalizeAutomation({
              ...automation,
              linkedNoteIds: automation.linkedNoteIds.filter((noteId) => noteId !== id),
            })
          ),
          mediaCampaigns: prev.mediaCampaigns.map((campaign) =>
            normalizeMediaCampaign({
              ...campaign,
              linkedNoteIds: campaign.linkedNoteIds.filter((noteId) => noteId !== id),
            })
          ),
        }));
      },
      addAssistantProject: (payload) => {
        const project = normalizeProject({
          title: payload.title,
          kind: payload.kind,
          status: 'active',
          summary: payload.summary,
          nextAction: payload.nextAction,
          accent: payload.accent || accentByKind[payload.kind],
        });
        setState((prev) => ({ ...prev, assistantProjects: [project, ...prev.assistantProjects] }));
        return project.id;
      },
      updateAssistantProject: (id, patch) => {
        setState((prev) => ({
          ...prev,
          assistantProjects: prev.assistantProjects.map((project) =>
            project.id === id
              ? normalizeProject({
                  ...project,
                  ...patch,
                  accent: patch.kind ? accentByKind[patch.kind] : patch.accent || project.accent,
                  updatedAt: now(),
                })
              : project
          ),
        }));
      },
      deleteAssistantProject: (id) => {
        setState((prev) => ({
          ...prev,
          assistantProjects: prev.assistantProjects.filter((project) => project.id !== id),
          notes: prev.notes.map((note) =>
            normalizeNote({
              ...note,
              linkedProjectIds: note.linkedProjectIds.filter((projectId) => projectId !== id),
            })
          ),
          automations: prev.automations.map((automation) =>
            normalizeAutomation({
              ...automation,
              linkedProjectIds: automation.linkedProjectIds.filter((projectId) => projectId !== id),
            })
          ),
          mediaAccounts: prev.mediaAccounts.map((account) =>
            normalizeMediaAccount({
              ...account,
              linkedProjectIds: account.linkedProjectIds.filter((projectId) => projectId !== id),
            })
          ),
          mediaCampaigns: prev.mediaCampaigns.map((campaign) =>
            normalizeMediaCampaign({
              ...campaign,
              linkedProjectIds: campaign.linkedProjectIds.filter((projectId) => projectId !== id),
            })
          ),
        }));
      },
      addAutomation: (payload) => {
        const automation = normalizeAutomation({
          name: payload.name,
          description: payload.description,
          enabled: true,
          triggerSummary: payload.triggerSummary,
          actionSummary: payload.actionSummary,
          scope: payload.scope,
          mode: payload.mode || 'suggest',
          linkedNoteIds: payload.linkedNoteIds || [],
          linkedProjectIds: payload.linkedProjectIds || [],
        });
        setState((prev) => ({ ...prev, automations: [automation, ...prev.automations] }));
        return automation.id;
      },
      updateAutomation: (id, patch) => {
        setState((prev) => ({
          ...prev,
          automations: prev.automations.map((automation) =>
            automation.id === id
              ? normalizeAutomation({
                  ...automation,
                  ...patch,
                  updatedAt: now(),
                })
              : automation
          ),
        }));
      },
      toggleAutomation: (id) => {
        setState((prev) => ({
          ...prev,
          automations: prev.automations.map((automation) =>
            automation.id === id
              ? normalizeAutomation({
                  ...automation,
                  enabled: !automation.enabled,
                  updatedAt: now(),
                })
              : automation
          ),
        }));
      },
      runAutomation: (id) => {
        setState((prev) => ({
          ...prev,
          automations: prev.automations.map((automation) =>
            automation.id === id
              ? normalizeAutomation({
                  ...automation,
                  lastRunAt: now(),
                  updatedAt: now(),
                })
              : automation
          ),
        }));
      },
      deleteAutomation: (id) => {
        setState((prev) => ({
          ...prev,
          automations: prev.automations.filter((automation) => automation.id !== id),
          assistantProjects: prev.assistantProjects.map((project) =>
            normalizeProject({
              ...project,
              linkedAutomationIds: project.linkedAutomationIds.filter((automationId) => automationId !== id),
            })
          ),
        }));
      },
      applyTemplate: (id) => {
        const template = state.templates.find((item) => item.id === id);
        if (!template) return;
        if (template.type === 'note') {
          const note = normalizeNote({
            title: template.title,
            content: 'Goals:\n\nFriction:\n\nNext actions:\n',
            kind: 'plan',
            tags: ['template'],
          });
          setState((prev) => ({ ...prev, notes: [note, ...prev.notes] }));
          return;
        }
        if (template.type === 'project') {
          const project = normalizeProject({
            title: template.title,
            kind: 'research',
            status: 'draft',
            summary: 'Template-born project. Fill in the context and connect notes or quests.',
            nextAction: 'Define the target output and the first research pass.',
            accent: template.accent,
          });
          setState((prev) => ({ ...prev, assistantProjects: [project, ...prev.assistantProjects] }));
          return;
        }
        const rule = normalizeAutomation({
          name: template.title,
          description: template.description,
          enabled: false,
          triggerSummary: 'Template trigger',
          actionSummary: 'Template action',
          scope: 'lab',
          mode: 'suggest',
        });
        setState((prev) => ({ ...prev, automations: [rule, ...prev.automations] }));
      },
      addMediaAccount: (payload) => {
        const account = normalizeMediaAccount({
          platform: payload.platform,
          handle: payload.handle,
          status: payload.status || 'active',
          cadence: payload.cadence,
          focus: payload.focus,
          linkedProjectIds: payload.linkedProjectIds || [],
        });
        setState((prev) => ({ ...prev, mediaAccounts: [account, ...prev.mediaAccounts] }));
        return account.id;
      },
      updateMediaAccount: (id, patch) => {
        setState((prev) => ({
          ...prev,
          mediaAccounts: prev.mediaAccounts.map((account) =>
            account.id === id
              ? normalizeMediaAccount({
                  ...account,
                  ...patch,
                  updatedAt: now(),
                })
              : account
          ),
        }));
      },
      deleteMediaAccount: (id) => {
        setState((prev) => ({
          ...prev,
          mediaAccounts: prev.mediaAccounts.filter((account) => account.id !== id),
        }));
      },
      addMediaCampaign: (payload) => {
        const campaign = normalizeMediaCampaign({
          title: payload.title,
          objective: payload.objective,
          primaryChannel: payload.primaryChannel,
          nextAction: payload.nextAction,
          status: payload.status || 'planned',
          linkedProjectIds: payload.linkedProjectIds || [],
          linkedNoteIds: payload.linkedNoteIds || [],
        });
        setState((prev) => ({ ...prev, mediaCampaigns: [campaign, ...prev.mediaCampaigns] }));
        return campaign.id;
      },
      updateMediaCampaign: (id, patch) => {
        setState((prev) => ({
          ...prev,
          mediaCampaigns: prev.mediaCampaigns.map((campaign) =>
            campaign.id === id
              ? normalizeMediaCampaign({
                  ...campaign,
                  ...patch,
                  updatedAt: now(),
                })
              : campaign
          ),
        }));
      },
      deleteMediaCampaign: (id) => {
        setState((prev) => ({
          ...prev,
          mediaCampaigns: prev.mediaCampaigns.filter((campaign) => campaign.id !== id),
          mediaQueue: prev.mediaQueue.map((item) =>
            item.campaignId === id
              ? normalizePublishItem({
                  ...item,
                  campaignId: undefined,
                })
              : item
          ),
        }));
      },
      addMediaQueueItem: (payload) => {
        const item = normalizePublishItem({
          title: payload.title,
          channel: payload.channel,
          summary: payload.summary,
          status: payload.status || 'draft',
          scheduledAt: payload.scheduledAt,
          campaignId: payload.campaignId,
        });
        setState((prev) => ({ ...prev, mediaQueue: [item, ...prev.mediaQueue] }));
        return item.id;
      },
      updateMediaQueueItem: (id, patch) => {
        setState((prev) => ({
          ...prev,
          mediaQueue: prev.mediaQueue.map((item) =>
            item.id === id
              ? normalizePublishItem({
                  ...item,
                  ...patch,
                  updatedAt: now(),
                })
              : item
          ),
        }));
      },
      deleteMediaQueueItem: (id) => {
        setState((prev) => ({
          ...prev,
          mediaQueue: prev.mediaQueue.filter((item) => item.id !== id),
        }));
      },
    }),
    [state]
  );

  return <LabContext.Provider value={value}>{children}</LabContext.Provider>;
};
