import React from 'react';
import type {
  LabProjectKind,
  LabNoteKind,
  LabAutomationScope,
  LabAutomationMode,
  LabMediaPlatform,
  LabMediaAccountStatus,
  LabCampaignStatus,
  LabPublishStatus,
  LabNote,
} from '../../src/lab/types';

// --- Types ---
export type CabinetRoom = 'observatory' | 'workbench' | 'archive';
export type WorkbenchPieceType = 'note' | 'project' | 'automation';
export type ActivePiece = { type: WorkbenchPieceType; id: string } | null;
export type NoteCollection = 'all' | 'pinned' | 'linked' | 'plans' | 'baselines' | 'research';

// --- Option arrays ---
// Copy these exactly from Lab.tsx lines 88-145:
export const projectKindOptions: Array<{ value: LabProjectKind; label: string }> = [
  { value: 'research', label: 'Research' },
  { value: 'coding', label: 'Coding' },
  { value: 'design', label: 'Design' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'strategy', label: 'Strategy' },
  { value: 'writing', label: 'Writing' },
];

export const noteKindOptions: Array<{ value: LabNoteKind; label: string }> = [
  { value: 'capture', label: 'Capture' },
  { value: 'brief', label: 'Brief' },
  { value: 'plan', label: 'Plan' },
  { value: 'research', label: 'Research' },
  { value: 'reference', label: 'Reference' },
];

export const automationScopeOptions: Array<{ value: LabAutomationScope; label: string }> = [
  { value: 'play', label: 'Play' },
  { value: 'lab', label: 'Lab' },
  { value: 'profile', label: 'Profile' },
  { value: 'multiplayer', label: 'Multiplayer' },
];

export const automationModeOptions: Array<{ value: LabAutomationMode; label: string }> = [
  { value: 'manual', label: 'Manual' },
  { value: 'suggest', label: 'Suggest' },
  { value: 'auto', label: 'Auto' },
];

export const mediaPlatformOptions: Array<{ value: LabMediaPlatform; label: string }> = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'x', label: 'X' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'website', label: 'Website' },
];

export const mediaAccountStatusOptions: Array<{ value: LabMediaAccountStatus; label: string }> = [
  { value: 'active', label: 'Active' },
  { value: 'watching', label: 'Watching' },
  { value: 'paused', label: 'Paused' },
];

export const campaignStatusOptions: Array<{ value: LabCampaignStatus; label: string }> = [
  { value: 'planned', label: 'Planned' },
  { value: 'active', label: 'Active' },
  { value: 'holding', label: 'Holding' },
  { value: 'done', label: 'Done' },
];

export const publishStatusOptions: Array<{ value: LabPublishStatus; label: string }> = [
  { value: 'draft', label: 'Draft' },
  { value: 'queued', label: 'Queued' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'published', label: 'Published' },
];

// --- Accent class map ---
export const accentClass: Record<string, string> = {
  amber: 'text-[#f0c45a] border-[color-mix(in_srgb,#f0c45a_30%,transparent)] bg-[color-mix(in_srgb,#f0c45a_12%,transparent)]',
  cyan: 'text-[#6fd2ff] border-[color-mix(in_srgb,#6fd2ff_30%,transparent)] bg-[color-mix(in_srgb,#6fd2ff_12%,transparent)]',
  emerald: 'text-[#74e2b8] border-[color-mix(in_srgb,#74e2b8_30%,transparent)] bg-[color-mix(in_srgb,#74e2b8_12%,transparent)]',
  rose: 'text-[#ff8ea6] border-[color-mix(in_srgb,#ff8ea6_30%,transparent)] bg-[color-mix(in_srgb,#ff8ea6_12%,transparent)]',
};

// --- CSS class constants ---
export const sectionCard = 'xt-lab-card';
export const panelButton = 'xt-lab-action';
export const detailCard = 'xt-lab-detail-card';
export const listCard = 'xt-lab-list-card';
export const detailPanel = 'xt-lab-detail-panel';
export const iconButton = 'xt-lab-icon-button';
export const fieldInput = 'xt-lab-input';
export const fieldTextarea = 'xt-lab-textarea';
export const inlineChip = 'xt-lab-inline-chip';

// --- Utility functions ---
export const formatRelativeTime = (timestamp?: number | null) => {
  if (!timestamp) return 'Never';
  const diff = Date.now() - timestamp;
  const minutes = Math.max(1, Math.round(Math.abs(diff) / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
};

export const commaSplit = (value: string) =>
  value.split(',').map((item) => item.trim()).filter(Boolean);

export const shortText = (value: string, fallback: string, maxLength = 140) => {
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength - 3)}...` : trimmed;
};

export const toggleId = (current: string[], id: string) =>
  current.includes(id) ? current.filter((item) => item !== id) : [...current, id];

export const isBaselineNote = (note: LabNote) =>
  note.kind === 'plan' && (note.tags.includes('baseline') || note.tags.includes('managed-provider'));

export const getMediaPlatformLabel = (value: LabMediaPlatform) =>
  mediaPlatformOptions.find((option) => option.value === value)?.label || value;
