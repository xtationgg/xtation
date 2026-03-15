import React, { useMemo, useState } from 'react';
import { Plus, X, PlayCircle, CheckCircle2, Pencil, Search, Clock, GitBranch, Zap, ListChecks } from 'lucide-react';
import { StatusDot } from './shared/StatusDot';
import { EmptyState } from './shared/EmptyState';
import type { Task } from '../XP/xpTypes';
import { getQuestStepCounts } from '../../src/lib/quests/steps';

import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { ScrollArea } from '../ui/scroll-area';
import { Separator } from '../ui/separator';

type StatusFilter = 'all' | 'active' | 'todo' | 'done';
type SortMode = 'recent' | 'priority' | 'name';

const PRIORITY_ORDER: Record<Task['priority'], number> = { urgent: 0, high: 1, normal: 2 };
const PRIORITY_LABELS: Record<Task['priority'], string> = { urgent: 'Urgent', high: 'High', normal: 'Normal' };
const QUEST_TYPE_LABELS: Record<string, string> = { session: 'SESSION', instant: 'INSTANT', scheduled: 'SCHED', daily: 'DAILY' };

const PRIORITY_VARIANT: Record<Task['priority'], 'destructive' | 'default' | 'secondary'> = {
  urgent: 'destructive',
  high: 'default',
  normal: 'secondary',
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
      <div className="flex items-center gap-1 px-3 py-2">
        <div className="flex items-center gap-0.5 rounded-lg bg-muted/50 p-0.5">
          {(['all', 'active', 'todo', 'done'] as const).map(filter => (
            <Button
              key={filter}
              variant={statusFilter === filter ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setStatusFilter(filter)}
              className="gap-1.5"
            >
              {filter.charAt(0).toUpperCase() + filter.slice(1)}
              <span className="text-[10px] tabular-nums text-muted-foreground">{statusCounts[filter]}</span>
            </Button>
          ))}
        </div>

        <div className="flex-1" />

        {/* Sort */}
        <select
          className="h-7 rounded-lg border border-input bg-transparent px-2 text-xs text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          value={sortMode}
          onChange={e => setSortMode(e.target.value as SortMode)}
        >
          <option value="recent">Recent</option>
          <option value="priority">Priority</option>
          <option value="name">Name</option>
        </select>

        <Button size="sm" onClick={onCreateQuest} className="gap-1">
          <Plus size={14} />
          Quest
        </Button>
      </div>

      {/* Search */}
      <div className="px-3 pb-2">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search quests..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
      </div>

      {/* Main area: list + detail */}
      <div className="vault-body">
        {/* Quest list */}
        <ScrollArea className="vault-list">
          {filteredTasks.length > 0 ? (
            <div className="flex flex-col gap-1 p-2">
              {filteredTasks.map(task => {
                const isSelected = task.id === selectedTaskId;
                const isActiveSession = task.id === activeSessionQuestId;
                const stepCounts = getQuestStepCounts(task.details);
                const todayMs = taskTodayMsMap?.get(task.id) ?? 0;
                const taskStatus = getTaskStatus(task);

                return (
                  <div
                    key={task.id}
                    className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-accent/80 ring-1 ring-ring/20'
                        : 'hover:bg-muted/60'
                    }${isActiveSession ? ' ring-1 ring-primary/30 bg-primary/5' : ''}`}
                    onClick={() => onSelectTask(task.id)}
                  >
                    <StatusDot status={taskStatus} />
                    <div className="flex-1 min-w-0">
                      <div className="truncate text-sm font-medium leading-tight">{task.title}</div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Badge variant={PRIORITY_VARIANT[task.priority]} className="text-[10px] h-4 px-1.5">
                          {PRIORITY_LABELS[task.priority]}
                        </Badge>
                        {task.selfTreePrimary ? (
                          <span className="text-[11px] text-muted-foreground truncate">{task.selfTreePrimary}</span>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-mono">
                        {QUEST_TYPE_LABELS[task.questType ?? 'session'] ?? 'SESSION'}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-mono tabular-nums">
                        L{task.level ?? 1}
                      </Badge>
                      {todayMs > 0 ? (
                        <Badge variant="ghost" className="text-[10px] h-4 px-1.5 tabular-nums">
                          {formatMinutes(todayMs)}
                        </Badge>
                      ) : null}
                      {stepCounts ? (
                        <Badge variant="ghost" className="text-[10px] h-4 px-1.5 tabular-nums">
                          {stepCounts.done}/{stepCounts.total}
                        </Badge>
                      ) : null}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                      title="Start session"
                      onClick={e => { e.stopPropagation(); onSelectTask(task.id); setTimeout(onStartSession, 0); }}
                    >
                      <PlayCircle size={14} />
                    </Button>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              title="No quests found"
              subtitle={searchQuery ? 'Try a different search term' : 'Create your first quest to get started'}
              actions={
                !searchQuery ? (
                  <Button size="sm" onClick={onCreateQuest} className="gap-1">
                    <Plus size={14} /> Create Quest
                  </Button>
                ) : undefined
              }
            />
          )}
        </ScrollArea>

        {/* Detail panel */}
        {selectedTask ? (
          <Card className="vault-detail border-0 ring-0 rounded-none bg-card/50">
            <CardHeader className="flex-row items-start justify-between gap-2 pb-0">
              <CardTitle className="text-lg leading-snug">{selectedTask.title}</CardTitle>
              <Button variant="ghost" size="icon-xs" onClick={() => onSelectTask(null)}>
                <X size={16} />
              </Button>
            </CardHeader>

            <CardContent className="flex flex-col gap-4">
              {/* Status & type row */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <StatusDot status={getTaskStatus(selectedTask)} />
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {getTaskStatus(selectedTask)}
                  </span>
                </div>
                <Badge variant="outline">
                  {QUEST_TYPE_LABELS[selectedTask.questType ?? 'session'] ?? 'SESSION'}
                </Badge>
                <Badge variant={PRIORITY_VARIANT[selectedTask.priority]}>
                  {PRIORITY_LABELS[selectedTask.priority]}
                </Badge>
                <Badge variant="secondary" className="font-mono tabular-nums">
                  L{selectedTask.level ?? 1}
                </Badge>
              </div>

              <Separator />

              {/* Info rows */}
              <div className="grid gap-3">
                {selectedTask.selfTreePrimary ? (
                  <div className="flex items-center gap-2 text-sm">
                    <GitBranch size={14} className="text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground">Branch</span>
                    <span className="ml-auto font-medium">{selectedTask.selfTreePrimary}</span>
                  </div>
                ) : null}

                {selectedStepCounts ? (
                  <div className="flex items-center gap-2 text-sm">
                    <ListChecks size={14} className="text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground">Steps</span>
                    <span className="ml-auto font-medium tabular-nums">{selectedStepCounts.done} / {selectedStepCounts.total} completed</span>
                  </div>
                ) : null}

                {(taskTodayMsMap?.get(selectedTask.id) ?? 0) > 0 ? (
                  <div className="flex items-center gap-2 text-sm">
                    <Clock size={14} className="text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground">Time Today</span>
                    <span className="ml-auto font-medium tabular-nums">{formatMinutes(taskTodayMsMap!.get(selectedTask.id)!)}</span>
                  </div>
                ) : null}
              </div>

              {selectedTask.details ? (
                <>
                  <Separator />
                  <div>
                    <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1.5">Details</div>
                    <div className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">{selectedTask.details}</div>
                  </div>
                </>
              ) : null}

              <Separator />

              {/* Actions */}
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={onStartSession}
                  className="gap-1.5"
                >
                  <Zap size={14} />
                  {activeSessionQuestId === selectedTask.id ? 'In Session' : 'Start Session'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onCompleteQuest}
                  className="gap-1.5"
                >
                  <CheckCircle2 size={14} />
                  Complete
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEditQuest(selectedTask.id)}
                  className="gap-1.5"
                >
                  <Pencil size={13} />
                  Edit
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
};
