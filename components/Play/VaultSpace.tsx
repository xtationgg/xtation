import React, { useMemo, useState } from 'react';
import {
  Plus, X, PlayCircle, CheckCircle2, Pencil, Search,
  Clock, GitBranch, Zap, ListChecks, Swords, ScrollText,
  Trophy, LayoutGrid,
} from 'lucide-react';
import { StatusDot } from './shared/StatusDot';
import type { Task } from '../XP/xpTypes';
import { getQuestStepCounts } from '../../src/lib/quests/steps';

type StatusFilter = 'all' | 'active' | 'todo' | 'done';
type SortMode = 'recent' | 'priority' | 'name';

const PRIORITY_ORDER: Record<Task['priority'], number> = { urgent: 0, high: 1, normal: 2 };
const PRIORITY_LABELS: Record<Task['priority'], string> = { urgent: 'Urgent', high: 'High', normal: 'Normal' };
const QUEST_TYPE_LABELS: Record<string, string> = { session: 'SESSION', instant: 'INSTANT', scheduled: 'SCHED', daily: 'DAILY' };
const QUEST_TYPE_ICONS: Record<string, string> = { session: 'S', instant: 'I', scheduled: 'T', daily: 'D' };

const RARITY_CLASS: Record<Task['priority'], string> = {
  normal: 'vq-card--common',
  high: 'vq-card--rare',
  urgent: 'vq-card--epic',
};

const FILTER_ICONS: Record<StatusFilter, React.ReactNode> = {
  all: <LayoutGrid size={13} />,
  active: <Swords size={13} />,
  todo: <ScrollText size={13} />,
  done: <Trophy size={13} />,
};

const formatMinutes = (ms: number): string => {
  const totalMin = Math.max(0, Math.floor(ms / 60000));
  if (totalMin >= 60) {
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return `${h}h${m > 0 ? `${m}m` : ''}`;
  }
  return `${totalMin}m`;
};

interface VaultSpaceProps {
  tasks: Task[];
  selectedTaskId: string | null;
  onSelectTask: (id: string | null) => void;
  onStartSession: () => void;
  onCompleteQuest: () => void;
  onEditQuest: (id: string) => void;
  onCreateQuest: () => void;
  activeSessionQuestId?: string;
  taskTodayMsMap?: Map<string, number>;
}

export const VaultSpace: React.FC<VaultSpaceProps> = ({
  tasks,
  selectedTaskId,
  onSelectTask,
  onStartSession,
  onCompleteQuest,
  onEditQuest,
  onCreateQuest,
  activeSessionQuestId,
  taskTodayMsMap,
}) => {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('recent');

  const filteredTasks = useMemo(() => {
    let result = tasks;
    if (statusFilter === 'active') {
      result = result.filter(t => t.status === 'active' || (activeSessionQuestId && t.id === activeSessionQuestId));
    } else if (statusFilter === 'todo') {
      result = result.filter(t => t.status === 'todo');
    } else if (statusFilter === 'done') {
      result = result.filter(t => t.status === 'done');
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(t => t.title.toLowerCase().includes(q));
    }
    if (sortMode === 'priority') {
      result = [...result].sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
    } else if (sortMode === 'name') {
      result = [...result].sort((a, b) => a.title.localeCompare(b.title));
    }
    return result;
  }, [tasks, statusFilter, searchQuery, sortMode, activeSessionQuestId]);

  const statusCounts = useMemo(() => {
    const counts = { all: tasks.length, active: 0, todo: 0, done: 0 };
    for (const t of tasks) {
      if (t.status === 'active' || (activeSessionQuestId && t.id === activeSessionQuestId)) counts.active++;
      if (t.status === 'todo') counts.todo++;
      if (t.status === 'done') counts.done++;
    }
    return counts;
  }, [tasks, activeSessionQuestId]);

  const selectedTask = useMemo(
    () => (selectedTaskId ? filteredTasks.find(t => t.id === selectedTaskId) ?? tasks.find(t => t.id === selectedTaskId) ?? null : null),
    [selectedTaskId, filteredTasks, tasks]
  );

  const selectedStepCounts = selectedTask ? getQuestStepCounts(selectedTask.details) : null;

  const getTaskStatus = (task: Task): 'running' | 'active' | 'todo' | 'done' | 'dropped' | 'paused' => {
    if (activeSessionQuestId === task.id) return 'running';
    return task.status as 'active' | 'todo' | 'done' | 'dropped' | 'paused';
  };

  return (
    <div className="vault-space">
      {/* ── Game Nav Strip ── */}
      <div className="vq-nav">
        <div className="vq-nav-filters">
          {(['all', 'active', 'todo', 'done'] as const).map(filter => (
            <button
              key={filter}
              type="button"
              className={`vq-nav-tab ${statusFilter === filter ? 'vq-nav-tab--active' : ''}`}
              onClick={() => setStatusFilter(filter)}
            >
              <span className="vq-nav-tab-icon">{FILTER_ICONS[filter]}</span>
              <span className="vq-nav-tab-label">{filter}</span>
              <span className="vq-nav-tab-count">{statusCounts[filter]}</span>
            </button>
          ))}
        </div>
        <div className="vq-nav-right">
          <div className="vq-search-wrap">
            <Search size={13} className="vq-search-icon" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="vq-search-input"
            />
          </div>
          <select
            className="vq-sort-select"
            value={sortMode}
            onChange={e => setSortMode(e.target.value as SortMode)}
          >
            <option value="recent">Recent</option>
            <option value="priority">Priority</option>
            <option value="name">Name</option>
          </select>
          <button type="button" className="vq-create-btn" onClick={onCreateQuest}>
            <Plus size={14} />
            <span>New Quest</span>
          </button>
        </div>
      </div>

      {/* ── Main: Card Grid + Briefing Panel ── */}
      <div className="vq-body">
        {/* Quest Card Grid */}
        <div className="vq-grid-scroll">
          {filteredTasks.length > 0 ? (
            <div className="vq-grid">
              {filteredTasks.map(task => {
                const isSelected = task.id === selectedTaskId;
                const isActiveSession = task.id === activeSessionQuestId;
                const stepCounts = getQuestStepCounts(task.details);
                const todayMs = taskTodayMsMap?.get(task.id) ?? 0;
                const taskStatus = getTaskStatus(task);
                const stepPct = stepCounts ? Math.round((stepCounts.done / stepCounts.total) * 100) : 0;

                return (
                  <button
                    key={task.id}
                    type="button"
                    className={`vq-card ${RARITY_CLASS[task.priority]} ${isSelected ? 'vq-card--selected' : ''} ${isActiveSession ? 'vq-card--live' : ''} ${taskStatus === 'done' ? 'vq-card--done' : ''}`}
                    onClick={() => onSelectTask(task.id)}
                  >
                    {/* Rarity edge glow */}
                    <div className="vq-card-glow" />

                    {/* Top row: type sigil + level */}
                    <div className="vq-card-top">
                      <span className="vq-card-sigil">{QUEST_TYPE_ICONS[task.questType ?? 'session'] ?? 'S'}</span>
                      <span className="vq-card-level">L{task.level ?? 1}</span>
                    </div>

                    {/* Title */}
                    <div className="vq-card-title">{task.title}</div>

                    {/* Meta row */}
                    <div className="vq-card-meta">
                      <StatusDot status={taskStatus} size={6} />
                      <span className="vq-card-priority">{PRIORITY_LABELS[task.priority]}</span>
                      {task.selfTreePrimary ? (
                        <>
                          <span className="vq-card-sep" />
                          <span className="vq-card-branch">{task.selfTreePrimary}</span>
                        </>
                      ) : null}
                    </div>

                    {/* Bottom stats row */}
                    <div className="vq-card-stats">
                      {todayMs > 0 ? (
                        <span className="vq-card-stat">
                          <Clock size={10} />
                          {formatMinutes(todayMs)}
                        </span>
                      ) : null}
                      {stepCounts ? (
                        <span className="vq-card-stat">
                          <ListChecks size={10} />
                          {stepCounts.done}/{stepCounts.total}
                        </span>
                      ) : null}
                      <span className="vq-card-stat vq-card-type-tag">
                        {QUEST_TYPE_LABELS[task.questType ?? 'session'] ?? 'SESSION'}
                      </span>
                    </div>

                    {/* Progress bar at card bottom edge */}
                    {stepCounts && stepCounts.total > 0 ? (
                      <div className="vq-card-progress">
                        <div className="vq-card-progress-fill" style={{ width: `${stepPct}%` }} />
                      </div>
                    ) : null}

                    {/* Quick-play hover action */}
                    <button
                      type="button"
                      className="vq-card-play"
                      title="Start session"
                      onClick={e => { e.stopPropagation(); onSelectTask(task.id); setTimeout(onStartSession, 0); }}
                    >
                      <PlayCircle size={18} />
                    </button>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="vq-empty">
              <div className="vq-empty-sigil">
                <Swords size={40} />
              </div>
              <div className="vq-empty-title">
                {searchQuery ? 'No matching quests' : 'No active missions'}
              </div>
              <div className="vq-empty-sub">
                {searchQuery ? 'Try a different search term' : 'Create your first quest to begin'}
              </div>
              {!searchQuery ? (
                <button type="button" className="vq-empty-cta" onClick={onCreateQuest}>
                  <Plus size={14} />
                  <span>Begin Mission</span>
                </button>
              ) : null}
            </div>
          )}
        </div>

        {/* ── Mission Briefing Panel ── */}
        {selectedTask ? (
          <div className={`vq-briefing ${getTaskStatus(selectedTask) === 'running' ? 'vq-briefing--live' : ''}`}>
            {/* Close */}
            <button type="button" className="vq-briefing-close" onClick={() => onSelectTask(null)}>
              <X size={16} />
            </button>

            {/* Header: status + rarity tag */}
            <div className="vq-briefing-header">
              <div className="vq-briefing-status-row">
                <StatusDot status={getTaskStatus(selectedTask)} size={8} />
                <span className="vq-briefing-status">{getTaskStatus(selectedTask)}</span>
                <span className={`vq-briefing-rarity ${RARITY_CLASS[selectedTask.priority]}`}>
                  {PRIORITY_LABELS[selectedTask.priority]}
                </span>
              </div>

              <h2 className="vq-briefing-title">{selectedTask.title}</h2>

              {/* Tags */}
              <div className="vq-briefing-tags">
                <span className="vq-briefing-tag">{QUEST_TYPE_LABELS[selectedTask.questType ?? 'session'] ?? 'SESSION'}</span>
                <span className="vq-briefing-tag vq-briefing-tag--accent">L{selectedTask.level ?? 1}</span>
                {selectedTask.selfTreePrimary ? (
                  <span className="vq-briefing-tag">{selectedTask.selfTreePrimary}</span>
                ) : null}
              </div>
            </div>

            {/* Divider */}
            <div className="vq-briefing-divider" />

            {/* Intel section */}
            <div className="vq-briefing-intel">
              {selectedStepCounts ? (
                <div className="vq-briefing-intel-row">
                  <ListChecks size={14} className="vq-briefing-intel-icon" />
                  <span className="vq-briefing-intel-label">Objectives</span>
                  <span className="vq-briefing-intel-value">{selectedStepCounts.done} / {selectedStepCounts.total}</span>
                  <div className="vq-briefing-intel-bar">
                    <div
                      className="vq-briefing-intel-bar-fill"
                      style={{ width: `${selectedStepCounts.total > 0 ? Math.round((selectedStepCounts.done / selectedStepCounts.total) * 100) : 0}%` }}
                    />
                  </div>
                </div>
              ) : null}

              {(taskTodayMsMap?.get(selectedTask.id) ?? 0) > 0 ? (
                <div className="vq-briefing-intel-row">
                  <Clock size={14} className="vq-briefing-intel-icon" />
                  <span className="vq-briefing-intel-label">Time Today</span>
                  <span className="vq-briefing-intel-value">{formatMinutes(taskTodayMsMap!.get(selectedTask.id)!)}</span>
                </div>
              ) : null}

              {selectedTask.selfTreePrimary ? (
                <div className="vq-briefing-intel-row">
                  <GitBranch size={14} className="vq-briefing-intel-icon" />
                  <span className="vq-briefing-intel-label">Branch</span>
                  <span className="vq-briefing-intel-value">{selectedTask.selfTreePrimary}</span>
                </div>
              ) : null}
            </div>

            {/* Details / notes */}
            {selectedTask.details ? (
              <>
                <div className="vq-briefing-divider" />
                <div className="vq-briefing-details">
                  <div className="vq-briefing-details-label">Mission Intel</div>
                  <div className="vq-briefing-details-text">{selectedTask.details}</div>
                </div>
              </>
            ) : null}

            {/* Action buttons */}
            <div className="vq-briefing-divider" />
            <div className="vq-briefing-actions">
              <button
                type="button"
                className={`vq-action vq-action--primary ${activeSessionQuestId === selectedTask.id ? 'vq-action--live' : ''}`}
                onClick={onStartSession}
              >
                <Zap size={15} />
                <span>{activeSessionQuestId === selectedTask.id ? 'In Session' : 'Start Mission'}</span>
              </button>
              <button type="button" className="vq-action vq-action--success" onClick={onCompleteQuest}>
                <CheckCircle2 size={15} />
                <span>Complete</span>
              </button>
              <button type="button" className="vq-action" onClick={() => onEditQuest(selectedTask.id)}>
                <Pencil size={13} />
                <span>Edit</span>
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
