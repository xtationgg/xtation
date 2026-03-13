export type LabProjectKind =
  | 'research'
  | 'coding'
  | 'design'
  | 'marketing'
  | 'strategy'
  | 'writing';

export type LabProjectStatus = 'active' | 'paused' | 'draft' | 'archived';
export type LabAccent = 'amber' | 'cyan' | 'emerald' | 'rose';
export type LabNoteKind = 'capture' | 'brief' | 'plan' | 'research' | 'reference';
export type LabNoteStatus = 'active' | 'draft' | 'archived';
export type LabAutomationScope = 'play' | 'lab' | 'profile' | 'multiplayer';
export type LabAutomationMode = 'manual' | 'suggest' | 'auto';
export type LabMediaPlatform = 'instagram' | 'x' | 'youtube' | 'tiktok' | 'linkedin' | 'website';
export type LabMediaAccountStatus = 'active' | 'paused' | 'watching';
export type LabCampaignStatus = 'planned' | 'active' | 'holding' | 'done';
export type LabPublishStatus = 'draft' | 'queued' | 'scheduled' | 'published';

export interface LabAssistantProject {
  id: string;
  title: string;
  kind: LabProjectKind;
  status: LabProjectStatus;
  summary: string;
  nextAction: string;
  accent: LabAccent;
  linkedQuestIds: string[];
  linkedNoteIds: string[];
  linkedAutomationIds: string[];
  linkedInventorySlotIds?: string[];
  updatedAt: number;
  createdAt: number;
}

export interface LabNote {
  id: string;
  title: string;
  content: string;
  kind: LabNoteKind;
  status: LabNoteStatus;
  pinned: boolean;
  tags: string[];
  linkedQuestIds: string[];
  linkedProjectIds: string[];
  updatedAt: number;
  createdAt: number;
}

export interface LabAutomation {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  triggerSummary: string;
  actionSummary: string;
  scope: LabAutomationScope;
  mode: LabAutomationMode;
  linkedNoteIds: string[];
  linkedProjectIds: string[];
  lastRunAt?: number;
  updatedAt: number;
  createdAt: number;
}

export interface LabTemplate {
  id: string;
  title: string;
  description: string;
  type: 'note' | 'project' | 'automation';
  accent: LabAccent;
}

export interface LabMediaAccount {
  id: string;
  platform: LabMediaPlatform;
  handle: string;
  status: LabMediaAccountStatus;
  cadence: string;
  focus: string;
  linkedProjectIds: string[];
  updatedAt: number;
  createdAt: number;
}

export interface LabMediaCampaign {
  id: string;
  title: string;
  status: LabCampaignStatus;
  objective: string;
  primaryChannel: LabMediaPlatform;
  nextAction: string;
  linkedProjectIds: string[];
  linkedNoteIds: string[];
  updatedAt: number;
  createdAt: number;
}

export interface LabPublishItem {
  id: string;
  title: string;
  status: LabPublishStatus;
  channel: LabMediaPlatform;
  scheduledAt?: number;
  campaignId?: string;
  summary: string;
  updatedAt: number;
  createdAt: number;
}

export interface LabWorkspaceState {
  assistantProjects: LabAssistantProject[];
  notes: LabNote[];
  automations: LabAutomation[];
  templates: LabTemplate[];
  mediaAccounts: LabMediaAccount[];
  mediaCampaigns: LabMediaCampaign[];
  mediaQueue: LabPublishItem[];
}
