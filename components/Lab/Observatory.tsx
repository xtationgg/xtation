import React, { useMemo, useState } from 'react';
import {
  Activity,
  BookOpen,
  ChevronRight,
  Cpu,
  FileText,
  Layers,
  Package,
  Plus,
  Send,
  Sparkles,
  Zap,
} from 'lucide-react';
import { useLab } from '../../src/lab/LabProvider';
import { useXP } from '../XP/xpStore';
import { useXtationSettings } from '../../src/settings/SettingsProvider';
import { useLatestDuskBrief } from '../../src/dusk/useLatestDuskBrief';
import { openDuskBrief } from '../../src/dusk/bridge';
import { openLabNavigation } from '../../src/lab/bridge';
import {
  parseBaselineNoteProvenance,
  formatBaselineProvenanceProvider,
  buildBaselineDecisionAnchor,
} from '../../src/lab/baselineProvenance';
import { diffBaselineNote, summarizeBaselineDrift } from '../../src/lab/baselineDiff';
import {
  buildBaselineCompareHandoff,
  buildBaselineProvenanceHandoff,
} from '../../src/lab/baselineHandoff';
import {
  sectionCard,
  panelButton,
  listCard,
  iconButton,
  fieldInput,
  inlineChip,
  accentClass,
  formatRelativeTime,
  isBaselineNote,
  projectKindOptions,
  noteKindOptions,
  automationScopeOptions,
} from './shared';
import { SignalBar } from './SignalBar';
import type { LabProjectKind, LabAutomationScope } from '../../src/lab/types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ObservatoryProps {
  onNavigateToWorkbench: (piece: { type: 'note' | 'project' | 'automation'; id: string }) => void;
}

// ---------------------------------------------------------------------------
// Quick Build form types
// ---------------------------------------------------------------------------

type QuickBuildTarget = 'note' | 'project' | 'automation' | null;

// ---------------------------------------------------------------------------
// Section label component
// ---------------------------------------------------------------------------

const SectionLabel: React.FC<{ label: string; count?: number }> = ({ label, count }) => (
  <div className="mb-3 flex items-center gap-2">
    <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--app-muted)]">
      {label}
    </span>
    {typeof count === 'number' && (
      <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--app-muted)] opacity-60">
        ({count})
      </span>
    )}
  </div>
);

// ---------------------------------------------------------------------------
// MiniStat card
// ---------------------------------------------------------------------------

const MiniStat: React.FC<{ label: string; value: string | number; accent?: string }> = ({
  label,
  value,
  accent = 'cyan',
}) => (
  <div
    className={`${sectionCard} flex flex-col items-center justify-center px-3 py-3 text-center`}
  >
    <div className={`text-lg font-bold ${accentClass[accent] || 'text-[var(--app-text)]'}`}>
      {value}
    </div>
    <div className="mt-1 text-[9px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
      {label}
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Phantom Suggestion card (dashed ghost placeholder)
// ---------------------------------------------------------------------------

const PhantomCard: React.FC<{ text: string }> = ({ text }) => (
  <div
    className="flex items-start gap-3 border border-dashed border-[color-mix(in_srgb,var(--app-muted)_30%,transparent)] bg-transparent px-4 py-3"
    style={{ borderRadius: 0 }}
  >
    <Sparkles size={14} className="mt-0.5 shrink-0 text-[var(--app-muted)] opacity-50" />
    <span className="text-xs leading-relaxed text-[var(--app-muted)] opacity-70">{text}</span>
  </div>
);

// ---------------------------------------------------------------------------
// Recent Activity item
// ---------------------------------------------------------------------------

interface RecentItem {
  id: string;
  title: string;
  type: 'note' | 'project' | 'automation';
  typeLabel: string;
  updatedAt: number;
}

const RecentActivityRow: React.FC<{
  item: RecentItem;
  onOpen: (piece: { type: 'note' | 'project' | 'automation'; id: string }) => void;
}> = ({ item, onOpen }) => (
  <button
    onClick={() => onOpen({ type: item.type, id: item.id })}
    className={`${listCard} flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-[color-mix(in_srgb,var(--app-text)_6%,transparent)]`}
  >
    <span className="shrink-0 text-[9px] font-semibold uppercase tracking-[0.16em] text-[var(--app-muted)]">
      {item.typeLabel}
    </span>
    <span className="min-w-0 flex-1 truncate text-xs text-[var(--app-text)]">{item.title}</span>
    <span className="shrink-0 text-[10px] text-[var(--app-muted)] opacity-60">
      {formatRelativeTime(item.updatedAt)}
    </span>
  </button>
);

// ---------------------------------------------------------------------------
// Circuit trace pulse dot (CSS-animated)
// ---------------------------------------------------------------------------

const CircuitPulse: React.FC = () => (
  <span
    className="relative inline-block h-2 w-2"
    style={{ verticalAlign: 'middle' }}
  >
    <span
      className="absolute inset-0 rounded-full bg-[#74e2b8]"
      style={{
        animation: 'observatory-pulse 1.6s ease-in-out infinite',
      }}
    />
    <span className="absolute inset-[2px] rounded-full bg-[#74e2b8]" />
  </span>
);

// ---------------------------------------------------------------------------
// Observatory
// ---------------------------------------------------------------------------

export const Observatory: React.FC<ObservatoryProps> = ({ onNavigateToWorkbench }) => {
  const {
    assistantProjects,
    notes,
    automations,
    templates,
    addNote,
    addAssistantProject,
    addAutomation,
    applyTemplate,
  } = useLab();

  const { tasks, selectors } = useXP();
  const latestBrief = useLatestDuskBrief();

  // ---- Quick Build state ----
  const [quickBuildTarget, setQuickBuildTarget] = useState<QuickBuildTarget>(null);
  const [qbTitle, setQbTitle] = useState('');
  const [qbProjectKind, setQbProjectKind] = useState<LabProjectKind>('strategy');
  const [qbAutoScope, setQbAutoScope] = useState<LabAutomationScope>('lab');

  // ---- Computed data ----
  const dateKey = useMemo(() => selectors.getDateKey(), [selectors]);
  const now = Date.now();

  const activeProjects = useMemo(
    () => assistantProjects.filter((p) => p.status === 'active'),
    [assistantProjects]
  );

  const enabledAutomations = useMemo(
    () => automations.filter((a) => a.enabled),
    [automations]
  );

  const playMinutesToday = useMemo(
    () => selectors.getTrackedMinutesForDay(dateKey, now),
    [selectors, dateKey, now]
  );

  const knowledgeEdges = useMemo(() => {
    let edges = 0;
    for (const note of notes) {
      edges += note.linkedProjectIds.length;
      edges += note.linkedQuestIds.length;
    }
    for (const project of assistantProjects) {
      edges += project.linkedNoteIds.length;
      edges += project.linkedQuestIds.length;
      edges += project.linkedAutomationIds.length;
    }
    return edges;
  }, [notes, assistantProjects]);

  // Baseline notes
  const baselineNotes = useMemo(
    () => notes.filter(isBaselineNote).sort((a, b) => b.updatedAt - a.updatedAt),
    [notes]
  );

  const latestBaseline = baselineNotes[0] ?? null;
  const previousBaseline = baselineNotes[1] ?? null;
  const latestBaselineProvenance = useMemo(
    () => parseBaselineNoteProvenance(latestBaseline),
    [latestBaseline]
  );
  const latestBaselineAnchor = useMemo(
    () => buildBaselineDecisionAnchor(latestBaselineProvenance),
    [latestBaselineProvenance]
  );
  const baselineDrift = useMemo(() => {
    if (!latestBaseline || !previousBaseline) return null;
    return diffBaselineNote(latestBaseline, previousBaseline);
  }, [latestBaseline, previousBaseline]);

  // Recent activity - combine notes, projects, automations sorted by updatedAt
  const recentActivity = useMemo(() => {
    const items: RecentItem[] = [];
    for (const note of notes) {
      items.push({
        id: note.id,
        title: note.title,
        type: 'note',
        typeLabel: 'NOTE',
        updatedAt: note.updatedAt,
      });
    }
    for (const project of assistantProjects) {
      items.push({
        id: project.id,
        title: project.title,
        type: 'project',
        typeLabel: 'PROJECT',
        updatedAt: project.updatedAt,
      });
    }
    for (const auto of automations) {
      items.push({
        id: auto.id,
        title: auto.name,
        type: 'automation',
        typeLabel: 'CIRCUIT',
        updatedAt: auto.updatedAt,
      });
    }
    items.sort((a, b) => b.updatedAt - a.updatedAt);
    return items.slice(0, 8);
  }, [notes, assistantProjects, automations]);

  // ---- Quick Build handlers ----
  const handleQuickBuild = () => {
    const title = qbTitle.trim();
    if (!title) return;

    if (quickBuildTarget === 'note') {
      const id = addNote({ title, content: '', tags: [], linkedQuestIds: [] });
      onNavigateToWorkbench({ type: 'note', id });
    } else if (quickBuildTarget === 'project') {
      const id = addAssistantProject({ title, kind: qbProjectKind, summary: '' });
      onNavigateToWorkbench({ type: 'project', id });
    } else if (quickBuildTarget === 'automation') {
      const id = addAutomation({
        name: title,
        description: '',
        triggerSummary: 'Manual trigger',
        actionSummary: 'Prepare a suggestion',
        scope: qbAutoScope,
      });
      onNavigateToWorkbench({ type: 'automation', id });
    }

    setQbTitle('');
    setQuickBuildTarget(null);
  };

  // ---- Baseline handoff helpers ----
  const handleBaselineProvenanceHandoff = () => {
    if (!latestBaseline) return;
    const payload = buildBaselineProvenanceHandoff(latestBaseline);
    openDuskBrief({
      title: payload.title,
      body: payload.body,
      source: 'lab',
      tags: payload.tags,
      linkedQuestIds: payload.linkedQuestIds,
      linkedProjectIds: payload.linkedProjectIds,
    });
  };

  const handleBaselineCompareHandoff = () => {
    if (!latestBaseline || !previousBaseline) return;
    const payload = buildBaselineCompareHandoff(latestBaseline, previousBaseline);
    openDuskBrief({
      title: payload.title,
      body: payload.body,
      source: 'lab',
      tags: payload.tags,
      linkedQuestIds: payload.linkedQuestIds,
      linkedProjectIds: payload.linkedProjectIds,
    });
  };

  // ---- Render ----
  return (
    <div className="flex flex-col gap-6">
      {/* Pulse animation keyframes */}
      <style>{`
        @keyframes observatory-pulse {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.6); }
        }
      `}</style>

      {/* ================================================================ */}
      {/* SIGNAL BAR                                                       */}
      {/* ================================================================ */}
      <SignalBar
        activeProjects={activeProjects.length}
        enabledAutomations={enabledAutomations.length}
        notesCount={notes.length}
        playMinutesToday={playMinutesToday}
        knowledgeEdges={knowledgeEdges}
      />

      {/* ================================================================ */}
      {/* COMMAND DECK - Active Systems                                    */}
      {/* ================================================================ */}
      <section>
        <SectionLabel label="Command Deck" count={activeProjects.length + enabledAutomations.length} />

        {/* Project cards */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {activeProjects.map((project) => (
            <button
              key={project.id}
              onClick={() => onNavigateToWorkbench({ type: 'project', id: project.id })}
              className={`${sectionCard} flex flex-col gap-1 px-4 py-3 text-left transition-colors hover:bg-[color-mix(in_srgb,var(--app-text)_6%,transparent)]`}
            >
              <div className="flex items-center gap-2">
                <Package size={12} className={accentClass[project.accent] || 'text-[var(--app-muted)]'} />
                <span className="truncate text-sm font-medium text-[var(--app-text)]">
                  {project.title}
                </span>
              </div>
              <div className="text-[9px] uppercase tracking-[0.16em] text-[var(--app-muted)]">
                {project.kind} &middot; {project.status} &middot; {formatRelativeTime(project.updatedAt)}
              </div>
              {project.nextAction && (
                <div className="mt-1 truncate text-[11px] text-[var(--app-muted)] opacity-80">
                  {project.nextAction}
                </div>
              )}
            </button>
          ))}

          {/* Automation cards with circuit pulse */}
          {enabledAutomations.map((auto) => (
            <button
              key={auto.id}
              onClick={() => onNavigateToWorkbench({ type: 'automation', id: auto.id })}
              className={`${sectionCard} flex flex-col gap-1 px-4 py-3 text-left transition-colors hover:bg-[color-mix(in_srgb,var(--app-text)_6%,transparent)]`}
            >
              <div className="flex items-center gap-2">
                <CircuitPulse />
                <Zap size={12} className="text-[#74e2b8]" />
                <span className="truncate text-sm font-medium text-[var(--app-text)]">
                  {auto.name}
                </span>
              </div>
              <div className="text-[9px] uppercase tracking-[0.16em] text-[var(--app-muted)]">
                {auto.scope} &middot; {auto.mode} &middot; {formatRelativeTime(auto.updatedAt)}
              </div>
              <div className="mt-1 truncate text-[11px] text-[var(--app-muted)] opacity-80">
                {auto.triggerSummary} &rarr; {auto.actionSummary}
              </div>
            </button>
          ))}
        </div>

        {/* Navigation shortcuts */}
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => onNavigateToWorkbench({ type: 'project', id: assistantProjects[0]?.id || '' })}
            className={`${panelButton} flex items-center gap-1.5 px-3 py-1.5 text-[10px] uppercase tracking-[0.14em]`}
          >
            <Package size={11} />
            Open Assistants
          </button>
          <button
            onClick={() => onNavigateToWorkbench({ type: 'note', id: notes[0]?.id || '' })}
            className={`${panelButton} flex items-center gap-1.5 px-3 py-1.5 text-[10px] uppercase tracking-[0.14em]`}
          >
            <BookOpen size={11} />
            Open Knowledge
          </button>
          <button
            onClick={() => onNavigateToWorkbench({ type: 'automation', id: automations[0]?.id || '' })}
            className={`${panelButton} flex items-center gap-1.5 px-3 py-1.5 text-[10px] uppercase tracking-[0.14em]`}
          >
            <Zap size={11} />
            Open Automations
          </button>
        </div>
      </section>

      {/* ================================================================ */}
      {/* QUICK BUILD                                                      */}
      {/* ================================================================ */}
      <section>
        <SectionLabel label="Quick Build" />
        <div className={`${sectionCard} px-4 py-3`}>
          {quickBuildTarget === null ? (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setQuickBuildTarget('note')}
                className={`${panelButton} flex items-center gap-1.5 px-3 py-1.5 text-[10px] uppercase tracking-[0.14em]`}
              >
                <Plus size={11} />
                Note
              </button>
              <button
                onClick={() => setQuickBuildTarget('project')}
                className={`${panelButton} flex items-center gap-1.5 px-3 py-1.5 text-[10px] uppercase tracking-[0.14em]`}
              >
                <Plus size={11} />
                Project
              </button>
              <button
                onClick={() => setQuickBuildTarget('automation')}
                className={`${panelButton} flex items-center gap-1.5 px-3 py-1.5 text-[10px] uppercase tracking-[0.14em]`}
              >
                <Plus size={11} />
                Automation
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="text-[9px] uppercase tracking-[0.16em] text-[var(--app-muted)]">
                New {quickBuildTarget}
              </div>
              <div className="flex items-center gap-2">
                <input
                  value={qbTitle}
                  onChange={(e) => setQbTitle(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleQuickBuild()}
                  placeholder={`${quickBuildTarget} title...`}
                  autoFocus
                  className={`${fieldInput} min-w-0 flex-1`}
                />
                {quickBuildTarget === 'project' && (
                  <select
                    value={qbProjectKind}
                    onChange={(e) => setQbProjectKind(e.target.value as LabProjectKind)}
                    className={`${fieldInput} w-28`}
                  >
                    {projectKindOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                )}
                {quickBuildTarget === 'automation' && (
                  <select
                    value={qbAutoScope}
                    onChange={(e) => setQbAutoScope(e.target.value as LabAutomationScope)}
                    className={`${fieldInput} w-28`}
                  >
                    {automationScopeOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleQuickBuild}
                  disabled={!qbTitle.trim()}
                  className={`${panelButton} px-3 py-1 text-[10px] uppercase tracking-[0.14em] disabled:opacity-30`}
                >
                  Create
                </button>
                <button
                  onClick={() => {
                    setQuickBuildTarget(null);
                    setQbTitle('');
                  }}
                  className={`${panelButton} px-3 py-1 text-[10px] uppercase tracking-[0.14em] opacity-60`}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ================================================================ */}
      {/* OPERATIONAL SNAPSHOT                                              */}
      {/* ================================================================ */}
      <section>
        <SectionLabel label="Operational Snapshot" />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <MiniStat label="Active Projects" value={activeProjects.length} accent="cyan" />
          <MiniStat label="Total Notes" value={notes.length} accent="amber" />
          <MiniStat label="Enabled Circuits" value={enabledAutomations.length} accent="emerald" />
          <MiniStat label="Play Minutes" value={playMinutesToday} accent="rose" />
        </div>
      </section>

      {/* ================================================================ */}
      {/* PHANTOM SUGGESTIONS (V1 placeholders)                            */}
      {/* ================================================================ */}
      <section>
        <SectionLabel label="Phantom Suggestions" />
        <div className="flex flex-col gap-2">
          <PhantomCard text="You create a note after completing a quest 8 of 10 times. Automate this?" />
          <PhantomCard text="You always open Lab after a Play session. Create a circuit?" />
        </div>
      </section>

      {/* ================================================================ */}
      {/* RECENT ACTIVITY                                                  */}
      {/* ================================================================ */}
      <section>
        <SectionLabel label="Recent Activity" count={recentActivity.length} />
        <div className="flex flex-col gap-1">
          {recentActivity.length === 0 && (
            <div className="py-4 text-center text-xs text-[var(--app-muted)] opacity-50">
              No activity yet.
            </div>
          )}
          {recentActivity.map((item) => (
            <RecentActivityRow key={`${item.type}-${item.id}`} item={item} onOpen={onNavigateToWorkbench} />
          ))}
        </div>
      </section>

      {/* ================================================================ */}
      {/* BASELINE BRIEF                                                   */}
      {/* ================================================================ */}
      <section>
        <SectionLabel label="Baseline Brief" count={baselineNotes.length} />
        <div className={`${sectionCard} px-4 py-3`}>
          {latestBaseline ? (
            <div className="flex flex-col gap-3">
              {/* Latest baseline header */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <button
                    onClick={() => onNavigateToWorkbench({ type: 'note', id: latestBaseline.id })}
                    className="truncate text-sm font-medium text-[var(--app-text)] hover:underline"
                  >
                    {latestBaseline.title}
                  </button>
                  <div className="mt-1 text-[9px] uppercase tracking-[0.16em] text-[var(--app-muted)]">
                    Updated {formatRelativeTime(latestBaseline.updatedAt)}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={handleBaselineProvenanceHandoff}
                    title="Send provenance to Dusk"
                    className={`${iconButton}`}
                  >
                    <Send size={12} />
                  </button>
                </div>
              </div>

              {/* Provenance info */}
              {latestBaselineProvenance && (
                <div className="flex flex-wrap gap-2 text-[10px] text-[var(--app-muted)]">
                  {formatBaselineProvenanceProvider(latestBaselineProvenance) && (
                    <span className={inlineChip}>
                      {formatBaselineProvenanceProvider(latestBaselineProvenance)}
                    </span>
                  )}
                  {latestBaselineProvenance.acceptedLabel && (
                    <span className={inlineChip}>
                      {latestBaselineProvenance.acceptedLabel}
                    </span>
                  )}
                </div>
              )}

              {/* Decision anchor status */}
              {latestBaselineAnchor && (
                <div className="flex items-center gap-2 text-[10px]">
                  <span
                    className={`inline-block h-1.5 w-1.5 ${
                      latestBaselineAnchor.status === 'ready'
                        ? 'bg-[#74e2b8]'
                        : latestBaselineAnchor.status === 'tracked'
                          ? 'bg-[#f0c45a]'
                          : 'bg-[#ff8ea6]'
                    }`}
                  />
                  <span className="text-[var(--app-muted)]">{latestBaselineAnchor.summary}</span>
                </div>
              )}

              {/* Drift comparison */}
              {baselineDrift && previousBaseline && (
                <div className="flex items-center justify-between gap-2 border-t border-[color-mix(in_srgb,var(--app-muted)_15%,transparent)] pt-2">
                  <div className="text-[10px] text-[var(--app-muted)]">
                    vs {previousBaseline.title}: {summarizeBaselineDrift(baselineDrift)}
                  </div>
                  <button
                    onClick={handleBaselineCompareHandoff}
                    title="Send compare to Dusk"
                    className={`${iconButton}`}
                  >
                    <Layers size={11} />
                  </button>
                </div>
              )}

              {/* Next action from provenance */}
              {latestBaselineProvenance?.nextAction && (
                <div className="text-[11px] text-[var(--app-muted)] opacity-80">
                  Next action: {latestBaselineProvenance.nextAction}
                </div>
              )}

              {/* Baseline timeline */}
              {baselineNotes.length > 1 && (
                <div className="border-t border-[color-mix(in_srgb,var(--app-muted)_15%,transparent)] pt-2">
                  <div className="mb-1 text-[9px] uppercase tracking-[0.16em] text-[var(--app-muted)]">
                    Timeline
                  </div>
                  <div className="flex flex-col gap-1">
                    {baselineNotes.slice(0, 5).map((note, index) => (
                      <button
                        key={note.id}
                        onClick={() => onNavigateToWorkbench({ type: 'note', id: note.id })}
                        className="flex items-center gap-2 text-left text-[10px] text-[var(--app-muted)] transition-colors hover:text-[var(--app-text)]"
                      >
                        <span className="inline-block h-1 w-1 shrink-0 bg-[var(--app-muted)] opacity-40" />
                        <span className="min-w-0 flex-1 truncate">{note.title}</span>
                        <span className="shrink-0 opacity-50">{formatRelativeTime(note.updatedAt)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="py-3 text-center text-xs text-[var(--app-muted)] opacity-50">
              No baseline notes. Create a plan-kind note tagged "baseline" to start tracking.
            </div>
          )}
        </div>
      </section>

      {/* ================================================================ */}
      {/* BRIEF STACK WIDGET                                               */}
      {/* ================================================================ */}
      {latestBrief && (
        <section>
          <SectionLabel label="Latest Dusk Brief" />
          <div className={`${sectionCard} px-4 py-3`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-[var(--app-text)]">
                  {latestBrief.title}
                </div>
                <div className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-[var(--app-muted)]">
                  {latestBrief.body}
                </div>
                <div className="mt-1 text-[9px] uppercase tracking-[0.16em] text-[var(--app-muted)] opacity-50">
                  {latestBrief.source} &middot; {formatRelativeTime(latestBrief.receivedAt)}
                </div>
              </div>
              <button
                onClick={() =>
                  openDuskBrief({
                    title: latestBrief.title,
                    body: latestBrief.body,
                    source: latestBrief.source,
                    tags: latestBrief.tags,
                    linkedQuestIds: latestBrief.linkedQuestIds,
                    linkedProjectIds: latestBrief.linkedProjectIds,
                  })
                }
                title="Re-open in Dusk"
                className={iconButton}
              >
                <Send size={12} />
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ================================================================ */}
      {/* TOP QUEST PRESSURE                                               */}
      {/* ================================================================ */}
      {tasks.length > 0 && (
        <section>
          <SectionLabel label="Top Quest Pressure" />
          <div className="flex flex-col gap-1">
            {tasks
              .filter((t) => !t.completedAt)
              .slice(0, 3)
              .map((task) => (
                <div
                  key={task.id}
                  className={`${listCard} flex items-center gap-3 px-3 py-2`}
                >
                  <Activity size={11} className="shrink-0 text-[var(--app-muted)]" />
                  <span className="min-w-0 flex-1 truncate text-xs text-[var(--app-text)]">
                    {task.title}
                  </span>
                  {task.scheduledAt && (
                    <span className="shrink-0 text-[10px] text-[var(--app-muted)] opacity-60">
                      {formatRelativeTime(task.scheduledAt)}
                    </span>
                  )}
                </div>
              ))}
          </div>
        </section>
      )}

      {/* ================================================================ */}
      {/* MODULE RACK - Templates                                          */}
      {/* ================================================================ */}
      <section>
        <SectionLabel label="Templates" count={templates.length} />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {templates.map((template) => (
            <button
              key={template.id}
              onClick={() => applyTemplate(template.id)}
              className={`${sectionCard} flex flex-col gap-1 px-4 py-3 text-left transition-colors hover:bg-[color-mix(in_srgb,var(--app-text)_6%,transparent)]`}
            >
              <div className="flex items-center gap-2">
                <Cpu size={11} className={accentClass[template.accent] || 'text-[var(--app-muted)]'} />
                <span className="truncate text-xs font-medium text-[var(--app-text)]">
                  {template.title}
                </span>
              </div>
              <div className="text-[10px] leading-relaxed text-[var(--app-muted)] opacity-70">
                {template.description}
              </div>
              <div className="mt-1 text-[9px] uppercase tracking-[0.16em] text-[var(--app-muted)] opacity-40">
                {template.type}
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
};
