import React, { useMemo, useState } from 'react';
import { Plus, X, PlayCircle, CheckCircle2, Pencil, Search } from 'lucide-react';
import { StatusDot } from './shared/StatusDot';
import { TypeBadge } from './shared/TypeBadge';
import { EmptyState } from './shared/EmptyState';
import type { Task } from '../XP/xpTypes';
import { getQuestStepCounts } from '../../src/lib/quests/steps';

type StatusFilter = 'all' | 'active' | 'todo' | 'done';
type SortMode = 'recent' | 'priority' | 'name';

const PRIORITY_ORDER: Record<Task['priority'], number> = { urgent: 0, high: 1, normal: 2 };
const PRIORITY_LABELS: Record<Task['priority'], string> = { urgent: 'Urgent', high: 'High', normal: 'Normal' };
const QUEST_TYPE_LABELS: Record<string, string> = { session: 'SESSION', instant: 'INSTANT', scheduled: 'SCHED', daily: 'DAILY' };

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
  /** Map of taskId -> tracked ms today */
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

  // Filter tasks
  const filteredTasks = useMemo(() => {
    let result = tasks;

    // Status filter
    if (statusFilter === 'active') {
      result = result.filter(t => t.status === 'active' || (activeSessionQuestId && t.id === activeSessionQuestId));
    } else if (statusFilter === 'todo') {
      result = result.filter(t => t.status === 'todo');
    } else if (statusFilter === 'done') {
      result = result.filter(t => t.status === 'done');
    }

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(t => t.title.toLowerCase().includes(q));
    }

    // Sort
    if (sortMode === 'priority') {
      result = [...result].sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
    } else if (sortMode === 'name') {
      result = [...result].sort((a, b) => a.title.localeCompare(b.title));
    }
    // 'recent' keeps the parent-provided order (already sorted by recency/priority)

    return result;
  }, [tasks, statusFilter, searchQuery, sortMode, activeSessionQuestId]);

  // Status counts
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
      {/* Filter bar */}
      <div className="vault-filters">
        {(['all', 'active', 'todo', 'done'] as const).map(filter => (
          <button
            key={filter}
            className={`vault-filter-tab ${statusFilter === filter ? 'vault-filter-tab--active' : ''}`}
            onClick={() => setStatusFilter(filter)}
          >
            {filter.charAt(0).toUpperCase() + filter.slice(1)}
            <span className="vault-filter-count">{statusCounts[filter]}</span>
          </button>
        ))}

        <div style={{ flex: 1 }} />

        {/* Sort */}
        <select
          className="vault-sort-select"
          value={sortMode}
          onChange={e => setSortMode(e.target.value as SortMode)}
        >
          <option value="recent">Recent</option>
          <option value="priority">Priority</option>
          <option value="name">Name</option>
        </select>

        <button className="vault-create-btn" onClick={onCreateQuest}>
          <Plus size={12} />
          Quest
        </button>
      </div>

      {/* Search */}
      <div className="vault-search">
        <div className="vault-search-wrap">
          <Search size={13} className="vault-search-icon" />
          <input
            type="text"
            className="vault-search-input"
            placeholder="Search quests..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Main area: list + detail */}
      <div className="vault-body">
        {/* Quest list */}
        <div className="vault-list">
          {filteredTasks.length > 0 ? (
            filteredTasks.map(task => {
              const isSelected = task.id === selectedTaskId;
              const isActiveSession = task.id === activeSessionQuestId;
              const stepCounts = getQuestStepCounts(task.details);
              const todayMs = taskTodayMsMap?.get(task.id) ?? 0;
              const taskStatus = getTaskStatus(task);

              return (
                <div
                  key={task.id}
                  className={`vault-quest-row${isSelected ? ' vault-quest-row--selected' : ''}${isActiveSession ? ' vault-quest-row--active-session' : ''}`}
                  onClick={() => onSelectTask(task.id)}
                >
                  <StatusDot status={taskStatus} />
                  <div className="vault-quest-row__info">
                    <div className="vault-quest-row__title">{task.title}</div>
                    <div className="vault-quest-row__meta">
                      <span>{PRIORITY_LABELS[task.priority]}</span>
                      {task.selfTreePrimary ? (
                        <>
                          <span>&middot;</span>
                          <span>{task.selfTreePrimary}</span>
                        </>
                      ) : null}
                    </div>
                  </div>
                  <div className="vault-quest-row__stats">
                    <TypeBadge type={QUEST_TYPE_LABELS[task.questType ?? 'session'] ?? 'SESSION'} />
                    <span className="vault-quest-row__stat">L{task.level ?? 1}</span>
                    {todayMs > 0 ? (
                      <span className="vault-quest-row__stat">{formatMinutes(todayMs)}</span>
                    ) : null}
                    {stepCounts ? (
                      <span className="vault-quest-row__stat">{stepCounts.done}/{stepCounts.total}</span>
                    ) : null}
                  </div>
                  <div className="vault-quest-row__actions">
                    <button
                      className="vault-row-action"
                      title="Start session"
                      onClick={e => { e.stopPropagation(); onSelectTask(task.id); setTimeout(onStartSession, 0); }}
                    >
                      <PlayCircle size={14} />
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <EmptyState
              title="No quests found"
              subtitle={searchQuery ? 'Try a different search term' : 'Create your first quest to get started'}
              actions={
                !searchQuery ? (
                  <button className="vault-create-btn" onClick={onCreateQuest}>
                    <Plus size={12} /> Create Quest
                  </button>
                ) : undefined
              }
            />
          )}
        </div>

        {/* Detail panel */}
        {selectedTask ? (
          <div className="vault-detail">
            <div className="vault-detail__header">
              <h2 className="vault-detail__title">{selectedTask.title}</h2>
              <button className="vault-detail__close" onClick={() => onSelectTask(null)}>
                <X size={16} />
              </button>
            </div>

            <div className="vault-detail__section">
              <div className="vault-detail__label">Status</div>
              <div className="vault-detail__value" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <StatusDot status={getTaskStatus(selectedTask)} />
                <span>{getTaskStatus(selectedTask).toUpperCase()}</span>
              </div>
            </div>

            <div className="vault-detail__section">
              <div className="vault-detail__label">Type</div>
              <div className="vault-detail__value">
                <TypeBadge type={QUEST_TYPE_LABELS[selectedTask.questType ?? 'session'] ?? 'SESSION'} />
              </div>
            </div>

            <div className="vault-detail__section">
              <div className="vault-detail__label">Priority</div>
              <div className="vault-detail__value">{PRIORITY_LABELS[selectedTask.priority]}</div>
            </div>

            <div className="vault-detail__section">
              <div className="vault-detail__label">Level</div>
              <div className="vault-detail__value">L{selectedTask.level ?? 1}</div>
            </div>

            {selectedTask.selfTreePrimary ? (
              <div className="vault-detail__section">
                <div className="vault-detail__label">Branch</div>
                <div className="vault-detail__value">{selectedTask.selfTreePrimary}</div>
              </div>
            ) : null}

            {selectedTask.details ? (
              <div className="vault-detail__section">
                <div className="vault-detail__label">Details</div>
                <div className="vault-detail__value" style={{ whiteSpace: 'pre-wrap' }}>{selectedTask.details}</div>
              </div>
            ) : null}

            {selectedStepCounts ? (
              <div className="vault-detail__section">
                <div className="vault-detail__label">Steps</div>
                <div className="vault-detail__value">{selectedStepCounts.done} / {selectedStepCounts.total} completed</div>
              </div>
            ) : null}

            {(taskTodayMsMap?.get(selectedTask.id) ?? 0) > 0 ? (
              <div className="vault-detail__section">
                <div className="vault-detail__label">Time Today</div>
                <div className="vault-detail__value">{formatMinutes(taskTodayMsMap!.get(selectedTask.id)!)}</div>
              </div>
            ) : null}

            <div className="vault-detail__actions">
              <button
                className="vault-detail-action vault-detail-action--accent"
                onClick={onStartSession}
              >
                <PlayCircle size={14} />
                {activeSessionQuestId === selectedTask.id ? 'In Session' : 'Start Session'}
              </button>
              <button
                className="vault-detail-action vault-detail-action--success"
                onClick={onCompleteQuest}
              >
                <CheckCircle2 size={14} />
                Complete
              </button>
              <button
                className="vault-detail-action"
                onClick={() => onEditQuest(selectedTask.id)}
              >
                <Pencil size={13} />
                Edit
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
