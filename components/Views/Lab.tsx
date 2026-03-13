import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Bot,
  CalendarClock,
  CheckCircle2,
  Clock3,
  FileText,
  FolderKanban,
  LayoutGrid,
  Link2,
  Megaphone,
  Pause,
  Pin,
  PlayCircle,
  Plus,
  Radio,
  Send,
  Sparkles,
  Trash2,
  WandSparkles,
  Workflow,
} from 'lucide-react';
import { useXP } from '../XP/xpStore';
import { ClientView } from '../../types';
import { useLab } from '../../src/lab/LabProvider';
import { openDuskBrief } from '../../src/dusk/bridge';
import { useLatestDuskBrief } from '../../src/dusk/useLatestDuskBrief';
import { useXtationSettings } from '../../src/settings/SettingsProvider';
import {
  clearPendingLabNavigation,
  LAB_NAVIGATION_EVENT,
  openLabNavigation,
  readPendingLabNavigation,
  type LabNavigationPayload,
} from '../../src/lab/bridge';
import {
  clearPendingStarterWorkspaceAction,
  clearPendingStarterWorkspaceCue,
  describeStarterWorkspaceAction,
  dismissStarterWorkspaceCue,
  formatStarterWorkspaceCueEyebrow,
  openStarterWorkspaceAction,
  readPendingStarterWorkspaceAction,
  STARTER_WORKSPACE_DISMISS_EVENT,
  STARTER_WORKSPACE_ACTION_EVENT,
  readPendingStarterWorkspaceCue,
  STARTER_WORKSPACE_CUE_EVENT,
  type XtationStarterWorkspaceActionTarget,
  type XtationStarterWorkspaceCue,
} from '../../src/onboarding/workspaceCue';
import { openPlayNavigation } from '../../src/play/bridge';
import { diffBaselineNote, summarizeBaselineDrift } from '../../src/lab/baselineDiff';
import { buildBaselineCompareHandoff, buildBaselineProvenanceHandoff } from '../../src/lab/baselineHandoff';
import {
  buildBaselineDecisionAnchor,
  formatBaselineProvenanceProvider,
  parseBaselineNoteProvenance,
} from '../../src/lab/baselineProvenance';
import type {
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
} from '../../src/lab/types';

type LabSection = 'workspace' | 'assistants' | 'knowledge' | 'automations' | 'media' | 'templates';
type NoteCollection = 'all' | 'pinned' | 'linked' | 'plans' | 'baselines' | 'research';

const projectKindOptions: Array<{ value: LabProjectKind; label: string }> = [
  { value: 'research', label: 'Research' },
  { value: 'coding', label: 'Coding' },
  { value: 'design', label: 'Design' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'strategy', label: 'Strategy' },
  { value: 'writing', label: 'Writing' },
];

const noteKindOptions: Array<{ value: LabNoteKind; label: string }> = [
  { value: 'capture', label: 'Capture' },
  { value: 'brief', label: 'Brief' },
  { value: 'plan', label: 'Plan' },
  { value: 'research', label: 'Research' },
  { value: 'reference', label: 'Reference' },
];

const automationScopeOptions: Array<{ value: LabAutomationScope; label: string }> = [
  { value: 'play', label: 'Play' },
  { value: 'lab', label: 'Lab' },
  { value: 'profile', label: 'Profile' },
  { value: 'multiplayer', label: 'Multiplayer' },
];

const automationModeOptions: Array<{ value: LabAutomationMode; label: string }> = [
  { value: 'manual', label: 'Manual' },
  { value: 'suggest', label: 'Suggest' },
  { value: 'auto', label: 'Auto' },
];

const mediaPlatformOptions: Array<{ value: LabMediaPlatform; label: string }> = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'x', label: 'X' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'website', label: 'Website' },
];

const mediaAccountStatusOptions: Array<{ value: LabMediaAccountStatus; label: string }> = [
  { value: 'active', label: 'Active' },
  { value: 'watching', label: 'Watching' },
  { value: 'paused', label: 'Paused' },
];

const campaignStatusOptions: Array<{ value: LabCampaignStatus; label: string }> = [
  { value: 'planned', label: 'Planned' },
  { value: 'active', label: 'Active' },
  { value: 'holding', label: 'Holding' },
  { value: 'done', label: 'Done' },
];

const publishStatusOptions: Array<{ value: LabPublishStatus; label: string }> = [
  { value: 'draft', label: 'Draft' },
  { value: 'queued', label: 'Queued' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'published', label: 'Published' },
];

const accentClass: Record<string, string> = {
  amber: 'text-[#f0c45a] border-[color-mix(in_srgb,#f0c45a_30%,transparent)] bg-[color-mix(in_srgb,#f0c45a_12%,transparent)]',
  cyan: 'text-[#6fd2ff] border-[color-mix(in_srgb,#6fd2ff_30%,transparent)] bg-[color-mix(in_srgb,#6fd2ff_12%,transparent)]',
  emerald: 'text-[#74e2b8] border-[color-mix(in_srgb,#74e2b8_30%,transparent)] bg-[color-mix(in_srgb,#74e2b8_12%,transparent)]',
  rose: 'text-[#ff8ea6] border-[color-mix(in_srgb,#ff8ea6_30%,transparent)] bg-[color-mix(in_srgb,#ff8ea6_12%,transparent)]',
};

const sectionMeta: Array<{ id: LabSection; label: string; icon: React.ReactNode; hint: string }> = [
  { id: 'workspace', label: 'Workspace', icon: <LayoutGrid size={14} />, hint: 'Command deck and next actions' },
  { id: 'assistants', label: 'Assistants', icon: <Bot size={14} />, hint: 'Structured project contexts' },
  { id: 'knowledge', label: 'Knowledge', icon: <FileText size={14} />, hint: 'Notes, captures, and linked context' },
  { id: 'automations', label: 'Automations', icon: <Workflow size={14} />, hint: 'Rules, triggers, and action flows' },
  { id: 'media', label: 'Media Ops', icon: <Megaphone size={14} />, hint: 'Accounts, campaigns, and publishing queue' },
  { id: 'templates', label: 'Templates', icon: <WandSparkles size={14} />, hint: 'Reusable starting points' },
];

const sectionCard = 'xt-lab-card';
const panelButton = 'xt-lab-action';
const detailCard = 'xt-lab-detail-card';
const listCard = 'xt-lab-list-card';
const detailPanel = 'xt-lab-detail-panel';
const iconButton = 'xt-lab-icon-button';
const fieldInput = 'xt-lab-input';
const fieldTextarea = 'xt-lab-textarea';
const inlineChip = 'xt-lab-inline-chip';

const SummaryTile: React.FC<{ label: string; value: string; icon: React.ReactNode }> = ({ label, value, icon }) => (
  <div className="xt-lab-summary px-4 py-4">
    <div className="flex items-center justify-between gap-3">
      <div>
        <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--app-muted)]">{label}</div>
        <div className="mt-2 text-2xl font-semibold text-[var(--app-text)]">{value}</div>
      </div>
      <div className="xt-lab-summary-icon">
        {icon}
      </div>
    </div>
  </div>
);

const MiniStat: React.FC<{ label: string; value: string; accent?: string }> = ({ label, value, accent }) => (
  <div className="xt-lab-mini-stat px-3 py-3">
    <div className={`text-lg font-semibold ${accent || 'text-[var(--app-text)]'}`}>{value}</div>
    <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">{label}</div>
  </div>
);

const SectionPill: React.FC<{
  label: string;
  hint: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}> = ({ label, hint, icon, active, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`xt-lab-section-pill px-4 py-3 text-left transition-colors ${
      active
        ? 'border-[var(--app-accent)] bg-[color-mix(in_srgb,var(--app-accent)_12%,transparent)]'
        : 'border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_78%,transparent)] hover:border-[var(--app-accent)]'
    }`}
  >
    <div className="flex items-center gap-2 text-[var(--app-text)]">
      {icon}
      <span className="text-sm font-medium">{label}</span>
    </div>
    <div className="mt-1 text-[11px] leading-5 text-[var(--app-muted)]">{hint}</div>
  </button>
);

const formatRelativeTime = (timestamp?: number | null) => {
  if (!timestamp) return 'Never';
  const diff = Date.now() - timestamp;
  const minutes = Math.max(1, Math.round(Math.abs(diff) / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
};

const commaSplit = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const shortText = (value: string, fallback: string) => {
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  return trimmed.length > 140 ? `${trimmed.slice(0, 137)}...` : trimmed;
};

const toggleId = (current: string[], id: string) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);

const isBaselineNote = (note: LabNote) =>
  note.kind === 'plan' && (note.tags.includes('baseline') || note.tags.includes('managed-provider'));

const formatSchedule = (timestamp?: number) => {
  if (!timestamp) return 'No time set';
  return new Date(timestamp).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getMediaPlatformLabel = (value: LabMediaPlatform) =>
  mediaPlatformOptions.find((option) => option.value === value)?.label || value;

const toDateTimeLocalValue = (timestamp?: number) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  const hours = `${date.getHours()}`.padStart(2, '0');
  const minutes = `${date.getMinutes()}`.padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const parseDateTimeLocalValue = (value: string) => {
  if (!value.trim()) return undefined;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : undefined;
};

export const Lab: React.FC = () => {
  const { selectors, dateKey, now, tasks, projects, addTask } = useXP();
  const { settings } = useXtationSettings();
  const {
    assistantProjects,
    automations,
    mediaAccounts,
    mediaCampaigns,
    mediaQueue,
    notes,
    templates,
    addNote,
    updateNote,
    deleteNote,
    addAssistantProject,
    updateAssistantProject,
    deleteAssistantProject,
    addAutomation,
    updateAutomation,
    toggleAutomation,
    runAutomation,
    deleteAutomation,
    applyTemplate,
    addMediaAccount,
    updateMediaAccount,
    deleteMediaAccount,
    addMediaCampaign,
    updateMediaCampaign,
    deleteMediaCampaign,
    addMediaQueueItem,
    updateMediaQueueItem,
    deleteMediaQueueItem,
  } = useLab();
  const latestBrief = useLatestDuskBrief();

  const [activeSection, setActiveSection] = useState<LabSection>('workspace');
  const [noteCollection, setNoteCollection] = useState<NoteCollection>('all');
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(notes[0]?.id ?? null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(assistantProjects[0]?.id ?? null);
  const [selectedAutomationId, setSelectedAutomationId] = useState<string | null>(automations[0]?.id ?? null);
  const [selectedMediaAccountId, setSelectedMediaAccountId] = useState<string | null>(mediaAccounts[0]?.id ?? null);
  const [selectedMediaCampaignId, setSelectedMediaCampaignId] = useState<string | null>(mediaCampaigns[0]?.id ?? null);
  const [selectedMediaQueueId, setSelectedMediaQueueId] = useState<string | null>(mediaQueue[0]?.id ?? null);
  const [starterWorkspaceCue, setStarterWorkspaceCue] = useState<XtationStarterWorkspaceCue | null>(null);
  const [starterWorkspaceActionNotice, setStarterWorkspaceActionNotice] = useState<{
    title: string;
    detail: string;
  } | null>(null);
  const applyStarterWorkspaceAction = useCallback((target: XtationStarterWorkspaceActionTarget) => {
    if (target === 'lab:knowledge') {
      setActiveSection('knowledge');
      setNoteCollection('plans');
      return;
    }

    setActiveSection('workspace');
  }, []);

  const [draftNoteTitle, setDraftNoteTitle] = useState('');
  const [draftNoteContent, setDraftNoteContent] = useState('');
  const [draftProjectTitle, setDraftProjectTitle] = useState('');
  const [draftProjectSummary, setDraftProjectSummary] = useState('');
  const [draftProjectKind, setDraftProjectKind] = useState<LabProjectKind>('strategy');
  const [draftAutomationName, setDraftAutomationName] = useState('');
  const [draftAutomationDescription, setDraftAutomationDescription] = useState('');
  const [draftAutomationTrigger, setDraftAutomationTrigger] = useState('');
  const [draftAutomationAction, setDraftAutomationAction] = useState('');
  const [draftAutomationScope, setDraftAutomationScope] = useState<LabAutomationScope>('lab');
  const [draftAutomationMode, setDraftAutomationMode] = useState<LabAutomationMode>('suggest');
  const [draftMediaHandle, setDraftMediaHandle] = useState('');
  const [draftMediaPlatform, setDraftMediaPlatform] = useState<LabMediaPlatform>('x');
  const [draftMediaFocus, setDraftMediaFocus] = useState('');
  const [draftCampaignTitle, setDraftCampaignTitle] = useState('');
  const [draftCampaignObjective, setDraftCampaignObjective] = useState('');
  const [draftCampaignChannel, setDraftCampaignChannel] = useState<LabMediaPlatform>('x');
  const [draftQueueTitle, setDraftQueueTitle] = useState('');
  const [draftQueueSummary, setDraftQueueSummary] = useState('');
  const [draftQueueChannel, setDraftQueueChannel] = useState<LabMediaPlatform>('x');

  const activeQuest = selectors.getActiveSession()
    ? tasks.find((task) => {
        const session = selectors.getActiveSession();
        return session && [session.taskId, ...(session.linkedTaskIds || [])].includes(task.id);
      }) ?? null
    : selectors.getActiveTasks()[0] ?? null;

  const activeProjectsCount = assistantProjects.filter((project) => project.status === 'active').length;
  const enabledAutomations = automations.filter((automation) => automation.enabled).length;
  const pinnedNotes = notes.filter((note) => note.pinned).length;
  const todayMinutes = selectors.getTrackedMinutesForDay(dateKey, now);
  const briefStackEnabled = settings.unlocks.activeWidgetIds.includes('widget-brief-stack');
  const knowledgeGraphEnabled = settings.unlocks.activeLabModuleIds.includes('lab-knowledge-graph');
  const mediaOpsEnabled = settings.unlocks.activeLabModuleIds.includes('lab-media-ops');
  const visibleSections = useMemo(
    () => sectionMeta.filter((section) => section.id !== 'media' || mediaOpsEnabled),
    [mediaOpsEnabled]
  );

  const filteredNotes = useMemo(() => {
    switch (noteCollection) {
      case 'pinned':
        return notes.filter((note) => note.pinned);
      case 'linked':
        return notes.filter((note) => note.linkedQuestIds.length || note.linkedProjectIds.length);
      case 'plans':
        return notes.filter((note) => note.kind === 'plan' || note.kind === 'brief');
      case 'baselines':
        return [...notes.filter((note) => isBaselineNote(note))].sort((a, b) => b.updatedAt - a.updatedAt);
      case 'research':
        return notes.filter((note) => note.kind === 'research' || note.tags.includes('research'));
      default:
        return notes;
    }
  }, [noteCollection, notes]);

  useEffect(() => {
    if (!filteredNotes.length) {
      setSelectedNoteId(null);
      return;
    }
    if (!selectedNoteId || !filteredNotes.some((note) => note.id === selectedNoteId)) {
      setSelectedNoteId(filteredNotes[0].id);
    }
  }, [filteredNotes, selectedNoteId]);

  useEffect(() => {
    if (!assistantProjects.length) {
      setSelectedProjectId(null);
      return;
    }
    if (!selectedProjectId || !assistantProjects.some((project) => project.id === selectedProjectId)) {
      setSelectedProjectId(assistantProjects[0].id);
    }
  }, [assistantProjects, selectedProjectId]);

  useEffect(() => {
    if (!automations.length) {
      setSelectedAutomationId(null);
      return;
    }
    if (!selectedAutomationId || !automations.some((automation) => automation.id === selectedAutomationId)) {
      setSelectedAutomationId(automations[0].id);
    }
  }, [automations, selectedAutomationId]);

  useEffect(() => {
    if (!mediaOpsEnabled && activeSection === 'media') {
      setActiveSection('workspace');
    }
  }, [activeSection, mediaOpsEnabled]);

  useEffect(() => {
    if (!mediaAccounts.length) {
      setSelectedMediaAccountId(null);
      return;
    }
    if (!selectedMediaAccountId || !mediaAccounts.some((account) => account.id === selectedMediaAccountId)) {
      setSelectedMediaAccountId(mediaAccounts[0].id);
    }
  }, [mediaAccounts, selectedMediaAccountId]);

  useEffect(() => {
    if (!mediaCampaigns.length) {
      setSelectedMediaCampaignId(null);
      return;
    }
    if (!selectedMediaCampaignId || !mediaCampaigns.some((campaign) => campaign.id === selectedMediaCampaignId)) {
      setSelectedMediaCampaignId(mediaCampaigns[0].id);
    }
  }, [mediaCampaigns, selectedMediaCampaignId]);

  useEffect(() => {
    if (!mediaQueue.length) {
      setSelectedMediaQueueId(null);
      return;
    }
    if (!selectedMediaQueueId || !mediaQueue.some((item) => item.id === selectedMediaQueueId)) {
      setSelectedMediaQueueId(mediaQueue[0].id);
    }
  }, [mediaQueue, selectedMediaQueueId]);

  const selectedNote = useMemo(
    () => filteredNotes.find((note) => note.id === selectedNoteId) ?? filteredNotes[0] ?? null,
    [filteredNotes, selectedNoteId]
  );
  const selectedProject = useMemo(
    () => assistantProjects.find((project) => project.id === selectedProjectId) ?? assistantProjects[0] ?? null,
    [assistantProjects, selectedProjectId]
  );
  const selectedAutomation = useMemo(
    () => automations.find((automation) => automation.id === selectedAutomationId) ?? automations[0] ?? null,
    [automations, selectedAutomationId]
  );
  const selectedMediaAccount = useMemo(
    () => mediaAccounts.find((account) => account.id === selectedMediaAccountId) ?? mediaAccounts[0] ?? null,
    [mediaAccounts, selectedMediaAccountId]
  );
  const selectedMediaCampaign = useMemo(
    () => mediaCampaigns.find((campaign) => campaign.id === selectedMediaCampaignId) ?? mediaCampaigns[0] ?? null,
    [mediaCampaigns, selectedMediaCampaignId]
  );
  const selectedMediaQueueItem = useMemo(
    () => mediaQueue.find((item) => item.id === selectedMediaQueueId) ?? mediaQueue[0] ?? null,
    [mediaQueue, selectedMediaQueueId]
  );

  const workspaceLeadProject = selectedProject ?? assistantProjects[0] ?? null;
  const workspaceLeadNote = selectedNote ?? notes[0] ?? null;
  const workspaceLeadAutomation = selectedAutomation ?? automations[0] ?? null;
  const baselineNotes = useMemo(
    () => notes.filter((note) => isBaselineNote(note)).sort((a, b) => b.updatedAt - a.updatedAt),
    [notes]
  );
  const baselineProvenanceById = useMemo(
    () => new Map(baselineNotes.map((note) => [note.id, parseBaselineNoteProvenance(note)] as const)),
    [baselineNotes]
  );
  const latestBaselineNote = baselineNotes[0] ?? null;
  const latestBaselineProvenance = latestBaselineNote ? baselineProvenanceById.get(latestBaselineNote.id) || null : null;
  const latestBaselineDecisionAnchor = buildBaselineDecisionAnchor(latestBaselineProvenance);
  const baselineTimelineNotes = baselineNotes.slice(0, 5);
  const selectedBaselineIndex =
    selectedNote && isBaselineNote(selectedNote) ? baselineNotes.findIndex((note) => note.id === selectedNote.id) : -1;
  const newerBaseline = selectedBaselineIndex > 0 ? baselineNotes[selectedBaselineIndex - 1] : null;
  const olderBaseline =
    selectedBaselineIndex >= 0 && selectedBaselineIndex < baselineNotes.length - 1 ? baselineNotes[selectedBaselineIndex + 1] : null;
  const baselineDriftFromPrevious =
    selectedNote && isBaselineNote(selectedNote) && olderBaseline ? diffBaselineNote(selectedNote, olderBaseline) : null;
  const selectedBaselineProvenance =
    selectedNote && isBaselineNote(selectedNote) ? baselineProvenanceById.get(selectedNote.id) || null : null;
  const selectedBaselineDecisionAnchor = buildBaselineDecisionAnchor(selectedBaselineProvenance);
  const newerBaselineProvenance = newerBaseline ? baselineProvenanceById.get(newerBaseline.id) || null : null;
  const olderBaselineProvenance = olderBaseline ? baselineProvenanceById.get(olderBaseline.id) || null : null;
  const topTasks = selectors.getTopTasksForDay(dateKey, 4, now);
  const knowledgeNodes = notes.length + assistantProjects.length + automations.length;
  const knowledgeEdges = useMemo(
    () =>
      notes.reduce((sum, note) => sum + note.linkedQuestIds.length + note.linkedProjectIds.length + note.tags.length, 0) +
      assistantProjects.reduce(
        (sum, project) => sum + project.linkedNoteIds.length + project.linkedQuestIds.length + project.linkedAutomationIds.length,
        0
      ),
    [assistantProjects, notes]
  );
  const topKnowledgeTags = useMemo(() => {
    const counts = notes.reduce<Record<string, number>>((acc, note) => {
      note.tags.forEach((tag) => {
        const clean = tag.trim().toLowerCase();
        if (!clean) return;
        acc[clean] = (acc[clean] || 0) + 1;
      });
      return acc;
    }, {});
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);
  }, [notes]);
  const knowledgeHotspots = useMemo(
    () =>
      notes
        .filter(Boolean)
        .map((note) => ({
          note,
          score: (note.linkedQuestIds?.length ?? 0) + (note.linkedProjectIds?.length ?? 0) + (note.tags?.length ?? 0) + (note.pinned ? 1 : 0),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 3),
    [notes]
  );
  const activeMediaAccounts = mediaAccounts.filter((account) => account.status !== 'paused').length;
  const activeMediaCampaigns = mediaCampaigns.filter((campaign) => campaign.status === 'active').length;
  const readyMediaQueueItems = mediaQueue.filter((item) => item.status === 'queued' || item.status === 'scheduled').length;
  const publishedMediaQueueItems = mediaQueue.filter((item) => item.status === 'published').length;

  const selectedProjectNotes = useMemo(
    () => notes.filter((note) => selectedProject?.linkedNoteIds.includes(note.id)),
    [notes, selectedProject]
  );
  const selectedProjectAutomations = useMemo(
    () => automations.filter((automation) => selectedProject?.linkedAutomationIds.includes(automation.id)),
    [automations, selectedProject]
  );
  const selectedProjectTasks = useMemo(
    () => tasks.filter((task) => selectedProject?.linkedQuestIds.includes(task.id)),
    [tasks, selectedProject]
  );

  const handleCreateNote = () => {
    const id = addNote({
      title: draftNoteTitle,
      content: draftNoteContent,
      tags: ['lab'],
      kind: 'capture',
      linkedQuestIds: activeQuest ? [activeQuest.id] : [],
      linkedProjectIds: selectedProject ? [selectedProject.id] : [],
    });
    if (selectedProject) {
      updateAssistantProject(selectedProject.id, {
        linkedNoteIds: Array.from(new Set([...selectedProject.linkedNoteIds, id])),
      });
    }
    setDraftNoteTitle('');
    setDraftNoteContent('');
    setSelectedNoteId(id);
    setActiveSection('knowledge');
  };

  const handleCreateProject = () => {
    const id = addAssistantProject({
      title: draftProjectTitle,
      summary: draftProjectSummary,
      kind: draftProjectKind,
      nextAction: 'Capture the first useful note and link the first relevant quest.',
    });
    setDraftProjectTitle('');
    setDraftProjectSummary('');
    setDraftProjectKind('strategy');
    setSelectedProjectId(id);
    setActiveSection('assistants');
  };

  const handleCreateAutomation = () => {
    const id = addAutomation({
      name: draftAutomationName,
      description: draftAutomationDescription,
      triggerSummary: draftAutomationTrigger,
      actionSummary: draftAutomationAction,
      scope: draftAutomationScope,
      mode: draftAutomationMode,
      linkedNoteIds: selectedNote ? [selectedNote.id] : [],
      linkedProjectIds: selectedProject ? [selectedProject.id] : [],
    });
    if (selectedProject) {
      updateAssistantProject(selectedProject.id, {
        linkedAutomationIds: Array.from(new Set([...selectedProject.linkedAutomationIds, id])),
      });
    }
    setDraftAutomationName('');
    setDraftAutomationDescription('');
    setDraftAutomationTrigger('');
    setDraftAutomationAction('');
    setDraftAutomationScope('lab');
    setDraftAutomationMode('suggest');
    setSelectedAutomationId(id);
    setActiveSection('automations');
  };

  const handleCreateMediaAccount = () => {
    const id = addMediaAccount({
      platform: draftMediaPlatform,
      handle: draftMediaHandle,
      cadence: 'Weekly',
      focus: draftMediaFocus,
      linkedProjectIds: selectedProject ? [selectedProject.id] : [],
    });
    setDraftMediaHandle('');
    setDraftMediaFocus('');
    setDraftMediaPlatform('x');
    setSelectedMediaAccountId(id);
    setActiveSection('media');
  };

  const handleCreateMediaCampaign = () => {
    const id = addMediaCampaign({
      title: draftCampaignTitle,
      objective: draftCampaignObjective,
      primaryChannel: draftCampaignChannel,
      nextAction: 'Turn the next build step into one publishable update.',
      status: 'planned',
      linkedProjectIds: selectedProject ? [selectedProject.id] : [],
      linkedNoteIds: selectedNote ? [selectedNote.id] : [],
    });
    setDraftCampaignTitle('');
    setDraftCampaignObjective('');
    setDraftCampaignChannel('x');
    setSelectedMediaCampaignId(id);
    setActiveSection('media');
  };

  const handleCreateMediaQueueItem = () => {
    const id = addMediaQueueItem({
      title: draftQueueTitle,
      channel: draftQueueChannel,
      summary: draftQueueSummary,
      status: 'draft',
      campaignId: selectedMediaCampaign?.id,
    });
    setDraftQueueTitle('');
    setDraftQueueSummary('');
    setDraftQueueChannel('x');
    setSelectedMediaQueueId(id);
    setActiveSection('media');
  };

  const handleCreateQuestFromNote = (note: LabNote) => {
    const questId = addTask({
      title: (note?.title ?? '').trim() || 'Lab quest',
      details: note.content,
      priority: 'normal',
      status: 'todo',
      questType: note.kind === 'capture' ? 'instant' : 'session',
      level: note.kind === 'brief' ? 2 : 1,
      selfTreePrimary: 'Systems',
      projectId: projects[0]?.id,
    });
    updateNote(note.id, {
      linkedQuestIds: Array.from(new Set([...note.linkedQuestIds, questId])),
    });
  };

  const handoffToDusk = (title: string, body: string, tags: string[] = [], linkedQuestIds: string[] = [], linkedProjectIds: string[] = []) => {
    openDuskBrief({
      title,
      body,
      source: 'lab',
      tags,
      linkedQuestIds,
      linkedProjectIds,
    });
  };

  const syncProjectNoteLink = (projectId: string, noteId: string, shouldLink: boolean) => {
    const project = assistantProjects.find((item) => item.id === projectId);
    const note = notes.find((item) => item.id === noteId);
    if (!project || !note) return;

    updateAssistantProject(projectId, {
      linkedNoteIds: shouldLink
        ? Array.from(new Set([...project.linkedNoteIds, noteId]))
        : project.linkedNoteIds.filter((id) => id !== noteId),
    });
    updateNote(noteId, {
      linkedProjectIds: shouldLink
        ? Array.from(new Set([...note.linkedProjectIds, projectId]))
        : note.linkedProjectIds.filter((id) => id !== projectId),
    });
  };

  const syncProjectAutomationLink = (projectId: string, automationId: string, shouldLink: boolean) => {
    const project = assistantProjects.find((item) => item.id === projectId);
    const automation = automations.find((item) => item.id === automationId);
    if (!project || !automation) return;

    updateAssistantProject(projectId, {
      linkedAutomationIds: shouldLink
        ? Array.from(new Set([...project.linkedAutomationIds, automationId]))
        : project.linkedAutomationIds.filter((id) => id !== automationId),
    });
    updateAutomation(automationId, {
      linkedProjectIds: shouldLink
        ? Array.from(new Set([...automation.linkedProjectIds, projectId]))
        : automation.linkedProjectIds.filter((id) => id !== projectId),
    });
  };

  const openBaselineCollection = (noteId?: string | null) => {
    setActiveSection('knowledge');
    setNoteCollection('baselines');
    if (noteId) setSelectedNoteId(noteId);
  };

  const sendBaselineCompareToDusk = (current: LabNote, previous: LabNote) => {
    const payload = buildBaselineCompareHandoff(current, previous);
    handoffToDusk(payload.title, payload.body, payload.tags, payload.linkedQuestIds, payload.linkedProjectIds);
  };

  const sendBaselineToDusk = (note: LabNote) => {
    const noteIndex = baselineNotes.findIndex((entry) => entry.id === note.id);
    const previousBaseline = noteIndex >= 0 && noteIndex < baselineNotes.length - 1 ? baselineNotes[noteIndex + 1] : null;

    if (previousBaseline) {
      sendBaselineCompareToDusk(note, previousBaseline);
      return;
    }

    const payload = buildBaselineProvenanceHandoff(note);
    handoffToDusk(payload.title, payload.body, payload.tags, payload.linkedQuestIds, payload.linkedProjectIds);
  };

  const applyExternalNavigation = useCallback((detail?: LabNavigationPayload | null) => {
    if (!detail) return;

    if (detail.section) setActiveSection(detail.section);
    if (detail.collection) setNoteCollection(detail.collection);
    if (detail.noteId !== undefined) setSelectedNoteId(detail.noteId);
    if (detail.projectId !== undefined) setSelectedProjectId(detail.projectId);
    if (detail.automationId !== undefined) setSelectedAutomationId(detail.automationId);
    if (detail.mediaAccountId !== undefined) setSelectedMediaAccountId(detail.mediaAccountId);
    if (detail.mediaCampaignId !== undefined) setSelectedMediaCampaignId(detail.mediaCampaignId);
    if (detail.mediaQueueId !== undefined) setSelectedMediaQueueId(detail.mediaQueueId);
  }, []);

  useEffect(() => {
    const pending = readPendingLabNavigation();
    if (pending) {
      applyExternalNavigation(pending);
      clearPendingLabNavigation();
    }

    const handleLabNavigation = (event: Event) => {
      const detail = (event as CustomEvent<LabNavigationPayload>).detail;
      applyExternalNavigation(detail);
      clearPendingLabNavigation();
    };

    window.addEventListener(LAB_NAVIGATION_EVENT, handleLabNavigation as EventListener);
    return () => window.removeEventListener(LAB_NAVIGATION_EVENT, handleLabNavigation as EventListener);
  }, [applyExternalNavigation]);

  useEffect(() => {
    const consumeCue = (cue?: XtationStarterWorkspaceCue | null) => {
      if (!cue || cue.workspaceView !== ClientView.LAB) return;
      setStarterWorkspaceCue(cue);
      clearPendingStarterWorkspaceCue();
    };

    consumeCue(readPendingStarterWorkspaceCue());

    const handleStarterWorkspaceCue = (event: Event) => {
      consumeCue((event as CustomEvent<XtationStarterWorkspaceCue>).detail);
    };

    window.addEventListener(STARTER_WORKSPACE_CUE_EVENT, handleStarterWorkspaceCue as EventListener);
    return () => window.removeEventListener(STARTER_WORKSPACE_CUE_EVENT, handleStarterWorkspaceCue as EventListener);
  }, []);
  useEffect(() => {
    const consumeAction = (
      action?: { workspaceView: ClientView.PROFILE | ClientView.LAB; target: XtationStarterWorkspaceActionTarget } | null
    ) => {
      if (!action || action.workspaceView !== ClientView.LAB) return;
      const actionDescriptor = describeStarterWorkspaceAction(starterWorkspaceCue, action.target);
      applyStarterWorkspaceAction(action.target);
      setStarterWorkspaceActionNotice(actionDescriptor);
      clearPendingStarterWorkspaceAction();
    };

    consumeAction(readPendingStarterWorkspaceAction());

    const handleStarterWorkspaceAction = (event: Event) => {
      consumeAction(
        (event as CustomEvent<{
          workspaceView: ClientView.PROFILE | ClientView.LAB;
          target: XtationStarterWorkspaceActionTarget;
        }>).detail
      );
    };

    window.addEventListener(STARTER_WORKSPACE_ACTION_EVENT, handleStarterWorkspaceAction as EventListener);
    return () =>
      window.removeEventListener(STARTER_WORKSPACE_ACTION_EVENT, handleStarterWorkspaceAction as EventListener);
  }, [applyStarterWorkspaceAction, starterWorkspaceCue]);
  useEffect(() => {
    const handleStarterWorkspaceDismiss = () => {
      setStarterWorkspaceCue(null);
      setStarterWorkspaceActionNotice(null);
    };

    window.addEventListener(STARTER_WORKSPACE_DISMISS_EVENT, handleStarterWorkspaceDismiss as EventListener);
    return () =>
      window.removeEventListener(STARTER_WORKSPACE_DISMISS_EVENT, handleStarterWorkspaceDismiss as EventListener);
  }, []);

  return (
    <div className="xt-lab-shell min-h-full w-full px-4 py-6 md:px-8 md:py-8">
      <div className="mx-auto flex w-full max-w-[1520px] flex-col gap-6">
        <section className="xt-lab-hero overflow-hidden p-6 md:p-7">
          <div className="grid gap-5 xl:grid-cols-[1.45fr_1fr]">
            <div className="flex flex-col gap-4">
              <div className="text-[10px] uppercase tracking-[0.28em] text-[var(--app-accent)]">Lab / System Workshop</div>
              <h1 className="text-3xl font-semibold tracking-[0.01em] text-[var(--app-text)] md:text-4xl">
                Build the systems that sharpen execution.
              </h1>
              <p className="max-w-3xl text-sm leading-6 text-[color-mix(in_srgb,var(--app-text)_72%,var(--app-muted))]">
                Lab is the workshop layer of Xtation: assistant projects, knowledge notes, templates, and event-driven
                automations that should make Play cleaner and follow-through easier.
              </p>
              {starterWorkspaceCue ? (
                <div className="xt-workspace-cue xt-runtime-console">
                  <div className="xt-runtime-console-head">
                    <div className="xt-runtime-console-copy">
                      <div className="xt-runtime-console-kicker">{formatStarterWorkspaceCueEyebrow(starterWorkspaceCue)}</div>
                      <div className="xt-runtime-relay-title">{starterWorkspaceCue.title}</div>
                      <div className="xt-runtime-relay-copy">{starterWorkspaceCue.detail}</div>
                    </div>
                    <button type="button" className="xt-runtime-action" onClick={() => dismissStarterWorkspaceCue()}>
                      Dismiss
                    </button>
                  </div>
                      <div className="xt-runtime-toolbar mt-4">
                        <span className="xt-runtime-relay-badge">{starterWorkspaceCue.questTitle}</span>
                        {starterWorkspaceCue.chips.map((chip) => (
                          <span key={`lab-starter-${chip}`} className="xt-runtime-relay-tag">
                            {chip}
                          </span>
                        ))}
                      </div>
                      <div className="xt-runtime-summary-card mt-4">
                        <div className="xt-runtime-summary-label">Recommended next move</div>
                        <div className="xt-runtime-summary-value">{starterWorkspaceCue.recommendedLabel}</div>
                        <div className="xt-runtime-summary-detail">{starterWorkspaceCue.recommendedDetail}</div>
                        <div className="xt-runtime-toolbar mt-4">
                          <button
                            type="button"
                            className="xt-runtime-action"
                            onClick={() =>
                              openStarterWorkspaceAction({
                                workspaceView: ClientView.LAB,
                                target: starterWorkspaceCue.recommendedActionTarget,
                                source: 'lab',
                              })
                            }
                          >
                            {starterWorkspaceCue.recommendedActionLabel}
                          </button>
                        </div>
                      </div>
                      {starterWorkspaceCue.mode === 'checkpoint' && starterWorkspaceCue.checkpointLabel ? (
                        <div className="xt-runtime-summary-card xt-workspace-cue__checkpoint mt-4">
                          <div className="xt-runtime-summary-head">
                            <div>
                              <div className="xt-runtime-summary-label">Checkpoint status</div>
                              <div className="xt-runtime-summary-value">{starterWorkspaceCue.checkpointLabel}</div>
                            </div>
                            {starterWorkspaceCue.checkpointTrackedLabel ? (
                              <div className="xt-workspace-cue__checkpoint-meta">
                                {starterWorkspaceCue.checkpointTrackedLabel}
                              </div>
                            ) : null}
                          </div>
                          {starterWorkspaceCue.checkpointDetail ? (
                            <div className="xt-runtime-summary-detail">{starterWorkspaceCue.checkpointDetail}</div>
                          ) : null}
                          {starterWorkspaceCue.checkpointOutcomeLabel ? (
                            <div className="xt-workspace-cue__checkpoint-outcome">
                              <div className="xt-workspace-cue__checkpoint-outcome-label">
                                {starterWorkspaceCue.checkpointOutcomeLabel}
                              </div>
                              {starterWorkspaceCue.checkpointOutcomeDetail ? (
                                <div className="xt-workspace-cue__checkpoint-outcome-detail">
                                  {starterWorkspaceCue.checkpointOutcomeDetail}
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                          <div className="xt-workspace-cue__checkpoint-bar">
                            <div
                              className="xt-workspace-cue__checkpoint-fill"
                              style={{ width: `${Math.round((starterWorkspaceCue.checkpointProgress ?? 0) * 100)}%` }}
                            />
                          </div>
                        </div>
                      ) : null}
                      <div className="xt-runtime-toolbar mt-4">
                        <button
                          type="button"
                      className="xt-runtime-action"
                      onClick={() => openPlayNavigation({ taskId: starterWorkspaceCue.questId, requestedBy: 'lab' })}
                    >
                      Open Quest
                    </button>
                    <button
                      type="button"
                      className="xt-runtime-action"
                      onClick={() =>
                        handoffToDusk(
                          `Starter handoff: ${starterWorkspaceCue.questTitle}`,
                          `${starterWorkspaceCue.detail}\n\nRoute steps:\n${starterWorkspaceCue.steps
                            .map((step, index) => `${index + 1}. ${step}`)
                            .join('\n')}`,
                          ['starter-handoff', starterWorkspaceCue.track, starterWorkspaceCue.branch.toLowerCase()],
                          [starterWorkspaceCue.questId]
                        )
                      }
                    >
                      Brief Dusk
                    </button>
                  </div>
                  <div className="xt-runtime-chip-grid mt-4">
                    {starterWorkspaceCue.steps.map((step, index) => (
                      <div key={`${starterWorkspaceCue.questId}-step-${index}`} className="xt-runtime-summary-card">
                        <div className="xt-runtime-summary-label">Step {index + 1}</div>
                        <div className="xt-runtime-summary-detail">{step}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              {starterWorkspaceActionNotice ? (
                <div className="xt-runtime-summary-card xt-workspace-cue__action-confirmation">
                  <div className="xt-runtime-summary-label">Starter action confirmed</div>
                  <div className="xt-runtime-summary-value">{starterWorkspaceActionNotice.title}</div>
                  <div className="xt-runtime-summary-detail">{starterWorkspaceActionNotice.detail}</div>
                </div>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <SummaryTile label="Active Projects" value={`${activeProjectsCount}`} icon={<Bot size={18} />} />
                <SummaryTile label="Pinned Notes" value={`${pinnedNotes}`} icon={<Pin size={18} />} />
                <SummaryTile label="Enabled Rules" value={`${enabledAutomations}`} icon={<Workflow size={18} />} />
                <SummaryTile label="Play Minutes Today" value={`${todayMinutes}`} icon={<Sparkles size={18} />} />
              </div>
            </div>

            <div className={`${sectionCard} xt-lab-brief p-4 md:p-5`}>
              <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--app-muted)]">Workspace Brief</div>
              <div className="mt-4 space-y-3 text-sm leading-6 text-[var(--app-muted)]">
                <p>
                  Current quest context:
                  <span className="ml-2 text-[var(--app-text)]">{activeQuest?.title || 'No active quest'}</span>
                </p>
                <p>
                  Lead project:
                  <span className="ml-2 text-[var(--app-text)]">{workspaceLeadProject?.title || 'No assistant project selected'}</span>
                </p>
                <p>
                  Operating rule:
                  <span className="ml-2 text-[var(--app-text)]">
                    if it does not improve Play, Profile, or real follow-through, it should not stay.
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  handoffToDusk(
                    'Lab workspace brief',
                    `Active quest: ${activeQuest?.title || 'none'}\nLead project: ${workspaceLeadProject?.title || 'none'}\nLead note: ${workspaceLeadNote?.title || 'none'}\nEnabled automations: ${enabledAutomations}.`,
                    ['lab', 'workspace'],
                    activeQuest ? [activeQuest.id] : [],
                    workspaceLeadProject ? [workspaceLeadProject.id] : []
                  )
                }
                className={`${panelButton} mt-4 inline-flex items-center gap-2 border-[var(--app-accent)] bg-[color-mix(in_srgb,var(--app-accent)_14%,transparent)] text-[var(--app-text)]`}
              >
                <Send size={14} />
                Send Workspace To Dusk
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {visibleSections.map((section) => (
              <SectionPill
                key={section.id}
                label={section.label}
                hint={section.hint}
                icon={section.icon}
                active={activeSection === section.id}
                onClick={() => setActiveSection(section.id)}
              />
            ))}
          </div>
        </section>

        {activeSection === 'workspace' ? (
          <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="flex flex-col gap-6">
              <article className={`${sectionCard} p-5`}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--app-muted)]">Command Deck</div>
                    <div className="mt-1 text-sm text-[var(--app-muted)]">The four things that should shape the next useful move.</div>
                  </div>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="xt-lab-worktile p-4">
                    <div className="flex items-center gap-2 text-[var(--app-text)]">
                      <Bot size={15} />
                      <div className="text-sm font-medium">{workspaceLeadProject?.title || 'No project active'}</div>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-[var(--app-muted)]">
                      {shortText(workspaceLeadProject?.summary || '', 'Create one assistant project to hold structured context instead of scattered chats.')}
                    </p>
                    <div className="mt-3 text-[11px] text-[var(--app-muted)]">
                      Next action: <span className="text-[var(--app-text)]">{workspaceLeadProject?.nextAction || 'Define one concrete next action.'}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveSection('assistants')}
                      className={`${panelButton} mt-4 inline-flex items-center gap-2 border-[var(--app-border)] text-[var(--app-text)] hover:border-[var(--app-accent)]`}
                    >
                      Open Assistants
                    </button>
                  </div>
                  <div className="xt-lab-worktile p-4">
                    <div className="flex items-center gap-2 text-[var(--app-text)]">
                      <FileText size={15} />
                      <div className="text-sm font-medium">{workspaceLeadNote?.title || 'No note pinned'}</div>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-[var(--app-muted)]">
                      {shortText(workspaceLeadNote?.content || '', 'Capture the working context here so it can later become a quest, brief, or automation.')}
                    </p>
                    <div className="mt-3 text-[11px] text-[var(--app-muted)]">
                      Kind: <span className="text-[var(--app-text)]">{workspaceLeadNote?.kind || 'capture'}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveSection('knowledge')}
                      className={`${panelButton} mt-4 inline-flex items-center gap-2 border-[var(--app-border)] text-[var(--app-text)] hover:border-[var(--app-accent)]`}
                    >
                      Open Knowledge
                    </button>
                  </div>
                  <div className="xt-lab-worktile p-4">
                    <div className="flex items-center gap-2 text-[var(--app-text)]">
                      <Workflow size={15} />
                      <div className="text-sm font-medium">{workspaceLeadAutomation?.name || 'No automation selected'}</div>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-[var(--app-muted)]">
                      {shortText(workspaceLeadAutomation?.description || '', 'Promote one repeated manual behavior into a visible, reversible automation.')}
                    </p>
                    <div className="mt-3 text-[11px] text-[var(--app-muted)]">
                      Mode: <span className="text-[var(--app-text)]">{workspaceLeadAutomation?.mode || 'suggest'}</span>
                      <span className="mx-2">·</span>
                      Scope: <span className="text-[var(--app-text)]">{workspaceLeadAutomation?.scope || 'lab'}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveSection('automations')}
                      className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-[var(--app-border)] px-3 py-2 text-[10px] uppercase tracking-[0.16em] text-[var(--app-text)] hover:border-[var(--app-accent)]"
                    >
                      Open Automations
                    </button>
                  </div>
                  <div className="rounded-[22px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-2)_72%,transparent)] p-4">
                    <div className="flex items-center gap-2 text-[var(--app-text)]">
                      <Sparkles size={15} />
                      <div className="text-sm font-medium">{activeQuest?.title || 'No active quest'}</div>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-[var(--app-muted)]">
                      {activeQuest
                        ? 'The system is healthy when Lab is feeding this quest clearer context, better tools, or less friction.'
                        : 'Play is currently idle. Build the next useful system, then return to execution.'}
                    </p>
                    <div className="mt-3 text-[11px] text-[var(--app-muted)]">
                      Today’s top quests: <span className="text-[var(--app-text)]">{topTasks.length}</span>
                    </div>
                  </div>
                </div>
              </article>

              <article className={`${detailCard} p-5`}>
                <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--app-muted)]">Quick Build</div>
                <div className="mt-4 grid gap-4 lg:grid-cols-3">
                  <div className="rounded-[20px] border border-dashed border-[var(--app-border)] p-4">
                    <div className="text-sm font-medium text-[var(--app-text)]">New Note</div>
                    <input
                      value={draftNoteTitle}
                      onChange={(event) => setDraftNoteTitle(event.target.value)}
                      placeholder="Capture title"
                      className="mt-3 w-full rounded-2xl border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_78%,transparent)] px-3 py-2.5 text-sm text-[var(--app-text)] outline-none focus:border-[var(--app-accent)]"
                    />
                    <textarea
                      value={draftNoteContent}
                      onChange={(event) => setDraftNoteContent(event.target.value)}
                      placeholder="What should be saved?"
                      className="mt-3 min-h-[120px] w-full rounded-2xl border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_78%,transparent)] px-3 py-2.5 text-sm text-[var(--app-text)] outline-none focus:border-[var(--app-accent)]"
                    />
                    <button
                      type="button"
                      onClick={handleCreateNote}
                      disabled={!draftNoteTitle.trim()}
                      className="mt-3 inline-flex items-center gap-2 rounded-2xl border border-[var(--app-accent)] bg-[color-mix(in_srgb,var(--app-accent)_14%,transparent)] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--app-text)] disabled:opacity-40"
                    >
                      <Plus size={14} />
                      Save Note
                    </button>
                  </div>
                  <div className="rounded-[20px] border border-dashed border-[var(--app-border)] p-4">
                    <div className="text-sm font-medium text-[var(--app-text)]">New Assistant Project</div>
                    <input
                      value={draftProjectTitle}
                      onChange={(event) => setDraftProjectTitle(event.target.value)}
                      placeholder="Project title"
                      className="mt-3 w-full rounded-2xl border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_78%,transparent)] px-3 py-2.5 text-sm text-[var(--app-text)] outline-none focus:border-[var(--app-accent)]"
                    />
                    <select
                      value={draftProjectKind}
                      onChange={(event) => setDraftProjectKind(event.target.value as LabProjectKind)}
                      className="mt-3 w-full rounded-2xl border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_78%,transparent)] px-3 py-2.5 text-sm text-[var(--app-text)] outline-none focus:border-[var(--app-accent)]"
                    >
                      {projectKindOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <textarea
                      value={draftProjectSummary}
                      onChange={(event) => setDraftProjectSummary(event.target.value)}
                      placeholder="Why does this project exist?"
                      className="mt-3 min-h-[120px] w-full rounded-2xl border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_78%,transparent)] px-3 py-2.5 text-sm text-[var(--app-text)] outline-none focus:border-[var(--app-accent)]"
                    />
                    <button
                      type="button"
                      onClick={handleCreateProject}
                      disabled={!draftProjectTitle.trim()}
                      className="mt-3 inline-flex items-center gap-2 rounded-2xl border border-[var(--app-accent)] bg-[color-mix(in_srgb,var(--app-accent)_14%,transparent)] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--app-text)] disabled:opacity-40"
                    >
                      <Plus size={14} />
                      Add Project
                    </button>
                  </div>
                  <div className="rounded-[20px] border border-dashed border-[var(--app-border)] p-4">
                    <div className="text-sm font-medium text-[var(--app-text)]">New Automation</div>
                    <input
                      value={draftAutomationName}
                      onChange={(event) => setDraftAutomationName(event.target.value)}
                      placeholder="Automation name"
                      className="mt-3 w-full rounded-2xl border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_78%,transparent)] px-3 py-2.5 text-sm text-[var(--app-text)] outline-none focus:border-[var(--app-accent)]"
                    />
                    <input
                      value={draftAutomationTrigger}
                      onChange={(event) => setDraftAutomationTrigger(event.target.value)}
                      placeholder="Trigger summary"
                      className="mt-3 w-full rounded-2xl border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_78%,transparent)] px-3 py-2.5 text-sm text-[var(--app-text)] outline-none focus:border-[var(--app-accent)]"
                    />
                    <textarea
                      value={draftAutomationAction}
                      onChange={(event) => setDraftAutomationAction(event.target.value)}
                      placeholder="What should happen?"
                      className="mt-3 min-h-[120px] w-full rounded-2xl border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_78%,transparent)] px-3 py-2.5 text-sm text-[var(--app-text)] outline-none focus:border-[var(--app-accent)]"
                    />
                    <button
                      type="button"
                      onClick={handleCreateAutomation}
                      disabled={!draftAutomationName.trim() || !draftAutomationTrigger.trim() || !draftAutomationAction.trim()}
                      className="mt-3 inline-flex items-center gap-2 rounded-2xl border border-[var(--app-accent)] bg-[color-mix(in_srgb,var(--app-accent)_14%,transparent)] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--app-text)] disabled:opacity-40"
                    >
                      <Plus size={14} />
                      Add Rule
                    </button>
                  </div>
                </div>
              </article>
            </div>

            <div className="flex flex-col gap-6">
              <article className="rounded-[24px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_86%,transparent)] p-5">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--app-muted)]">Operational Snapshot</div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <MiniStat label="Assistant Projects" value={`${assistantProjects.length}`} />
                  <MiniStat label="Knowledge Notes" value={`${notes.length}`} />
                  <MiniStat label="Automations Ready" value={`${enabledAutomations}`} accent="text-[#74e2b8]" />
                  <MiniStat label="Current Quest Links" value={`${notes.filter((note) => note.linkedQuestIds.length > 0).length}`} />
                </div>
              </article>

              <article className="rounded-[24px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_86%,transparent)] p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--app-muted)]">Baseline Brief</div>
                    <div className="mt-1 text-sm text-[var(--app-muted)]">
                      Accepted Dusk operating records promoted into Lab.
                    </div>
                  </div>
                  <div className={`${inlineChip} px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-[var(--app-muted)]`}>
                    {baselineNotes.length} stored
                  </div>
                </div>
                {latestBaselineNote ? (
                  <div className={`${detailPanel} mt-4 p-4`}>
                    <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--app-accent)]">Latest Baseline</div>
                    <div className="mt-2 text-sm font-medium text-[var(--app-text)]">{latestBaselineNote.title}</div>
                    <div className="mt-2 text-xs leading-5 text-[var(--app-muted)]">
                      {shortText(latestBaselineNote.content, 'Accepted plan baseline is ready for reuse.', 170)}
                    </div>
                    <div className="mt-3 text-[11px] text-[var(--app-muted)]">
                      {latestBaselineNote.linkedProjectIds.length} projects · {latestBaselineNote.linkedQuestIds.length} quests · updated{' '}
                      <span className="text-[var(--app-text)]">{formatRelativeTime(latestBaselineNote.updatedAt)}</span>
                    </div>
                    {latestBaselineProvenance ? (
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <div className="rounded-[16px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_74%,transparent)] px-4 py-3">
                          <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--app-muted)]">Accepted Plan</div>
                          <div className="mt-2 text-xs leading-5 text-[var(--app-muted)]">
                            {formatBaselineProvenanceProvider(latestBaselineProvenance) || 'Provider unavailable'}
                            <br />
                            {latestBaselineProvenance.acceptedLabel
                              ? `Accepted: ${latestBaselineProvenance.acceptedLabel}`
                              : 'Accepted stamp unavailable'}
                            <br />
                            {latestBaselineProvenance.nextAction
                              ? `Next action: ${latestBaselineProvenance.nextAction}`
                              : 'Next action unavailable'}
                          </div>
                        </div>
                        <div className="rounded-[16px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_74%,transparent)] px-4 py-3">
                          <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--app-muted)]">Compare Anchor</div>
                          <div className="mt-2 text-xs leading-5 text-[var(--app-muted)]">
                            {latestBaselineProvenance.compareCurrentTitle
                              ? `Current: ${latestBaselineProvenance.compareCurrentTitle}`
                              : 'Current baseline unavailable'}
                            <br />
                            {latestBaselineProvenance.comparePreviousTitle
                              ? `Previous: ${latestBaselineProvenance.comparePreviousTitle}`
                              : 'Previous baseline unavailable'}
                            <br />
                            {latestBaselineProvenance.compareDriftSummary
                              ? `Drift: ${latestBaselineProvenance.compareDriftSummary}`
                              : 'Drift summary unavailable'}
                          </div>
                        </div>
                      </div>
                    ) : null}
                    {latestBaselineDecisionAnchor ? (
                      <div className="mt-3 rounded-[16px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_74%,transparent)] px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--app-muted)]">Decision Anchor</div>
                          <div className={`${inlineChip} px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-[var(--app-muted)]`}>
                            {latestBaselineDecisionAnchor.status}
                          </div>
                        </div>
                        <div className="mt-2 text-xs leading-5 text-[var(--app-muted)]">
                          {latestBaselineDecisionAnchor.summary}
                          <br />
                          {latestBaselineDecisionAnchor.recommendation}
                        </div>
                      </div>
                    ) : null}
                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          openLabNavigation({
                            section: 'knowledge',
                            collection: 'baselines',
                            noteId: latestBaselineNote.id,
                            requestedBy: 'lab',
                          })
                        }
                        className={`${panelButton} border border-[var(--app-border)] px-4 py-2 text-[10px] font-semibold text-[var(--app-text)] hover:border-[var(--app-accent)]`}
                      >
                        <FileText size={14} />
                        Open Baselines
                      </button>
                      <button
                        type="button"
                        onClick={() => sendBaselineToDusk(latestBaselineNote)}
                        className={`${panelButton} border border-[var(--app-border)] px-4 py-2 text-[10px] font-semibold text-[var(--app-text)] hover:border-[var(--app-accent)]`}
                      >
                        <Send size={14} />
                        Send To Dusk
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCreateQuestFromNote(latestBaselineNote)}
                        className={`${panelButton} border border-[var(--app-accent)] bg-[color-mix(in_srgb,var(--app-accent)_14%,transparent)] px-4 py-2 text-[10px] font-semibold text-[var(--app-text)]`}
                      >
                        <Plus size={14} />
                        Create Quest
                      </button>
                    </div>
                  </div>
                ) : (
                    <div className={`${detailPanel} mt-4 border-dashed px-4 py-5 text-sm text-[var(--app-muted)]`}>
                      Promote an accepted Dusk plan to Lab and the newest baseline will stay visible here for reuse.
                    </div>
                )}
                <div className="mt-5 border-t border-[var(--app-border)] pt-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">Baseline Timeline</div>
                      <div className="mt-1 text-xs leading-5 text-[var(--app-muted)]">
                        Recent accepted plans promoted into Lab as operating history.
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => openBaselineCollection(latestBaselineNote?.id ?? null)}
                      className={`${panelButton} border border-[var(--app-border)] px-3 py-2 text-[10px] font-semibold text-[var(--app-text)] hover:border-[var(--app-accent)]`}
                    >
                      <FileText size={14} />
                      Open All
                    </button>
                  </div>
                  <div className="mt-4 flex flex-col gap-3">
                    {baselineTimelineNotes.length ? (
                      baselineTimelineNotes.map((note, index) => (
                        <div
                          key={note.id}
                          className="rounded-[18px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-2)_76%,transparent)] px-4 py-4"
                        >
                          {(() => {
                            const noteProvenance = baselineProvenanceById.get(note.id) || null;
                            return (
                              <>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] uppercase tracking-[0.16em] text-[var(--app-accent)]">
                                  {index === 0 ? 'Latest' : `Record ${baselineTimelineNotes.length - index}`}
                                </span>
                                <span className="text-[10px] uppercase tracking-[0.16em] text-[var(--app-muted)]">
                                  {formatRelativeTime(note.updatedAt)}
                                </span>
                              </div>
                              <div className="mt-2 text-sm font-medium text-[var(--app-text)]">{note.title}</div>
                              <div className="mt-2 text-xs leading-5 text-[var(--app-muted)]">
                                {shortText(note.content, 'Accepted baseline ready for reuse.', 132)}
                              </div>
                            </div>
                            <div className={`${inlineChip} px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-[var(--app-muted)]`}>
                              {note.kind}
                            </div>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-[var(--app-muted)]">
                            <span>{note.linkedProjectIds.length} projects</span>
                            <span>{note.linkedQuestIds.length} quests</span>
                            <span>{note.tags.filter((tag) => tag !== 'lab').slice(0, 2).join(' · ') || 'baseline'}</span>
                          </div>
                          {noteProvenance ? (
                            <div className="mt-3 grid gap-2 md:grid-cols-2">
                              <div className="rounded-[14px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_72%,transparent)] px-3 py-2">
                                <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--app-muted)]">Accepted Plan</div>
                                <div className="mt-1 text-[11px] leading-5 text-[var(--app-muted)]">
                                  {formatBaselineProvenanceProvider(noteProvenance) || 'Provider unavailable'}
                                  <br />
                                  {noteProvenance.acceptedLabel || 'Accepted stamp unavailable'}
                                </div>
                              </div>
                              <div className="rounded-[14px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_72%,transparent)] px-3 py-2">
                                <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--app-muted)]">Compare Anchor</div>
                                <div className="mt-1 text-[11px] leading-5 text-[var(--app-muted)]">
                                  {noteProvenance.compareCurrentTitle || 'Current unavailable'}
                                  {noteProvenance.comparePreviousTitle ? ` vs ${noteProvenance.comparePreviousTitle}` : ''}
                                  <br />
                                  {noteProvenance.compareDriftSummary || 'No drift summary'}
                                </div>
                              </div>
                            </div>
                          ) : null}
                          {noteProvenance ? (
                            <div className="mt-3 text-[11px] leading-5 text-[var(--app-muted)]">
                              {(() => {
                                const anchor = buildBaselineDecisionAnchor(noteProvenance);
                                return anchor ? (
                                  <>
                                    <span className="text-[var(--app-text)]">Decision anchor</span>
                                    {' · '}
                                    {anchor.status} · {anchor.summary}
                                  </>
                                ) : null;
                              })()}
                            </div>
                          ) : null}
                          <div className="mt-4 flex flex-wrap gap-3">
                            <button
                              type="button"
                              onClick={() =>
                                openLabNavigation({
                                  section: 'knowledge',
                                  collection: 'baselines',
                                  noteId: note.id,
                                  requestedBy: 'lab',
                                })
                              }
                              className={`${panelButton} border border-[var(--app-border)] px-3 py-2 text-[10px] font-semibold text-[var(--app-text)] hover:border-[var(--app-accent)]`}
                            >
                              <FileText size={14} />
                              Open
                            </button>
                            <button
                              type="button"
                              onClick={() => sendBaselineToDusk(note)}
                              className={`${panelButton} border border-[var(--app-border)] px-3 py-2 text-[10px] font-semibold text-[var(--app-text)] hover:border-[var(--app-accent)]`}
                            >
                              <Send size={14} />
                              Send
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCreateQuestFromNote(note)}
                              className={`${panelButton} border border-[var(--app-accent)] bg-[color-mix(in_srgb,var(--app-accent)_14%,transparent)] px-3 py-2 text-[10px] font-semibold text-[var(--app-text)]`}
                            >
                              <Plus size={14} />
                              Create Quest
                            </button>
                          </div>
                              </>
                            );
                          })()}
                        </div>
                      ))
                    ) : (
                      <div className={`${detailPanel} border-dashed px-4 py-4 text-sm text-[var(--app-muted)]`}>
                        No baseline history yet. Accept a Dusk plan and promote it to Lab to start the timeline.
                      </div>
                    )}
                  </div>
                </div>
              </article>

              {briefStackEnabled ? (
                <article className="rounded-[24px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_86%,transparent)] p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--app-muted)]">Brief Stack Widget</div>
                      <div className="mt-1 text-sm text-[var(--app-muted)]">Pinned context from Dusk and Lab, kept close to the workspace.</div>
                    </div>
                    <div className="rounded-full border border-[var(--app-border)] px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-[var(--app-muted)]">
                      {latestBrief ? latestBrief.source : 'idle'}
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3">
                    <div className="rounded-[18px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-2)_72%,transparent)] px-4 py-3">
                      <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--app-muted)]">Latest Dusk Brief</div>
                      <div className="mt-2 text-sm font-medium text-[var(--app-text)]">{latestBrief?.title || 'No brief stacked yet'}</div>
                      <div className="mt-2 text-xs leading-5 text-[var(--app-muted)]">
                        {latestBrief
                          ? shortText(latestBrief.body, 'No details captured yet.', 150)
                          : 'Send the current workspace to Dusk and the newest brief will stay pinned here.'}
                      </div>
                    </div>
                    <div className="rounded-[18px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-2)_72%,transparent)] px-4 py-3">
                      <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--app-muted)]">Pinned Lab Note</div>
                      <div className="mt-2 text-sm font-medium text-[var(--app-text)]">{workspaceLeadNote?.title || 'No pinned note'}</div>
                      <div className="mt-2 text-xs leading-5 text-[var(--app-muted)]">
                        {shortText(workspaceLeadNote?.content || '', 'Pin a note to keep it in the Lab widget stack.', 140)}
                      </div>
                    </div>
                  </div>
                </article>
              ) : null}

              <article className="rounded-[24px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_86%,transparent)] p-5">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--app-muted)]">Module Rack</div>
                <div className="mt-4 grid gap-3">
                  <div className={`rounded-[18px] border px-4 py-4 ${knowledgeGraphEnabled ? 'border-[color-mix(in_srgb,var(--app-accent)_24%,transparent)] bg-[color-mix(in_srgb,var(--app-accent)_8%,transparent)]' : 'border-dashed border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-2)_72%,transparent)]'}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-medium text-[var(--app-text)]">Knowledge Graph</div>
                      <div className="rounded-full border border-[var(--app-border)] px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-[var(--app-muted)]">
                        {knowledgeGraphEnabled ? 'active' : 'locked'}
                      </div>
                    </div>
                    <div className="mt-3 text-xs leading-5 text-[var(--app-muted)]">
                      {knowledgeGraphEnabled
                        ? 'Relationship density, hot nodes, and top tags are now visible in the Knowledge lane.'
                        : 'Unlock in Store to reveal note relationship density and graph snapshots inside Lab.'}
                    </div>
                    {knowledgeGraphEnabled ? (
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <MiniStat label="Nodes" value={`${knowledgeNodes}`} />
                        <MiniStat label="Edges" value={`${knowledgeEdges}`} accent="text-[var(--app-accent)]" />
                      </div>
                    ) : null}
                  </div>

                  <div className={`rounded-[18px] border px-4 py-4 ${mediaOpsEnabled ? 'border-[color-mix(in_srgb,#f0c45a_26%,transparent)] bg-[color-mix(in_srgb,#f0c45a_8%,transparent)]' : 'border-dashed border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-2)_72%,transparent)]'}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-medium text-[var(--app-text)]">Media Ops</div>
                      <div className="rounded-full border border-[var(--app-border)] px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-[var(--app-muted)]">
                        {mediaOpsEnabled ? 'active' : 'locked'}
                      </div>
                    </div>
                    <div className="mt-3 text-xs leading-5 text-[var(--app-muted)]">
                      {mediaOpsEnabled
                        ? 'Campaign context, content planning signals, and publishing-oriented rules are now grouped in one lane.'
                        : 'Unlock in Store to get a dedicated media planning lane for campaigns, publishing, and content operations.'}
                    </div>
                    {mediaOpsEnabled ? (
                      <div className="mt-3 grid gap-2 sm:grid-cols-3">
                        <MiniStat label="Accounts" value={`${activeMediaAccounts}`} />
                        <MiniStat label="Campaigns" value={`${activeMediaCampaigns}`} />
                        <MiniStat label="Queue Ready" value={`${readyMediaQueueItems}`} accent="text-[#f0c45a]" />
                      </div>
                    ) : null}
                    {mediaOpsEnabled ? (
                      <button
                        type="button"
                        onClick={() => setActiveSection('media')}
                        className="mt-3 inline-flex items-center gap-2 rounded-2xl border border-[color-mix(in_srgb,#f0c45a_32%,transparent)] bg-[color-mix(in_srgb,#f0c45a_12%,transparent)] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--app-text)]"
                      >
                        <Megaphone size={14} />
                        Open Media Ops
                      </button>
                    ) : null}
                  </div>
                </div>
              </article>

              <article className="rounded-[24px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_86%,transparent)] p-5">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--app-muted)]">Top Quest Pressure</div>
                <div className="mt-4 flex flex-col gap-3">
                  {topTasks.length ? (
                    topTasks.map(({ taskId, title, minutes }) => (
                      <div
                        key={taskId}
                        className="rounded-[18px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-2)_72%,transparent)] px-4 py-3"
                      >
                        <div className="text-sm font-medium text-[var(--app-text)]">{title}</div>
                        <div className="mt-1 text-[11px] text-[var(--app-muted)]">{minutes} min tracked today</div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-[18px] border border-dashed border-[var(--app-border)] px-4 py-4 text-sm text-[var(--app-muted)]">
                      No recent quest pressure yet.
                    </div>
                  )}
                </div>
              </article>

              <article className="rounded-[24px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_86%,transparent)] p-5">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--app-muted)]">Why This Shape</div>
                <div className="mt-4 space-y-3 text-sm leading-6 text-[var(--app-muted)]">
                  <p>Lab is not a random extra page. It exists to make execution simpler, more repeatable, and easier to hand off to Dusk.</p>
                  <p>Knowledge stays local-first and linkable. Assistant projects hold structured context. Automations stay visible and reversible.</p>
                </div>
              </article>
            </div>
          </section>
        ) : null}

        {activeSection === 'assistants' ? (
          <section className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
            <article className={`${detailCard} p-5`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--app-muted)]">Assistant Projects</div>
                  <div className="mt-1 text-sm text-[var(--app-muted)]">Structured workspaces for research, coding, design, and strategy.</div>
                </div>
                <div className={`${inlineChip} px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-[var(--app-muted)]`}>
                  {assistantProjects.length} total
                </div>
              </div>
              <div className="mt-4 flex max-h-[780px] flex-col gap-3 overflow-y-auto pr-1">
                {assistantProjects.map((project) => (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => setSelectedProjectId(project.id)}
                    className={`${listCard} px-4 py-4 text-left ${
                      selectedProject?.id === project.id
                        ? 'is-active'
                        : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-base font-medium text-[var(--app-text)]">{project.title}</div>
                        <div className="mt-1 text-[10px] uppercase tracking-[0.16em] text-[var(--app-muted)]">
                          {project.kind} · {project.status}
                        </div>
                        <div className="mt-3 text-sm leading-6 text-[var(--app-muted)]">{shortText(project.summary, 'No summary yet.')}</div>
                      </div>
                      <div className={`inline-flex shrink-0 ${inlineChip} px-3 py-1 text-[10px] uppercase tracking-[0.16em] ${accentClass[project.accent]}`}>
                        {project.kind}
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-3 text-[11px] text-[var(--app-muted)]">
                      <span>{project.linkedNoteIds.length} notes</span>
                      <span>{project.linkedAutomationIds.length} rules</span>
                      <span>{project.linkedQuestIds.length} quests</span>
                    </div>
                  </button>
                ))}
              </div>
            </article>

            <article className={`${detailCard} p-5`}>
              {selectedProject ? (
                <div className="flex flex-col gap-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <input
                        value={selectedProject.title}
                        onChange={(event) => updateAssistantProject(selectedProject.id, { title: event.target.value })}
                        className="w-full bg-transparent text-2xl font-semibold text-[var(--app-text)] outline-none"
                      />
                      <div className="mt-2 flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.16em] text-[var(--app-muted)]">
                        <span>{selectedProject.kind}</span>
                        <span>·</span>
                        <span>{selectedProject.status}</span>
                        <span>·</span>
                        <span>Updated {formatRelativeTime(selectedProject.updatedAt)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          updateAssistantProject(selectedProject.id, {
                            status: selectedProject.status === 'active' ? 'paused' : 'active',
                          })
                        }
                        className={iconButton}
                      >
                        {selectedProject.status === 'active' ? <Pause size={14} /> : <PlayCircle size={14} />}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteAssistantProject(selectedProject.id)}
                        className={iconButton}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="flex flex-col gap-2 text-sm text-[var(--app-muted)]">
                      <span className="text-[10px] uppercase tracking-[0.18em]">Kind</span>
                      <select
                        value={selectedProject.kind}
                        onChange={(event) => updateAssistantProject(selectedProject.id, { kind: event.target.value as LabProjectKind })}
                        className={fieldInput}
                      >
                        {projectKindOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-2 text-sm text-[var(--app-muted)]">
                      <span className="text-[10px] uppercase tracking-[0.18em]">Status</span>
                      <select
                        value={selectedProject.status}
                        onChange={(event) =>
                          updateAssistantProject(selectedProject.id, {
                            status: event.target.value as LabAssistantProject['status'],
                          })
                        }
                        className={fieldInput}
                      >
                        {['active', 'paused', 'draft', 'archived'].map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <label className="flex flex-col gap-2 text-sm text-[var(--app-muted)]">
                    <span className="text-[10px] uppercase tracking-[0.18em]">Summary</span>
                    <textarea
                      value={selectedProject.summary}
                      onChange={(event) => updateAssistantProject(selectedProject.id, { summary: event.target.value })}
                      className={fieldTextarea}
                    />
                  </label>

                  <label className="flex flex-col gap-2 text-sm text-[var(--app-muted)]">
                    <span className="text-[10px] uppercase tracking-[0.18em]">Next Action</span>
                    <input
                      value={selectedProject.nextAction}
                      onChange={(event) => updateAssistantProject(selectedProject.id, { nextAction: event.target.value })}
                      className={fieldInput}
                    />
                  </label>

                  <div className="grid gap-4 lg:grid-cols-3">
                    <div className={`${detailPanel} p-4`}>
                      <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">Linked Notes</div>
                      <div className="mt-3 flex max-h-[220px] flex-col gap-2 overflow-y-auto">
                        {notes.map((note) => {
                          const checked = selectedProject.linkedNoteIds.includes(note.id);
                          return (
                            <label key={note.id} className="flex items-start gap-2 text-sm text-[var(--app-muted)]">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(event) => syncProjectNoteLink(selectedProject.id, note.id, event.target.checked)}
                              />
                              <span className="leading-5">{note.title}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                    <div className={`${detailPanel} p-4`}>
                      <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">Linked Quests</div>
                      <div className="mt-3 flex max-h-[220px] flex-col gap-2 overflow-y-auto">
                        {tasks.slice(0, 12).map((task) => {
                          const checked = selectedProject.linkedQuestIds.includes(task.id);
                          return (
                            <label key={task.id} className="flex items-start gap-2 text-sm text-[var(--app-muted)]">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() =>
                                  updateAssistantProject(selectedProject.id, {
                                    linkedQuestIds: toggleId(selectedProject.linkedQuestIds, task.id),
                                  })
                                }
                              />
                              <span className="leading-5">{task.title}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                    <div className={`${detailPanel} p-4`}>
                      <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">Linked Rules</div>
                      <div className="mt-3 flex max-h-[220px] flex-col gap-2 overflow-y-auto">
                        {automations.map((automation) => {
                          const checked = selectedProject.linkedAutomationIds.includes(automation.id);
                          return (
                            <label key={automation.id} className="flex items-start gap-2 text-sm text-[var(--app-muted)]">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(event) =>
                                  syncProjectAutomationLink(selectedProject.id, automation.id, event.target.checked)
                                }
                              />
                              <span className="leading-5">{automation.name}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-3">
                    <div className={`${detailPanel} p-4`}>
                      <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">Notes In Context</div>
                      <div className="mt-3 flex flex-col gap-2">
                        {selectedProjectNotes.length ? (
                          selectedProjectNotes.map((note) => (
                            <div key={note.id} className={`${inlineChip} px-3 py-2 text-sm text-[var(--app-text)]`}>
                              {note.title}
                            </div>
                          ))
                        ) : (
                          <div className="text-sm text-[var(--app-muted)]">No notes linked yet.</div>
                        )}
                      </div>
                    </div>
                    <div className={`${detailPanel} p-4`}>
                      <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">Quest Links</div>
                      <div className="mt-3 flex flex-col gap-2">
                        {selectedProjectTasks.length ? (
                          selectedProjectTasks.map((task) => (
                            <div key={task.id} className={`${inlineChip} px-3 py-2 text-sm text-[var(--app-text)]`}>
                              {task.title}
                            </div>
                          ))
                        ) : (
                          <div className="text-sm text-[var(--app-muted)]">No quest links yet.</div>
                        )}
                      </div>
                    </div>
                    <div className={`${detailPanel} p-4`}>
                      <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">Automation Links</div>
                      <div className="mt-3 flex flex-col gap-2">
                        {selectedProjectAutomations.length ? (
                          selectedProjectAutomations.map((automation) => (
                            <div key={automation.id} className={`${inlineChip} px-3 py-2 text-sm text-[var(--app-text)]`}>
                              {automation.name}
                            </div>
                          ))
                        ) : (
                          <div className="text-sm text-[var(--app-muted)]">No automation links yet.</div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        handoffToDusk(
                          selectedProject.title,
                          `${selectedProject.summary}\n\nNext action: ${selectedProject.nextAction}`,
                          [selectedProject.kind, 'assistant-project'],
                          selectedProject.linkedQuestIds,
                          [selectedProject.id]
                        )
                      }
                      className={`${panelButton} border border-[var(--app-accent)] bg-[color-mix(in_srgb,var(--app-accent)_14%,transparent)] px-4 py-2 text-[10px] font-semibold text-[var(--app-text)]`}
                    >
                      <Send size={14} />
                      Hand Off To Dusk
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const noteId = addNote({
                          title: `${selectedProject.title} brief`,
                          content: `${selectedProject.summary}\n\nNext action: ${selectedProject.nextAction}`,
                          kind: 'brief',
                          tags: [selectedProject.kind, 'assistant-project'],
                          linkedQuestIds: selectedProject.linkedQuestIds,
                          linkedProjectIds: [selectedProject.id],
                        });
                        updateAssistantProject(selectedProject.id, {
                          linkedNoteIds: Array.from(new Set([...selectedProject.linkedNoteIds, noteId])),
                        });
                        setSelectedNoteId(noteId);
                        setActiveSection('knowledge');
                      }}
                      className={`${panelButton} border border-[var(--app-border)] px-4 py-2 text-[10px] font-semibold text-[var(--app-text)] hover:border-[var(--app-accent)]`}
                    >
                      <FileText size={14} />
                      Create Brief Note
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex min-h-[420px] items-center justify-center text-sm text-[var(--app-muted)]">No project selected.</div>
              )}
            </article>
          </section>
        ) : null}

        {activeSection === 'knowledge' ? (
          <section className="grid gap-6 xl:grid-cols-[0.64fr_0.76fr_1.05fr]">
            <div className="flex flex-col gap-6">
              <article className="rounded-[24px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_86%,transparent)] p-5">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--app-muted)]">Collections</div>
                <div className="mt-4 flex flex-col gap-2">
                  {[
                    { id: 'all', label: 'All Notes', count: notes.length },
                    { id: 'pinned', label: 'Pinned', count: notes.filter((note) => note.pinned).length },
                    { id: 'linked', label: 'Linked', count: notes.filter((note) => note.linkedQuestIds.length || note.linkedProjectIds.length).length },
                    { id: 'plans', label: 'Plans & Briefs', count: notes.filter((note) => note.kind === 'plan' || note.kind === 'brief').length },
                    { id: 'baselines', label: 'Baselines', count: notes.filter((note) => isBaselineNote(note)).length },
                    { id: 'research', label: 'Research', count: notes.filter((note) => note.kind === 'research' || note.tags.includes('research')).length },
                  ].map((collection) => (
                    <button
                      key={collection.id}
                      type="button"
                      onClick={() => setNoteCollection(collection.id as NoteCollection)}
                      className={`${listCard} flex items-center justify-between px-3 py-3 text-left ${
                        noteCollection === collection.id
                          ? 'is-active'
                          : ''
                      }`}
                    >
                      <span className="text-sm text-[var(--app-text)]">{collection.label}</span>
                      <span className="text-[11px] text-[var(--app-muted)]">{collection.count}</span>
                    </button>
                  ))}
                </div>
              </article>

              <article className={`${detailCard} p-5`}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--app-muted)]">Knowledge Graph</div>
                    <div className="mt-1 text-sm text-[var(--app-muted)]">
                      {knowledgeGraphEnabled ? 'Graph snapshot for note relationships and metadata pressure.' : 'Locked module. Enable from Store to reveal relationship density here.'}
                    </div>
                  </div>
                  <div className={`${inlineChip} px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-[var(--app-muted)]`}>
                    {knowledgeGraphEnabled ? 'active' : 'locked'}
                  </div>
                </div>

                {knowledgeGraphEnabled ? (
                  <>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <MiniStat label="Nodes" value={`${knowledgeNodes}`} />
                      <MiniStat label="Edges" value={`${knowledgeEdges}`} accent="text-[var(--app-accent)]" />
                    </div>
                    <div className={`${detailPanel} mt-4 p-4`}>
                      <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--app-muted)]">Hot Nodes</div>
                      <div className="mt-3 flex flex-col gap-2">
                        {knowledgeHotspots.length ? (
                          knowledgeHotspots.map(({ note, score }) => (
                            <div key={note.id} className="flex items-center justify-between gap-3 text-sm">
                              <span className="truncate text-[var(--app-text)]">{note.title}</span>
                              <span className="shrink-0 text-[var(--app-muted)]">{score} links</span>
                            </div>
                          ))
                        ) : (
                          <div className="text-sm text-[var(--app-muted)]">Start linking notes to quests and projects to build the graph.</div>
                        )}
                      </div>
                    </div>
                    <div className={`${detailPanel} mt-4 p-4`}>
                      <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--app-muted)]">Tag Field</div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {topKnowledgeTags.length ? (
                          topKnowledgeTags.map(([tag, count]) => (
                            <span
                              key={tag}
                              className={`${inlineChip} px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-[var(--app-text)]`}
                            >
                              {tag} · {count}
                            </span>
                          ))
                        ) : (
                          <span className="text-sm text-[var(--app-muted)]">Tags will cluster here once you start annotating notes.</span>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className={`${detailPanel} mt-4 border-dashed px-4 py-5 text-sm text-[var(--app-muted)]`}>
                    Unlock the Knowledge Graph module in Store to expose relationship density, hot nodes, and tag clusters directly inside Lab.
                  </div>
                )}
              </article>
            </div>

            <article className={`${detailCard} p-5`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--app-muted)]">Knowledge Notes</div>
                  <div className="mt-1 text-sm text-[var(--app-muted)]">Local-first notes that can become quests, project context, or Dusk briefs.</div>
                </div>
                <div className={`${inlineChip} px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-[var(--app-muted)]`}>
                  {filteredNotes.length} visible
                </div>
              </div>
              <div className="mt-4 flex max-h-[780px] flex-col gap-3 overflow-y-auto pr-1">
                {filteredNotes.map((note) => (
                  <button
                    key={note.id}
                    type="button"
                    onClick={() => setSelectedNoteId(note.id)}
                    className={`${listCard} px-4 py-4 text-left ${
                      selectedNote?.id === note.id
                        ? 'is-active'
                        : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-[var(--app-text)]">{note.title}</div>
                        <div className="mt-1 text-[10px] uppercase tracking-[0.16em] text-[var(--app-muted)]">
                          {note.kind} · {note.status}
                        </div>
                        {isBaselineNote(note) ? (
                          <div className="mt-2 space-y-1">
                            <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--app-accent)]">
                              Dusk baseline
                            </div>
                            {(() => {
                              const noteProvenance = baselineProvenanceById.get(note.id) || null;
                              return noteProvenance ? (
                                <div className="text-[10px] leading-5 text-[var(--app-muted)]">
                                  {formatBaselineProvenanceProvider(noteProvenance) || 'Provider unavailable'}
                                  {noteProvenance.compareCurrentTitle ? ` · ${noteProvenance.compareCurrentTitle}` : ''}
                                  {noteProvenance.comparePreviousTitle ? ` vs ${noteProvenance.comparePreviousTitle}` : ''}
                                </div>
                              ) : null;
                            })()}
                          </div>
                        ) : null}
                      </div>
                      {note.pinned ? <Pin size={13} className="shrink-0 text-[var(--app-accent)]" /> : null}
                    </div>
                    <div className="mt-3 line-clamp-3 text-xs leading-5 text-[var(--app-muted)]">{note.content}</div>
                  </button>
                ))}
              </div>
            </article>

            <article className={`${detailCard} p-5`}>
              {selectedNote ? (
                <div className="flex flex-col gap-5">
                  <div className="flex items-start justify-between gap-3">
                    <input
                      value={selectedNote.title}
                      onChange={(event) => updateNote(selectedNote.id, { title: event.target.value })}
                      className="min-w-0 flex-1 bg-transparent text-2xl font-semibold text-[var(--app-text)] outline-none"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => updateNote(selectedNote.id, { pinned: !selectedNote.pinned })}
                        className={`${iconButton} ${
                          selectedNote.pinned
                            ? 'border-[var(--app-accent)] bg-[color-mix(in_srgb,var(--app-accent)_12%,transparent)] text-[var(--app-accent)]'
                            : 'border-[var(--app-border)] text-[var(--app-muted)]'
                        }`}
                      >
                        <Pin size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteNote(selectedNote.id)}
                        className={iconButton}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    {isBaselineNote(selectedNote) ? (
                      <div className={`${detailPanel} md:col-span-3 px-4 py-3`}>
                        <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-accent)]">Baseline Note</div>
                        <div className="mt-2 text-sm leading-6 text-[var(--app-muted)]">
                          This note is a promoted Dusk baseline. Use it as a stable operating record, send it back to Dusk, or turn it into a concrete quest.
                        </div>
                      </div>
                    ) : null}
                    {isBaselineNote(selectedNote) && selectedBaselineProvenance ? (
                      <div className={`${detailPanel} md:col-span-3 p-4`}>
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">Baseline Provenance</div>
                            <div className="mt-1 text-sm text-[var(--app-muted)]">
                              Accepted Dusk plan and compare-anchor context preserved with this record.
                            </div>
                          </div>
                          <div className={`${inlineChip} px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-[var(--app-muted)]`}>
                            {selectedBaselineProvenance.model || 'provider'}
                          </div>
                        </div>
                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          <div className="rounded-[16px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_74%,transparent)] px-4 py-3">
                            <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--app-muted)]">Accepted Plan</div>
                            <div className="mt-2 text-xs leading-5 text-[var(--app-muted)]">
                              {selectedBaselineProvenance.providerLabel
                                ? `${selectedBaselineProvenance.providerLabel}${selectedBaselineProvenance.model ? ` / ${selectedBaselineProvenance.model}` : ''}`
                                : 'Provider unavailable'}
                              <br />
                              {selectedBaselineProvenance.acceptedLabel
                                ? `Accepted: ${selectedBaselineProvenance.acceptedLabel}`
                                : 'Accepted stamp unavailable'}
                              <br />
                              {selectedBaselineProvenance.nextAction
                                ? `Next action: ${selectedBaselineProvenance.nextAction}`
                                : 'Next action unavailable'}
                            </div>
                          </div>
                          <div className="rounded-[16px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_74%,transparent)] px-4 py-3">
                            <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--app-muted)]">Compare Anchor</div>
                            <div className="mt-2 text-xs leading-5 text-[var(--app-muted)]">
                              {selectedBaselineProvenance.compareCurrentTitle
                                ? `Current: ${selectedBaselineProvenance.compareCurrentTitle}`
                                : 'Current baseline unavailable'}
                              <br />
                              {selectedBaselineProvenance.comparePreviousTitle
                                ? `Previous: ${selectedBaselineProvenance.comparePreviousTitle}`
                                : 'Previous baseline unavailable'}
                              <br />
                              {selectedBaselineProvenance.compareDriftSummary
                                ? `Drift: ${selectedBaselineProvenance.compareDriftSummary}`
                                : 'Drift summary unavailable'}
                            </div>
                          </div>
                          {selectedBaselineProvenance.revisionNote ? (
                            <div className="rounded-[16px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_74%,transparent)] px-4 py-3 md:col-span-2">
                              <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--app-muted)]">Accepted Revision Note</div>
                              <div className="mt-2 text-xs leading-5 text-[var(--app-muted)]">
                                {selectedBaselineProvenance.revisionNote}
                              </div>
                            </div>
                          ) : null}
                          {selectedBaselineDecisionAnchor ? (
                            <div className="rounded-[16px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_74%,transparent)] px-4 py-3 md:col-span-2">
                              <div className="flex items-center justify-between gap-3">
                                <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--app-muted)]">Decision Anchor</div>
                                <div className={`${inlineChip} px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-[var(--app-muted)]`}>
                                  {selectedBaselineDecisionAnchor.status}
                                </div>
                              </div>
                              <div className="mt-2 text-xs leading-5 text-[var(--app-muted)]">
                                {selectedBaselineDecisionAnchor.summary}
                                <br />
                                {selectedBaselineDecisionAnchor.recommendation}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                    {isBaselineNote(selectedNote) ? (
                      <div className={`${detailPanel} md:col-span-3 p-4`}>
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">Baseline Timeline</div>
                            <div className="mt-1 text-sm text-[var(--app-muted)]">
                              Record {selectedBaselineIndex + 1} of {baselineNotes.length} in the promoted Dusk operating history.
                            </div>
                          </div>
                          <div className={`${inlineChip} px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-[var(--app-muted)]`}>
                            updated {formatRelativeTime(selectedNote.updatedAt)}
                          </div>
                        </div>
                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          <div className="rounded-[18px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-2)_72%,transparent)] px-4 py-4">
                            <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--app-muted)]">Newer baseline</div>
                            {newerBaseline ? (
                              <>
                                <div className="mt-2 text-sm font-medium text-[var(--app-text)]">{newerBaseline.title}</div>
                                <div className="mt-2 text-xs leading-5 text-[var(--app-muted)]">
                                  {shortText(newerBaseline.content, 'Newer baseline ready for reuse.')}
                                </div>
                                {newerBaselineProvenance ? (
                                  <div className="mt-2 text-[11px] leading-5 text-[var(--app-muted)]">
                                    {formatBaselineProvenanceProvider(newerBaselineProvenance) || 'Provider unavailable'}
                                    {newerBaselineProvenance.acceptedLabel ? ` · ${newerBaselineProvenance.acceptedLabel}` : ''}
                                  </div>
                                ) : null}
                                {newerBaselineProvenance ? (
                                  <div className="mt-2 text-[11px] leading-5 text-[var(--app-muted)]">
                                    {(() => {
                                      const anchor = buildBaselineDecisionAnchor(newerBaselineProvenance);
                                      return anchor ? `Decision anchor · ${anchor.status}` : null;
                                    })()}
                                  </div>
                                ) : null}
                                <div className="mt-2 text-[11px] text-[var(--app-muted)]">
                                  {summarizeBaselineDrift(diffBaselineNote(newerBaseline, selectedNote))}
                                </div>
                                <div className="mt-3 text-[11px] text-[var(--app-muted)]">
                                  {formatRelativeTime(newerBaseline.updatedAt)} · {newerBaseline.linkedProjectIds.length} projects ·{' '}
                                  {newerBaseline.linkedQuestIds.length} quests
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setSelectedNoteId(newerBaseline.id)}
                                  className={`${panelButton} mt-4 border border-[var(--app-border)] px-3 py-2 text-[10px] font-semibold text-[var(--app-text)] hover:border-[var(--app-accent)]`}
                                >
                                  <FileText size={14} />
                                  Open Newer
                                </button>
                              </>
                            ) : (
                              <div className="mt-3 text-sm text-[var(--app-muted)]">This is the newest promoted baseline.</div>
                            )}
                          </div>
                          <div className="rounded-[18px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-2)_72%,transparent)] px-4 py-4">
                            <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--app-muted)]">Older baseline</div>
                            {olderBaseline ? (
                              <>
                                <div className="mt-2 text-sm font-medium text-[var(--app-text)]">{olderBaseline.title}</div>
                                <div className="mt-2 text-xs leading-5 text-[var(--app-muted)]">
                                  {shortText(olderBaseline.content, 'Earlier baseline kept for comparison.')}
                                </div>
                                {olderBaselineProvenance ? (
                                  <div className="mt-2 text-[11px] leading-5 text-[var(--app-muted)]">
                                    {formatBaselineProvenanceProvider(olderBaselineProvenance) || 'Provider unavailable'}
                                    {olderBaselineProvenance.acceptedLabel ? ` · ${olderBaselineProvenance.acceptedLabel}` : ''}
                                  </div>
                                ) : null}
                                {olderBaselineProvenance ? (
                                  <div className="mt-2 text-[11px] leading-5 text-[var(--app-muted)]">
                                    {(() => {
                                      const anchor = buildBaselineDecisionAnchor(olderBaselineProvenance);
                                      return anchor ? `Decision anchor · ${anchor.status}` : null;
                                    })()}
                                  </div>
                                ) : null}
                                <div className="mt-2 text-[11px] text-[var(--app-muted)]">
                                  {summarizeBaselineDrift(baselineDriftFromPrevious || diffBaselineNote(selectedNote, olderBaseline))}
                                </div>
                                <div className="mt-3 text-[11px] text-[var(--app-muted)]">
                                  {formatRelativeTime(olderBaseline.updatedAt)} · {olderBaseline.linkedProjectIds.length} projects ·{' '}
                                  {olderBaseline.linkedQuestIds.length} quests
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setSelectedNoteId(olderBaseline.id)}
                                  className={`${panelButton} mt-4 border border-[var(--app-border)] px-3 py-2 text-[10px] font-semibold text-[var(--app-text)] hover:border-[var(--app-accent)]`}
                                >
                                  <FileText size={14} />
                                  Open Older
                                </button>
                              </>
                            ) : (
                              <div className="mt-3 text-sm text-[var(--app-muted)]">No earlier baseline exists in this timeline yet.</div>
                            )}
                          </div>
                        </div>
                        {latestBaselineNote && latestBaselineNote.id !== selectedNote.id ? (
                          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-2)_68%,transparent)] px-4 py-3">
                            <div className="text-sm text-[var(--app-muted)]">
                              Latest promoted baseline:
                              <span className="ml-2 font-medium text-[var(--app-text)]">{latestBaselineNote.title}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => setSelectedNoteId(latestBaselineNote.id)}
                              className={`${panelButton} border border-[var(--app-accent)] bg-[color-mix(in_srgb,var(--app-accent)_12%,transparent)] px-3 py-2 text-[10px] font-semibold text-[var(--app-text)]`}
                            >
                              <FileText size={14} />
                              Jump To Latest
                            </button>
                          </div>
                        ) : null}
                        {baselineDriftFromPrevious ? (
                          <div className="mt-4 rounded-[18px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-2)_68%,transparent)] px-4 py-4">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--app-muted)]">Change From Previous Record</div>
                                <div className="mt-1 text-sm text-[var(--app-muted)]">
                                  {summarizeBaselineDrift(baselineDriftFromPrevious)}
                                </div>
                              </div>
                              <div className={`${inlineChip} px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-[var(--app-muted)]`}>
                                previous accepted
                              </div>
                            </div>
                            <div className="mt-4 grid gap-3 md:grid-cols-2">
                              <div className="rounded-[16px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_74%,transparent)] px-4 py-3">
                                <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--app-muted)]">Structure</div>
                                <div className="mt-2 text-xs leading-5 text-[var(--app-muted)]">
                                  Title {baselineDriftFromPrevious.titleChanged ? 'changed' : 'unchanged'} · Content{' '}
                                  {baselineDriftFromPrevious.contentChanged ? 'changed' : 'unchanged'}
                                </div>
                              </div>
                              <div className="rounded-[16px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_74%,transparent)] px-4 py-3">
                                <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--app-muted)]">Linked Scope</div>
                                <div className="mt-2 text-xs leading-5 text-[var(--app-muted)]">
                                  {baselineDriftFromPrevious.addedProjectIds.length || baselineDriftFromPrevious.removedProjectIds.length
                                    ? `${baselineDriftFromPrevious.addedProjectIds.length} project added · ${baselineDriftFromPrevious.removedProjectIds.length} removed`
                                    : 'Project links unchanged'}
                                  <br />
                                  {baselineDriftFromPrevious.addedQuestIds.length || baselineDriftFromPrevious.removedQuestIds.length
                                    ? `${baselineDriftFromPrevious.addedQuestIds.length} quest added · ${baselineDriftFromPrevious.removedQuestIds.length} removed`
                                    : 'Quest links unchanged'}
                                </div>
                              </div>
                              <div className="rounded-[16px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_74%,transparent)] px-4 py-3 md:col-span-2">
                                <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--app-muted)]">Tag Drift</div>
                                <div className="mt-2 text-xs leading-5 text-[var(--app-muted)]">
                                  {baselineDriftFromPrevious.addedTags.length
                                    ? `Added: ${baselineDriftFromPrevious.addedTags.join(' · ')}`
                                    : 'No tags added'}
                                  <br />
                                  {baselineDriftFromPrevious.removedTags.length
                                    ? `Removed: ${baselineDriftFromPrevious.removedTags.join(' · ')}`
                                    : 'No tags removed'}
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                    <label className="flex flex-col gap-2 text-sm text-[var(--app-muted)]">
                      <span className="text-[10px] uppercase tracking-[0.18em]">Kind</span>
                      <select
                        value={selectedNote.kind}
                        onChange={(event) => updateNote(selectedNote.id, { kind: event.target.value as LabNoteKind })}
                        className={fieldInput}
                      >
                        {noteKindOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-2 text-sm text-[var(--app-muted)]">
                      <span className="text-[10px] uppercase tracking-[0.18em]">Status</span>
                      <select
                        value={selectedNote.status}
                        onChange={(event) => updateNote(selectedNote.id, { status: event.target.value as LabNote['status'] })}
                        className={fieldInput}
                      >
                        {['active', 'draft', 'archived'].map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-2 text-sm text-[var(--app-muted)]">
                      <span className="text-[10px] uppercase tracking-[0.18em]">Tags</span>
                      <input
                        value={selectedNote.tags.join(', ')}
                        onChange={(event) => updateNote(selectedNote.id, { tags: commaSplit(event.target.value) })}
                        placeholder="lab, architecture"
                        className={fieldInput}
                      />
                    </label>
                  </div>

                  <textarea
                    value={selectedNote.content}
                    onChange={(event) => updateNote(selectedNote.id, { content: event.target.value })}
                    className={`${fieldTextarea} min-h-[260px] w-full`}
                  />

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className={`${detailPanel} p-4`}>
                      <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">Linked Assistant Projects</div>
                      <div className="mt-3 flex max-h-[220px] flex-col gap-2 overflow-y-auto">
                        {assistantProjects.map((project) => (
                          <label key={project.id} className="flex items-start gap-2 text-sm text-[var(--app-muted)]">
                            <input
                              type="checkbox"
                              checked={selectedNote.linkedProjectIds.includes(project.id)}
                              onChange={(event) => syncProjectNoteLink(project.id, selectedNote.id, event.target.checked)}
                            />
                            <span>{project.title}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className={`${detailPanel} p-4`}>
                      <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">Linked Quests</div>
                      <div className="mt-3 flex max-h-[220px] flex-col gap-2 overflow-y-auto">
                        {tasks.slice(0, 14).map((task) => (
                          <label key={task.id} className="flex items-start gap-2 text-sm text-[var(--app-muted)]">
                            <input
                              type="checkbox"
                              checked={selectedNote.linkedQuestIds.includes(task.id)}
                              onChange={() =>
                                updateNote(selectedNote.id, {
                                  linkedQuestIds: toggleId(selectedNote.linkedQuestIds, task.id),
                                })
                              }
                            />
                            <span>{task.title}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => handleCreateQuestFromNote(selectedNote)}
                      className={`${panelButton} border border-[var(--app-accent)] bg-[color-mix(in_srgb,var(--app-accent)_14%,transparent)] px-4 py-2 text-[10px] font-semibold text-[var(--app-text)]`}
                    >
                      <Plus size={14} />
                      {isBaselineNote(selectedNote) ? 'Create Quest From Baseline' : 'Create Quest From Note'}
                    </button>
                    <button
                      type="button"
                      onClick={() => (isBaselineNote(selectedNote) ? sendBaselineToDusk(selectedNote) : handoffToDusk(
                        selectedNote.title,
                        selectedNote.content,
                        selectedNote.tags,
                        selectedNote.linkedQuestIds,
                        selectedNote.linkedProjectIds
                      ))}
                      className={`${panelButton} border border-[var(--app-border)] px-4 py-2 text-[10px] font-semibold text-[var(--app-text)] hover:border-[var(--app-accent)]`}
                    >
                      <Send size={14} />
                      {isBaselineNote(selectedNote) ? 'Send Baseline To Dusk' : 'Hand Off To Dusk'}
                    </button>
                    {isBaselineNote(selectedNote) && olderBaseline ? (
                      <button
                        type="button"
                        onClick={() => sendBaselineCompareToDusk(selectedNote, olderBaseline)}
                        className={`${panelButton} border border-[var(--app-border)] px-4 py-2 text-[10px] font-semibold text-[var(--app-text)] hover:border-[var(--app-accent)]`}
                      >
                        <Link2 size={14} />
                        Compare In Dusk
                      </button>
                    ) : null}
                  </div>

                  <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--app-muted)]">
                    Updated {new Date(selectedNote.updatedAt).toLocaleString()}
                  </div>
                </div>
              ) : (
                <div className="flex min-h-[420px] items-center justify-center text-sm text-[var(--app-muted)]">No note selected.</div>
              )}
            </article>
          </section>
        ) : null}

        {activeSection === 'automations' ? (
          <section className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
            <article className={`${detailCard} p-5`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--app-muted)]">Automations</div>
                  <div className="mt-1 text-sm text-[var(--app-muted)]">Visible, event-driven, and reversible. No giant automation sprawl.</div>
                </div>
                <div className={`${inlineChip} px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-[var(--app-muted)]`}>
                  {enabledAutomations}/{automations.length} enabled
                </div>
              </div>
              <div className="mt-4 flex max-h-[780px] flex-col gap-3 overflow-y-auto pr-1">
                {automations.map((automation) => (
                  <button
                    key={automation.id}
                    type="button"
                    onClick={() => setSelectedAutomationId(automation.id)}
                    className={`${listCard} px-4 py-4 text-left ${
                      selectedAutomation?.id === automation.id
                        ? 'is-active'
                        : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-[var(--app-text)]">{automation.name}</div>
                        <div className="mt-1 text-[10px] uppercase tracking-[0.16em] text-[var(--app-muted)]">
                          {automation.scope} · {automation.mode} · {automation.enabled ? 'enabled' : 'disabled'}
                        </div>
                        <div className="mt-3 text-xs leading-5 text-[var(--app-muted)]">{shortText(automation.description, 'No description yet.')}</div>
                      </div>
                      {automation.enabled ? <CheckCircle2 size={14} className="shrink-0 text-[#74e2b8]" /> : null}
                    </div>
                  </button>
                ))}
              </div>
            </article>

            <article className={`${detailCard} p-5`}>
              {selectedAutomation ? (
                <div className="flex flex-col gap-5">
                  <div className="flex items-start justify-between gap-3">
                    <input
                      value={selectedAutomation.name}
                      onChange={(event) => updateAutomation(selectedAutomation.id, { name: event.target.value })}
                      className="min-w-0 flex-1 bg-transparent text-2xl font-semibold text-[var(--app-text)] outline-none"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => toggleAutomation(selectedAutomation.id)}
                        className={`${iconButton} ${
                          selectedAutomation.enabled
                            ? 'border-[color-mix(in_srgb,#74e2b8_40%,transparent)] bg-[color-mix(in_srgb,#74e2b8_12%,transparent)] text-[#74e2b8]'
                            : 'border-[var(--app-border)] text-[var(--app-muted)]'
                        }`}
                      >
                        {selectedAutomation.enabled ? <Pause size={14} /> : <PlayCircle size={14} />}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteAutomation(selectedAutomation.id)}
                        className={iconButton}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <label className="flex flex-col gap-2 text-sm text-[var(--app-muted)]">
                      <span className="text-[10px] uppercase tracking-[0.18em]">Scope</span>
                      <select
                        value={selectedAutomation.scope}
                        onChange={(event) => updateAutomation(selectedAutomation.id, { scope: event.target.value as LabAutomationScope })}
                        className={fieldInput}
                      >
                        {automationScopeOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-2 text-sm text-[var(--app-muted)]">
                      <span className="text-[10px] uppercase tracking-[0.18em]">Mode</span>
                      <select
                        value={selectedAutomation.mode}
                        onChange={(event) => updateAutomation(selectedAutomation.id, { mode: event.target.value as LabAutomationMode })}
                        className={fieldInput}
                      >
                        {automationModeOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className={`${detailPanel} px-3 py-3`}>
                      <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">Last Run</div>
                      <div className="mt-2 text-sm text-[var(--app-text)]">{formatRelativeTime(selectedAutomation.lastRunAt)}</div>
                    </div>
                  </div>

                  <label className="flex flex-col gap-2 text-sm text-[var(--app-muted)]">
                    <span className="text-[10px] uppercase tracking-[0.18em]">Description</span>
                    <textarea
                      value={selectedAutomation.description}
                      onChange={(event) => updateAutomation(selectedAutomation.id, { description: event.target.value })}
                      className={`${fieldTextarea} min-h-[90px]`}
                    />
                  </label>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <label className="flex flex-col gap-2 text-sm text-[var(--app-muted)]">
                      <span className="text-[10px] uppercase tracking-[0.18em]">Trigger</span>
                      <textarea
                        value={selectedAutomation.triggerSummary}
                        onChange={(event) => updateAutomation(selectedAutomation.id, { triggerSummary: event.target.value })}
                        className={`${fieldTextarea} min-h-[90px]`}
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-sm text-[var(--app-muted)]">
                      <span className="text-[10px] uppercase tracking-[0.18em]">Action</span>
                      <textarea
                        value={selectedAutomation.actionSummary}
                        onChange={(event) => updateAutomation(selectedAutomation.id, { actionSummary: event.target.value })}
                        className={`${fieldTextarea} min-h-[90px]`}
                      />
                    </label>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className={`${detailPanel} p-4`}>
                      <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">Linked Notes</div>
                      <div className="mt-3 flex max-h-[220px] flex-col gap-2 overflow-y-auto">
                        {notes.map((note) => (
                          <label key={note.id} className="flex items-start gap-2 text-sm text-[var(--app-muted)]">
                            <input
                              type="checkbox"
                              checked={selectedAutomation.linkedNoteIds.includes(note.id)}
                              onChange={() =>
                                updateAutomation(selectedAutomation.id, {
                                  linkedNoteIds: toggleId(selectedAutomation.linkedNoteIds, note.id),
                                })
                              }
                            />
                            <span>{note.title}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className={`${detailPanel} p-4`}>
                      <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">Linked Projects</div>
                      <div className="mt-3 flex max-h-[220px] flex-col gap-2 overflow-y-auto">
                        {assistantProjects.map((project) => (
                          <label key={project.id} className="flex items-start gap-2 text-sm text-[var(--app-muted)]">
                            <input
                              type="checkbox"
                              checked={selectedAutomation.linkedProjectIds.includes(project.id)}
                              onChange={(event) =>
                                syncProjectAutomationLink(project.id, selectedAutomation.id, event.target.checked)
                              }
                            />
                            <span>{project.title}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => runAutomation(selectedAutomation.id)}
                      className={`${panelButton} border border-[var(--app-accent)] bg-[color-mix(in_srgb,var(--app-accent)_14%,transparent)] px-4 py-2 text-[10px] font-semibold text-[var(--app-text)]`}
                    >
                      <PlayCircle size={14} />
                      Run Now
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handoffToDusk(
                          selectedAutomation.name,
                          `${selectedAutomation.description}\n\nTrigger: ${selectedAutomation.triggerSummary}\nAction: ${selectedAutomation.actionSummary}`,
                          [selectedAutomation.scope, selectedAutomation.mode, 'automation'],
                          [],
                          selectedAutomation.linkedProjectIds
                        )
                      }
                      className={`${panelButton} border border-[var(--app-border)] px-4 py-2 text-[10px] font-semibold text-[var(--app-text)] hover:border-[var(--app-accent)]`}
                    >
                      <Send size={14} />
                      Hand Off To Dusk
                    </button>
                  </div>

                  <div className={`${detailPanel} border-dashed p-4`}>
                    <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">New Automation</div>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <input
                        value={draftAutomationName}
                        onChange={(event) => setDraftAutomationName(event.target.value)}
                        placeholder="Automation name"
                        className={fieldInput}
                      />
                      <select
                        value={draftAutomationScope}
                        onChange={(event) => setDraftAutomationScope(event.target.value as LabAutomationScope)}
                        className={fieldInput}
                      >
                        {automationScopeOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <select
                      value={draftAutomationMode}
                      onChange={(event) => setDraftAutomationMode(event.target.value as LabAutomationMode)}
                      className={`mt-3 w-full ${fieldInput}`}
                    >
                      {automationModeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <textarea
                      value={draftAutomationDescription}
                      onChange={(event) => setDraftAutomationDescription(event.target.value)}
                      placeholder="Why should this rule exist?"
                      className={`mt-3 min-h-[88px] w-full ${fieldTextarea}`}
                    />
                    <input
                      value={draftAutomationTrigger}
                      onChange={(event) => setDraftAutomationTrigger(event.target.value)}
                      placeholder="Trigger summary"
                      className={`mt-3 w-full ${fieldInput}`}
                    />
                    <textarea
                      value={draftAutomationAction}
                      onChange={(event) => setDraftAutomationAction(event.target.value)}
                      placeholder="Action summary"
                      className={`mt-3 min-h-[88px] w-full ${fieldTextarea}`}
                    />
                    <button
                      type="button"
                      onClick={handleCreateAutomation}
                      disabled={!draftAutomationName.trim() || !draftAutomationTrigger.trim() || !draftAutomationAction.trim()}
                      className={`mt-3 ${panelButton} border border-[var(--app-accent)] bg-[color-mix(in_srgb,var(--app-accent)_14%,transparent)] px-4 py-2 text-[10px] font-semibold text-[var(--app-text)] disabled:opacity-40`}
                    >
                      <Plus size={14} />
                      Add Rule
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex min-h-[420px] items-center justify-center text-sm text-[var(--app-muted)]">No automation selected.</div>
              )}
            </article>
          </section>
        ) : null}

        {activeSection === 'media' ? (
          <section className="grid gap-6 xl:grid-cols-[0.76fr_0.88fr_1.08fr]">
            <article className="rounded-[24px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_86%,transparent)] p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--app-muted)]">Accounts</div>
                  <div className="mt-1 text-sm text-[var(--app-muted)]">Channels you want to run or monitor with a clear cadence and focus.</div>
                </div>
                <div className="rounded-full border border-[var(--app-border)] px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-[var(--app-muted)]">
                  {activeMediaAccounts}/{mediaAccounts.length} active
                </div>
              </div>
              <div className="mt-4 flex max-h-[420px] flex-col gap-3 overflow-y-auto pr-1">
                {mediaAccounts.map((account) => (
                  <button
                    key={account.id}
                    type="button"
                    onClick={() => setSelectedMediaAccountId(account.id)}
                    className={`rounded-[20px] border px-4 py-4 text-left ${
                      selectedMediaAccount?.id === account.id
                        ? 'border-[var(--app-accent)] bg-[color-mix(in_srgb,var(--app-accent)_12%,transparent)]'
                        : 'border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-2)_72%,transparent)]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-[var(--app-text)]">{account.handle}</div>
                        <div className="mt-1 text-[10px] uppercase tracking-[0.16em] text-[var(--app-muted)]">
                          {getMediaPlatformLabel(account.platform)} · {account.status}
                        </div>
                      </div>
                      <Radio size={14} className="shrink-0 text-[var(--app-accent)]" />
                    </div>
                    <div className="mt-3 text-xs leading-5 text-[var(--app-muted)]">{shortText(account.focus, 'No focus set yet.')}</div>
                  </button>
                ))}
              </div>

              {selectedMediaAccount ? (
                <div className="mt-5 flex flex-col gap-4 rounded-[20px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-2)_72%,transparent)] p-4">
                  <input
                    value={selectedMediaAccount.handle}
                    onChange={(event) => updateMediaAccount(selectedMediaAccount.id, { handle: event.target.value })}
                    className="bg-transparent text-lg font-semibold text-[var(--app-text)] outline-none"
                  />
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="flex flex-col gap-2 text-sm text-[var(--app-muted)]">
                      <span className="text-[10px] uppercase tracking-[0.18em]">Platform</span>
                      <select
                        value={selectedMediaAccount.platform}
                        onChange={(event) => updateMediaAccount(selectedMediaAccount.id, { platform: event.target.value as LabMediaPlatform })}
                        className="rounded-2xl border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_78%,transparent)] px-3 py-2.5 text-sm text-[var(--app-text)] outline-none focus:border-[var(--app-accent)]"
                      >
                        {mediaPlatformOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-2 text-sm text-[var(--app-muted)]">
                      <span className="text-[10px] uppercase tracking-[0.18em]">Status</span>
                      <select
                        value={selectedMediaAccount.status}
                        onChange={(event) => updateMediaAccount(selectedMediaAccount.id, { status: event.target.value as LabMediaAccountStatus })}
                        className="rounded-2xl border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_78%,transparent)] px-3 py-2.5 text-sm text-[var(--app-text)] outline-none focus:border-[var(--app-accent)]"
                      >
                        {mediaAccountStatusOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <label className="flex flex-col gap-2 text-sm text-[var(--app-muted)]">
                    <span className="text-[10px] uppercase tracking-[0.18em]">Cadence</span>
                    <input
                      value={selectedMediaAccount.cadence}
                      onChange={(event) => updateMediaAccount(selectedMediaAccount.id, { cadence: event.target.value })}
                      className="rounded-2xl border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_78%,transparent)] px-3 py-2.5 text-sm text-[var(--app-text)] outline-none focus:border-[var(--app-accent)]"
                    />
                  </label>
                  <label className="flex flex-col gap-2 text-sm text-[var(--app-muted)]">
                    <span className="text-[10px] uppercase tracking-[0.18em]">Focus</span>
                    <textarea
                      value={selectedMediaAccount.focus}
                      onChange={(event) => updateMediaAccount(selectedMediaAccount.id, { focus: event.target.value })}
                      className="min-h-[90px] rounded-[20px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_78%,transparent)] px-3 py-3 text-sm leading-6 text-[var(--app-text)] outline-none focus:border-[var(--app-accent)]"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => deleteMediaAccount(selectedMediaAccount.id)}
                    className="inline-flex items-center gap-2 self-start rounded-2xl border border-[var(--app-border)] px-3 py-2 text-[10px] uppercase tracking-[0.16em] text-[var(--app-text)] hover:border-[var(--app-accent)]"
                  >
                    <Trash2 size={14} />
                    Remove Account
                  </button>
                </div>
              ) : null}

              <div className="mt-5 rounded-[20px] border border-dashed border-[var(--app-border)] p-4">
                <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">New Account</div>
                <select
                  value={draftMediaPlatform}
                  onChange={(event) => setDraftMediaPlatform(event.target.value as LabMediaPlatform)}
                  className="mt-3 w-full rounded-2xl border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_78%,transparent)] px-3 py-2.5 text-sm text-[var(--app-text)] outline-none focus:border-[var(--app-accent)]"
                >
                  {mediaPlatformOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <input
                  value={draftMediaHandle}
                  onChange={(event) => setDraftMediaHandle(event.target.value)}
                  placeholder="@handle or channel name"
                  className="mt-3 w-full rounded-2xl border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_78%,transparent)] px-3 py-2.5 text-sm text-[var(--app-text)] outline-none focus:border-[var(--app-accent)]"
                />
                <textarea
                  value={draftMediaFocus}
                  onChange={(event) => setDraftMediaFocus(event.target.value)}
                  placeholder="What does this channel exist for?"
                  className="mt-3 min-h-[88px] w-full rounded-2xl border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_78%,transparent)] px-3 py-2.5 text-sm text-[var(--app-text)] outline-none focus:border-[var(--app-accent)]"
                />
                <button
                  type="button"
                  onClick={handleCreateMediaAccount}
                  disabled={!draftMediaHandle.trim()}
                  className="mt-3 inline-flex items-center gap-2 rounded-2xl border border-[var(--app-accent)] bg-[color-mix(in_srgb,var(--app-accent)_14%,transparent)] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--app-text)] disabled:opacity-40"
                >
                  <Plus size={14} />
                  Add Account
                </button>
              </div>
            </article>

            <article className="rounded-[24px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_86%,transparent)] p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--app-muted)]">Publishing Queue</div>
                  <div className="mt-1 text-sm text-[var(--app-muted)]">Keep what should go out next visible, scheduled, and tied to a campaign when needed.</div>
                </div>
                <div className="rounded-full border border-[var(--app-border)] px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-[var(--app-muted)]">
                  {readyMediaQueueItems} ready
                </div>
              </div>
              <div className="mt-4 flex max-h-[420px] flex-col gap-3 overflow-y-auto pr-1">
                {mediaQueue.filter(Boolean).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedMediaQueueId(item.id)}
                    className={`rounded-[20px] border px-4 py-4 text-left ${
                      selectedMediaQueueItem?.id === item.id
                        ? 'border-[var(--app-accent)] bg-[color-mix(in_srgb,var(--app-accent)_12%,transparent)]'
                        : 'border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-2)_72%,transparent)]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-[var(--app-text)]">{item.title}</div>
                        <div className="mt-1 text-[10px] uppercase tracking-[0.16em] text-[var(--app-muted)]">
                          {getMediaPlatformLabel(item.channel)} · {item.status}
                        </div>
                      </div>
                      <CalendarClock size={14} className="shrink-0 text-[var(--app-accent)]" />
                    </div>
                    <div className="mt-3 text-xs leading-5 text-[var(--app-muted)]">{shortText(item.summary, 'No summary yet.')}</div>
                  </button>
                ))}
              </div>

              {selectedMediaQueueItem ? (
                <div className="mt-5 flex flex-col gap-4 rounded-[20px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-2)_72%,transparent)] p-4">
                  <input
                    value={selectedMediaQueueItem.title}
                    onChange={(event) => updateMediaQueueItem(selectedMediaQueueItem.id, { title: event.target.value })}
                    className="bg-transparent text-lg font-semibold text-[var(--app-text)] outline-none"
                  />
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="flex flex-col gap-2 text-sm text-[var(--app-muted)]">
                      <span className="text-[10px] uppercase tracking-[0.18em]">Channel</span>
                      <select
                        value={selectedMediaQueueItem.channel}
                        onChange={(event) => updateMediaQueueItem(selectedMediaQueueItem.id, { channel: event.target.value as LabMediaPlatform })}
                        className="rounded-2xl border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_78%,transparent)] px-3 py-2.5 text-sm text-[var(--app-text)] outline-none focus:border-[var(--app-accent)]"
                      >
                        {mediaPlatformOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-2 text-sm text-[var(--app-muted)]">
                      <span className="text-[10px] uppercase tracking-[0.18em]">Status</span>
                      <select
                        value={selectedMediaQueueItem.status}
                        onChange={(event) => updateMediaQueueItem(selectedMediaQueueItem.id, { status: event.target.value as LabPublishStatus })}
                        className="rounded-2xl border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_78%,transparent)] px-3 py-2.5 text-sm text-[var(--app-text)] outline-none focus:border-[var(--app-accent)]"
                      >
                        {publishStatusOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <label className="flex flex-col gap-2 text-sm text-[var(--app-muted)]">
                    <span className="text-[10px] uppercase tracking-[0.18em]">Scheduled</span>
                    <input
                      type="datetime-local"
                      value={toDateTimeLocalValue(selectedMediaQueueItem.scheduledAt)}
                      onChange={(event) => updateMediaQueueItem(selectedMediaQueueItem.id, { scheduledAt: parseDateTimeLocalValue(event.target.value) })}
                      className="rounded-2xl border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_78%,transparent)] px-3 py-2.5 text-sm text-[var(--app-text)] outline-none focus:border-[var(--app-accent)]"
                    />
                  </label>
                  <label className="flex flex-col gap-2 text-sm text-[var(--app-muted)]">
                    <span className="text-[10px] uppercase tracking-[0.18em]">Campaign</span>
                    <select
                      value={selectedMediaQueueItem.campaignId || ''}
                      onChange={(event) => updateMediaQueueItem(selectedMediaQueueItem.id, { campaignId: event.target.value || undefined })}
                      className="rounded-2xl border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_78%,transparent)] px-3 py-2.5 text-sm text-[var(--app-text)] outline-none focus:border-[var(--app-accent)]"
                    >
                      <option value="">No campaign</option>
                      {mediaCampaigns.map((campaign) => (
                        <option key={campaign.id} value={campaign.id}>
                          {campaign.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <textarea
                    value={selectedMediaQueueItem.summary}
                    onChange={(event) => updateMediaQueueItem(selectedMediaQueueItem.id, { summary: event.target.value })}
                    className="min-h-[110px] rounded-[20px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_78%,transparent)] px-3 py-3 text-sm leading-6 text-[var(--app-text)] outline-none focus:border-[var(--app-accent)]"
                  />
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        handoffToDusk(
                          selectedMediaQueueItem.title,
                          `${selectedMediaQueueItem.summary}\n\nChannel: ${getMediaPlatformLabel(selectedMediaQueueItem.channel)}\nStatus: ${selectedMediaQueueItem.status}\nScheduled: ${formatSchedule(selectedMediaQueueItem.scheduledAt)}`,
                          ['media', 'queue', selectedMediaQueueItem.channel]
                        )
                      }
                      className="inline-flex items-center gap-2 rounded-2xl border border-[var(--app-accent)] bg-[color-mix(in_srgb,var(--app-accent)_14%,transparent)] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--app-text)]"
                    >
                      <Send size={14} />
                      Hand Off To Dusk
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteMediaQueueItem(selectedMediaQueueItem.id)}
                      className="inline-flex items-center gap-2 rounded-2xl border border-[var(--app-border)] px-4 py-2 text-[10px] uppercase tracking-[0.16em] text-[var(--app-text)] hover:border-[var(--app-accent)]"
                    >
                      <Trash2 size={14} />
                      Remove Item
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="mt-5 rounded-[20px] border border-dashed border-[var(--app-border)] p-4">
                <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">New Queue Item</div>
                <input
                  value={draftQueueTitle}
                  onChange={(event) => setDraftQueueTitle(event.target.value)}
                  placeholder="Post or asset title"
                  className="mt-3 w-full rounded-2xl border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_78%,transparent)] px-3 py-2.5 text-sm text-[var(--app-text)] outline-none focus:border-[var(--app-accent)]"
                />
                <select
                  value={draftQueueChannel}
                  onChange={(event) => setDraftQueueChannel(event.target.value as LabMediaPlatform)}
                  className="mt-3 w-full rounded-2xl border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_78%,transparent)] px-3 py-2.5 text-sm text-[var(--app-text)] outline-none focus:border-[var(--app-accent)]"
                >
                  {mediaPlatformOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <textarea
                  value={draftQueueSummary}
                  onChange={(event) => setDraftQueueSummary(event.target.value)}
                  placeholder="What is this item supposed to communicate?"
                  className="mt-3 min-h-[88px] w-full rounded-2xl border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_78%,transparent)] px-3 py-2.5 text-sm text-[var(--app-text)] outline-none focus:border-[var(--app-accent)]"
                />
                <button
                  type="button"
                  onClick={handleCreateMediaQueueItem}
                  disabled={!draftQueueTitle.trim()}
                  className="mt-3 inline-flex items-center gap-2 rounded-2xl border border-[var(--app-accent)] bg-[color-mix(in_srgb,var(--app-accent)_14%,transparent)] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--app-text)] disabled:opacity-40"
                >
                  <Plus size={14} />
                  Add To Queue
                </button>
              </div>
            </article>

            <article className="rounded-[24px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_86%,transparent)] p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--app-muted)]">Campaigns</div>
                  <div className="mt-1 text-sm text-[var(--app-muted)]">Keep campaign intent tied to project context, notes, and what should publish next.</div>
                </div>
                <div className="rounded-full border border-[var(--app-border)] px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-[var(--app-muted)]">
                  {activeMediaCampaigns}/{mediaCampaigns.length} active
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <MiniStat label="Accounts" value={`${mediaAccounts.length}`} />
                <MiniStat label="Queue Ready" value={`${readyMediaQueueItems}`} accent="text-[#f0c45a]" />
                <MiniStat label="Published" value={`${publishedMediaQueueItems}`} />
              </div>

              <div className="mt-4 flex max-h-[240px] flex-col gap-3 overflow-y-auto pr-1">
                {mediaCampaigns.map((campaign) => (
                  <button
                    key={campaign.id}
                    type="button"
                    onClick={() => setSelectedMediaCampaignId(campaign.id)}
                    className={`rounded-[20px] border px-4 py-4 text-left ${
                      selectedMediaCampaign?.id === campaign.id
                        ? 'border-[var(--app-accent)] bg-[color-mix(in_srgb,var(--app-accent)_12%,transparent)]'
                        : 'border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-2)_72%,transparent)]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-[var(--app-text)]">{campaign.title}</div>
                        <div className="mt-1 text-[10px] uppercase tracking-[0.16em] text-[var(--app-muted)]">
                          {campaign.status} · {getMediaPlatformLabel(campaign.primaryChannel)}
                        </div>
                      </div>
                      <Megaphone size={14} className="shrink-0 text-[var(--app-accent)]" />
                    </div>
                    <div className="mt-3 text-xs leading-5 text-[var(--app-muted)]">{shortText(campaign.objective, 'No objective yet.')}</div>
                  </button>
                ))}
              </div>

              {selectedMediaCampaign ? (
                <div className="mt-5 flex flex-col gap-5 rounded-[20px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-2)_72%,transparent)] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <input
                      value={selectedMediaCampaign.title}
                      onChange={(event) => updateMediaCampaign(selectedMediaCampaign.id, { title: event.target.value })}
                      className="min-w-0 flex-1 bg-transparent text-2xl font-semibold text-[var(--app-text)] outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => deleteMediaCampaign(selectedMediaCampaign.id)}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--app-border)] text-[var(--app-muted)] hover:border-[var(--app-accent)] hover:text-[var(--app-accent)]"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="flex flex-col gap-2 text-sm text-[var(--app-muted)]">
                      <span className="text-[10px] uppercase tracking-[0.18em]">Primary Channel</span>
                      <select
                        value={selectedMediaCampaign.primaryChannel}
                        onChange={(event) => updateMediaCampaign(selectedMediaCampaign.id, { primaryChannel: event.target.value as LabMediaPlatform })}
                        className="rounded-2xl border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_78%,transparent)] px-3 py-2.5 text-sm text-[var(--app-text)] outline-none focus:border-[var(--app-accent)]"
                      >
                        {mediaPlatformOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-2 text-sm text-[var(--app-muted)]">
                      <span className="text-[10px] uppercase tracking-[0.18em]">Status</span>
                      <select
                        value={selectedMediaCampaign.status}
                        onChange={(event) => updateMediaCampaign(selectedMediaCampaign.id, { status: event.target.value as LabCampaignStatus })}
                        className="rounded-2xl border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_78%,transparent)] px-3 py-2.5 text-sm text-[var(--app-text)] outline-none focus:border-[var(--app-accent)]"
                      >
                        {campaignStatusOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <label className="flex flex-col gap-2 text-sm text-[var(--app-muted)]">
                    <span className="text-[10px] uppercase tracking-[0.18em]">Objective</span>
                    <textarea
                      value={selectedMediaCampaign.objective}
                      onChange={(event) => updateMediaCampaign(selectedMediaCampaign.id, { objective: event.target.value })}
                      className="min-h-[110px] rounded-[20px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_78%,transparent)] px-3 py-3 text-sm leading-6 text-[var(--app-text)] outline-none focus:border-[var(--app-accent)]"
                    />
                  </label>

                  <label className="flex flex-col gap-2 text-sm text-[var(--app-muted)]">
                    <span className="text-[10px] uppercase tracking-[0.18em]">Next Action</span>
                    <input
                      value={selectedMediaCampaign.nextAction}
                      onChange={(event) => updateMediaCampaign(selectedMediaCampaign.id, { nextAction: event.target.value })}
                      className="rounded-2xl border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_78%,transparent)] px-3 py-2.5 text-sm text-[var(--app-text)] outline-none focus:border-[var(--app-accent)]"
                    />
                  </label>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-[20px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_72%,transparent)] p-4">
                      <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">Linked Projects</div>
                      <div className="mt-3 flex max-h-[220px] flex-col gap-2 overflow-y-auto">
                        {assistantProjects.map((project) => (
                          <label key={project.id} className="flex items-start gap-2 text-sm text-[var(--app-muted)]">
                            <input
                              type="checkbox"
                              checked={selectedMediaCampaign.linkedProjectIds.includes(project.id)}
                              onChange={() =>
                                updateMediaCampaign(selectedMediaCampaign.id, {
                                  linkedProjectIds: toggleId(selectedMediaCampaign.linkedProjectIds, project.id),
                                })
                              }
                            />
                            <span>{project.title}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-[20px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_72%,transparent)] p-4">
                      <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">Linked Notes</div>
                      <div className="mt-3 flex max-h-[220px] flex-col gap-2 overflow-y-auto">
                        {notes.map((note) => (
                          <label key={note.id} className="flex items-start gap-2 text-sm text-[var(--app-muted)]">
                            <input
                              type="checkbox"
                              checked={selectedMediaCampaign.linkedNoteIds.includes(note.id)}
                              onChange={() =>
                                updateMediaCampaign(selectedMediaCampaign.id, {
                                  linkedNoteIds: toggleId(selectedMediaCampaign.linkedNoteIds, note.id),
                                })
                              }
                            />
                            <span>{note.title}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        handoffToDusk(
                          selectedMediaCampaign.title,
                          `${selectedMediaCampaign.objective}\n\nPrimary channel: ${getMediaPlatformLabel(selectedMediaCampaign.primaryChannel)}\nStatus: ${selectedMediaCampaign.status}\nNext action: ${selectedMediaCampaign.nextAction}`,
                          ['media', 'campaign', selectedMediaCampaign.primaryChannel],
                          [],
                          selectedMediaCampaign.linkedProjectIds
                        )
                      }
                      className="inline-flex items-center gap-2 rounded-2xl border border-[var(--app-accent)] bg-[color-mix(in_srgb,var(--app-accent)_14%,transparent)] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--app-text)]"
                    >
                      <Send size={14} />
                      Hand Off To Dusk
                    </button>
                    <div className="inline-flex items-center gap-2 rounded-2xl border border-[var(--app-border)] px-3 py-2 text-[10px] uppercase tracking-[0.16em] text-[var(--app-muted)]">
                      <BarChart3 size={13} />
                      {selectedMediaCampaign.linkedProjectIds.length} linked projects · {selectedMediaCampaign.linkedNoteIds.length} notes
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="mt-5 rounded-[20px] border border-dashed border-[var(--app-border)] p-4">
                <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">New Campaign</div>
                <input
                  value={draftCampaignTitle}
                  onChange={(event) => setDraftCampaignTitle(event.target.value)}
                  placeholder="Campaign title"
                  className="mt-3 w-full rounded-2xl border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_78%,transparent)] px-3 py-2.5 text-sm text-[var(--app-text)] outline-none focus:border-[var(--app-accent)]"
                />
                <select
                  value={draftCampaignChannel}
                  onChange={(event) => setDraftCampaignChannel(event.target.value as LabMediaPlatform)}
                  className="mt-3 w-full rounded-2xl border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_78%,transparent)] px-3 py-2.5 text-sm text-[var(--app-text)] outline-none focus:border-[var(--app-accent)]"
                >
                  {mediaPlatformOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <textarea
                  value={draftCampaignObjective}
                  onChange={(event) => setDraftCampaignObjective(event.target.value)}
                  placeholder="What should this campaign accomplish?"
                  className="mt-3 min-h-[88px] w-full rounded-2xl border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_78%,transparent)] px-3 py-2.5 text-sm text-[var(--app-text)] outline-none focus:border-[var(--app-accent)]"
                />
                <button
                  type="button"
                  onClick={handleCreateMediaCampaign}
                  disabled={!draftCampaignTitle.trim()}
                  className="mt-3 inline-flex items-center gap-2 rounded-2xl border border-[var(--app-accent)] bg-[color-mix(in_srgb,var(--app-accent)_14%,transparent)] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--app-text)] disabled:opacity-40"
                >
                  <Plus size={14} />
                  Create Campaign
                </button>
              </div>
            </article>
          </section>
        ) : null}

        {activeSection === 'templates' ? (
          <section className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
            <article className="rounded-[24px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_86%,transparent)] p-5">
              <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--app-muted)]">Templates</div>
              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {templates.map((template) => (
                  <div
                    key={template.id}
                    className="rounded-[20px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-2)_72%,transparent)] px-4 py-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-[var(--app-text)]">{template.title}</div>
                        <div className="mt-1 text-xs leading-5 text-[var(--app-muted)]">{template.description}</div>
                      </div>
                      <div className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.16em] ${accentClass[template.accent]}`}>
                        <WandSparkles size={12} />
                        {template.type}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => applyTemplate(template.id)}
                      className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-[var(--app-accent)] bg-[color-mix(in_srgb,var(--app-accent)_14%,transparent)] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--app-text)]"
                    >
                      <Plus size={14} />
                      Apply Template
                    </button>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-[24px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_86%,transparent)] p-5">
              <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--app-muted)]">Template Rules</div>
              <div className="mt-4 space-y-3 text-sm leading-6 text-[var(--app-muted)]">
                <p>Templates should reduce setup time, not hide structure. After applying one, the user should still understand what was created.</p>
                <p>Good templates create a note, project, or automation with one strong starting point and one clear next step.</p>
                <p>Bad templates create clutter or giant nested systems that the user never revisits.</p>
              </div>
              <div className="mt-4 rounded-[20px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-2)_72%,transparent)] p-4 text-sm leading-6 text-[var(--app-muted)]">
                Use templates when the structure repeats. Build custom systems when the logic is unique.
              </div>
            </article>
          </section>
        ) : null}
      </div>
    </div>
  );
};
