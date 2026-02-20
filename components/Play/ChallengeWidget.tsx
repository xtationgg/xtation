import React, { useMemo, useState, useEffect } from 'react';
import {
  ChallengeWidgetState,
  ExploreChallenge,
  ExploreFilters,
  FriendOption,
  MultiplayerDraft,
  RunningConfig,
  SoloTask,
} from './challengeWidgetTypes';
import { ChallengeMenu } from './ChallengeMenu';
import { ChallengeSoloView } from './ChallengeSoloView';
import { ChallengeMultiplayerView } from './ChallengeMultiplayerView';
import { ChallengeExploreView } from './ChallengeExploreView';
import { ChallengeRunningView } from './ChallengeRunningView';
import { useXP } from '../XP/xpStore';
import { Task, XPSessionImpact } from '../XP/xpTypes';

// TODO: replace with AI-generated suggestions from profile/context
const defaultSuggestions: SoloTask[] = [];

// TODO: replace with real friend list
const defaultFriends: FriendOption[] = [
  { id: 'p1', name: 'Nova' },
  { id: 'p2', name: 'Echo' },
  { id: 'p3', name: 'Cipher' },
];

// TODO: replace with explore listing API results
const defaultExplore: ExploreChallenge[] = [
  {
    id: 'e1',
    name: 'Sunrise Grind',
    creator: 'Nova',
    ruleSummary: 'Countdown 20 min',
    country: 'US',
    scope: 'public',
    ruleType: 'countdown',
  },
  {
    id: 'e2',
    name: 'Deep Work Party',
    creator: 'Echo',
    ruleSummary: 'Period 60 min',
    country: 'UK',
    scope: 'friends',
    ruleType: 'period',
  },
];

const defaultMultiDraft: MultiplayerDraft = {
  name: 'Co-op Sprint',
  rules: 'Stay on task, no breaks.',
  timeType: 'countdown',
  durationMin: 20,
  visibility: 'private',
  inviteFriendIds: [],
};

export const ChallengeWidget: React.FC = () => {
  const {
    tasks: storeTasks,
    addTask,
    updateTask: updateTaskStore,
    completeTask,
    startSession,
    stopSession,
    cancelSession,
    updateSession,
    createChallenge,
    updateChallenge,
  } = useXP();
  const [state, setState] = useState<ChallengeWidgetState>('collapsed');
  const [suggestions, setSuggestions] = useState<SoloTask[]>(defaultSuggestions);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [multiDraft, setMultiDraft] = useState<MultiplayerDraft>(defaultMultiDraft);
  const [filters, setFilters] = useState<ExploreFilters>({
    scope: 'public',
    country: '',
    nearMe: false,
    ruleType: 'all',
  });
  const [runningConfig, setRunningConfig] = useState<RunningConfig | null>(null);
  const [impactOpen, setImpactOpen] = useState(false);
  const [impactRating, setImpactRating] = useState<XPSessionImpact>('normal');
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [postRunState, setPostRunState] = useState<'solo' | 'multiplayer'>('solo');

  const mapPriorityToSolo = (priority: Task['priority']): SoloTask['priority'] => {
    if (priority === 'urgent') return 'Urgent';
    if (priority === 'high') return 'High';
    return 'Normal';
  };

  const mapPriorityToTask = (priority: SoloTask['priority']): Task['priority'] => {
    if (priority === 'Urgent') return 'urgent';
    if (priority === 'High') return 'high';
    return 'normal';
  };

  const updateTaskFromSolo = (id: string, patch: Partial<SoloTask>) => {
    const update: Partial<Task> = {};
    if (patch.title !== undefined) update.title = patch.title;
    if (patch.notes !== undefined) {
      update.notes = patch.notes;
      update.details = patch.notes;
    }
    if (patch.priority) update.priority = mapPriorityToTask(patch.priority);
    if (patch.ruleType) update.ruleType = patch.ruleType;
    if (patch.countdownMin !== undefined) update.countdownMin = patch.countdownMin;
    if (patch.scheduledAt !== undefined) {
      update.scheduledAt = patch.scheduledAt ? new Date(patch.scheduledAt).getTime() : undefined;
    }
    updateTaskStore(id, update);
  };

  const tasks = useMemo<SoloTask[]>(() => {
    return storeTasks
      .filter(task => task.status !== 'dropped' && task.status !== 'done')
      .map(task => ({
        id: task.id,
        title: task.title,
        notes: task.notes ?? task.details ?? '',
        priority: mapPriorityToSolo(task.priority),
        ruleType: task.ruleType ?? 'anytime',
        countdownMin: task.countdownMin,
        scheduledAt: task.scheduledAt ? new Date(task.scheduledAt).toISOString().slice(0, 16) : undefined,
      }));
  }, [storeTasks]);

  useEffect(() => {
    if (activeTaskId) return;
    if (tasks.length) setActiveTaskId(tasks[0].id);
  }, [tasks, activeTaskId]);

  const isExpanded = state !== 'collapsed' && state !== 'runningSolo' && state !== 'runningMulti';
  const isRunning = state === 'runningSolo' || state === 'runningMulti';

  const containerHeight = state === 'collapsed' ? 'max-h-[60px]' : isRunning ? 'max-h-[240px]' : 'max-h-[1400px]';

  const handleClose = () => {
    if (activeSessionId) {
      cancelSession(activeSessionId);
      setActiveSessionId(null);
    }
    setImpactOpen(false);
    setState('collapsed');
  };

  const updateTask = (id: string, patch: Partial<SoloTask>, list: 'tasks' | 'suggestions') => {
    if (list === 'tasks') {
      updateTaskFromSolo(id, patch);
      return;
    }
    setSuggestions((prev) => prev.map((task) => (task.id === id ? { ...task, ...patch } : task)));
  };

  const activeTask = useMemo(() => {
    return [...tasks, ...suggestions].find((task) => task.id === activeTaskId) || tasks[0];
  }, [tasks, suggestions, activeTaskId]);

  const startSolo = () => {
    if (!activeTask) return;
    const isStoreTask = storeTasks.some(task => task.id === activeTask.id);
    const ruleType = activeTask.ruleType || 'anytime';
    const challenge = createChallenge({
      mode: 'solo',
      name: activeTask.title,
      details: activeTask.notes || '',
      rules: {
        timeType: ruleType === 'countdown' ? 'countdown' : ruleType === 'scheduled' ? 'scheduled' : 'static',
        durationMinutes: activeTask.countdownMin,
        scheduledAt: activeTask.scheduledAt ? new Date(activeTask.scheduledAt).getTime() : undefined,
      },
      privacy: 'private',
    });
    const sessionId = startSession({
      title: activeTask.title,
      tag: 'SOLO',
      source: 'challenge',
      linkedTaskIds: isStoreTask && activeTask ? [activeTask.id] : [],
      linkedChallengeId: challenge.id,
    });
    if (!sessionId) {
      updateChallenge(challenge.id, { status: 'canceled' });
      return;
    }
    setActiveSessionId(sessionId);
    setRunningConfig({ title: activeTask.title, mode: 'up', seconds: 0 });
    setState('runningSolo');
  };

  const startMulti = () => {
    const challenge = createChallenge({
      mode: 'multiplayer',
      name: multiDraft.name,
      details: multiDraft.rules,
      rules: {
        timeType: multiDraft.timeType === 'countdown' ? 'countdown' : 'static',
        durationMinutes: multiDraft.durationMin,
      },
      privacy: multiDraft.visibility === 'public' ? 'public' : 'private',
    });
    const sessionId = startSession({
      title: multiDraft.name,
      tag: 'MULTI',
      source: 'challenge',
      linkedChallengeId: challenge.id,
    });
    if (!sessionId) {
      updateChallenge(challenge.id, { status: 'canceled' });
      return;
    }
    setActiveSessionId(sessionId);
    setRunningConfig({ title: multiDraft.name, mode: 'up', seconds: 0 });
    setState('runningMulti');
  };

  const handleComplete = () => {
    if (!activeTask) {
      setState('solo');
      return;
    }
    updateTaskFromSolo(activeTask.id, { notes: activeTask.notes, title: activeTask.title });
    completeTask(activeTask.id, { source: 'manual_done' });
    setState('solo');
  };

  const exploreResults = useMemo(() => {
    return defaultExplore.filter((item) => {
      if (filters.scope && item.scope !== filters.scope) return false;
      if (filters.country && item.country !== filters.country) return false;
      if (filters.ruleType !== 'all' && item.ruleType !== filters.ruleType) return false;
      return true;
    });
  }, [filters]);

  return (
    <div
      className={`rounded-2xl border border-white/10 bg-gradient-to-b from-[#242427] to-[#1a1a1c] shadow-[0_10px_24px_rgba(0,0,0,0.45)] overflow-hidden transition-all duration-300 ${containerHeight}`}
    >
      {state === 'collapsed' && (
        <button
          type="button"
          onClick={() => setState('menu')}
          className="w-full px-4 py-3 flex items-center justify-between uppercase tracking-[0.32em] text-[11px] text-[#f3f0e8]"
        >
          <span>Challenge</span>
          <span className="w-7 h-7 rounded-lg bg-white/90 text-black flex items-center justify-center text-lg font-bold">+</span>
        </button>
      )}

      {state !== 'collapsed' && (
        <div className="p-4 space-y-4">
          {state === 'menu' && (
            <ChallengeMenu
              onClose={handleClose}
              onSelect={(mode) => setState(mode === 'solo' ? 'solo' : mode === 'multi' ? 'multiplayer' : 'explore')}
            />
          )}

          {state === 'solo' && (
            <ChallengeSoloView
              tasks={tasks}
              suggestions={suggestions}
              activeTaskId={activeTaskId}
              showSuggestions={showSuggestions}
              onSelectTask={setActiveTaskId}
              onUpdateTask={updateTask}
              onAddTask={() => {
                const newId = addTask({
                  title: 'New task',
                  details: '',
                  priority: 'normal',
                  status: 'todo',
                  ruleType: 'anytime',
                  notes: '',
                });
                setActiveTaskId(newId);
              }}
              onStart={startSolo}
              onClose={handleClose}
              onToggleSuggestions={() => setShowSuggestions((prev) => !prev)}
              canStart={!!activeTask}
            />
          )}

          {state === 'multiplayer' && (
            <ChallengeMultiplayerView
              draft={multiDraft}
              friends={defaultFriends}
              onChange={(patch) => setMultiDraft((prev) => ({ ...prev, ...patch }))}
              onClose={handleClose}
              onStartRunning={startMulti}
            />
          )}

          {state === 'explore' && (
            <ChallengeExploreView
              filters={filters}
              onChange={(patch) => setFilters((prev) => ({ ...prev, ...patch }))}
              results={exploreResults}
              onJoin={(challenge) => {
                setMultiDraft((prev) => ({
                  ...prev,
                  name: challenge.name,
                  timeType: challenge.ruleType === 'countdown' ? 'countdown' : 'period',
                }));
                setState('multiplayer');
              }}
              onClose={handleClose}
            />
          )}

          {isRunning && runningConfig && (
            <ChallengeRunningView
              config={runningConfig}
              mode={state === 'runningMulti' ? 'multi' : 'solo'}
              onCancel={() => {
                if (activeSessionId) {
                  cancelSession(activeSessionId);
                  setActiveSessionId(null);
                }
                setState(state === 'runningMulti' ? 'multiplayer' : 'solo');
              }}
              onComplete={() => {
                stopSession();
                setPostRunState('solo');
                setImpactRating('normal');
                setImpactOpen(true);
              }}
              onFinish={() => {
                stopSession();
                setPostRunState('multiplayer');
                setImpactRating('normal');
                setImpactOpen(true);
              }}
            />
          )}

          {!isExpanded && isRunning && (
            <div className="text-[9px] uppercase tracking-[0.28em] text-[#8b847a]">
              TODO: persist running state
            </div>
          )}
        </div>
      )}

      {impactOpen && activeSessionId && (
        <div className="fixed inset-0 z-[220] bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-xl border border-white/10 bg-[#141418] p-4 space-y-3">
            <div className="text-[11px] uppercase tracking-[0.3em] text-white">Impact Rating</div>
            <select
              value={impactRating}
              onChange={(e) => setImpactRating(e.target.value as XPSessionImpact)}
              className="w-full bg-[#111114] border border-white/10 rounded px-2 py-2 text-[11px] text-white"
            >
              <option value="normal">Normal impact</option>
              <option value="medium">Medium impact</option>
              <option value="hard">Hard impact</option>
            </select>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  if (postRunState === 'solo') {
                    handleComplete();
                  }
                  setImpactOpen(false);
                  setActiveSessionId(null);
                  setState(postRunState);
                }}
                className="px-3 py-2 rounded border border-white/10 text-[10px] uppercase tracking-[0.25em] text-[#8b847a]"
              >
                Skip
              </button>
              <button
                type="button"
                onClick={() => {
                  updateSession(activeSessionId, { impactRating });
                  if (postRunState === 'solo') {
                    handleComplete();
                  }
                  setImpactOpen(false);
                  setActiveSessionId(null);
                  setState(postRunState);
                }}
                className="px-3 py-2 rounded border border-[#f46a2e]/40 text-[10px] uppercase tracking-[0.25em] text-[#f46a2e]"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
