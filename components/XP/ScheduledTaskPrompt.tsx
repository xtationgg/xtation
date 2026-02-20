import React, { useEffect, useMemo, useState } from 'react';
import { useXP } from './xpStore';
import { Task } from './xpTypes';
import { playMatchFoundSound, playClickSound } from '../../utils/SoundEffects';

const SNOOZE_MINUTES = 10;

const priorityRank: Record<Task['priority'], number> = {
  urgent: 0,
  high: 1,
  normal: 2,
};

export const ScheduledTaskPrompt: React.FC = () => {
  const { tasks, startSession, updateTask, snoozeTask } = useXP();
  const [promptTaskId, setPromptTaskId] = useState<string | null>(null);
  const [now, setNow] = useState<number>(Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const readyTasks = useMemo(() => {
    return tasks
      .filter((task) => {
        if (task.status === 'done' || task.status === 'dropped' || task.completedAt || task.archivedAt) return false;
        if (!task.scheduledAt) return false;
        return task.scheduledAt <= now;
      })
      .sort((a, b) => {
        const priorityDiff = priorityRank[a.priority] - priorityRank[b.priority];
        if (priorityDiff !== 0) return priorityDiff;
        return (a.scheduledAt || 0) - (b.scheduledAt || 0);
      });
  }, [tasks, now]);

  const promptTask = readyTasks.find((task) => task.id === promptTaskId) || readyTasks[0] || null;

  useEffect(() => {
    if (promptTask && promptTask.id !== promptTaskId) {
      setPromptTaskId(promptTask.id);
      playMatchFoundSound();
    }
    if (!promptTask && promptTaskId) {
      setPromptTaskId(null);
    }
  }, [promptTask, promptTaskId]);

  if (!promptTask) return null;

  const handleStart = () => {
    playClickSound();
    updateTask(promptTask.id, { scheduledAt: undefined });
    startSession({
      title: promptTask.title,
      tag: promptTask.priority.toUpperCase(),
      source: 'timer',
      linkedTaskIds: [promptTask.id],
    });
    setPromptTaskId(null);
  };

  const handleSnooze = (minutes = SNOOZE_MINUTES) => {
    playClickSound();
    snoozeTask(promptTask.id, minutes);
    setPromptTaskId(null);
  };

  const handleCancel = () => {
    playClickSound();
    updateTask(promptTask.id, { scheduledAt: undefined });
    setPromptTaskId(null);
  };

  const containerClass = 'fixed inset-0 z-[220] bg-black/55 flex items-center justify-center px-4';
  const cardClass = 'w-full max-w-md rounded-2xl border border-white/10 bg-[#101014] shadow-[0_24px_60px_rgba(0,0,0,0.6)] p-5';

  return (
    <div className={containerClass}>
      <div className={cardClass}>
        <div className="text-[9px] uppercase tracking-[0.35em] text-[#8b847a] mb-2">Scheduled Task</div>
        <div className="text-xl font-bold text-white mb-1">{promptTask.title}</div>
        <div className="text-[11px] uppercase tracking-[0.25em] text-[#f46a2e] mb-3">
          {promptTask.priority} Priority
        </div>
        {promptTask.details && (
          <div className="text-[12px] text-[#b8b2a8] mb-4">{promptTask.details}</div>
        )}
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => handleSnooze(5)}
            className="px-3 py-2 rounded border border-white/10 text-[10px] uppercase tracking-[0.25em] text-[#8b847a]"
          >
            +5m
          </button>
          <button
            type="button"
            onClick={() => handleSnooze(15)}
            className="px-3 py-2 rounded border border-white/10 text-[10px] uppercase tracking-[0.25em] text-[#8b847a]"
          >
            +15m
          </button>
          <button
            type="button"
            onClick={() => handleSnooze(30)}
            className="px-3 py-2 rounded border border-white/10 text-[10px] uppercase tracking-[0.25em] text-[#8b847a]"
          >
            +30m
          </button>
          <button
            type="button"
            onClick={() => handleSnooze()}
            className="px-3 py-2 rounded border border-white/10 text-[10px] uppercase tracking-[0.25em] text-[#8b847a]"
          >
            Snooze
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className="px-3 py-2 rounded border border-white/10 text-[10px] uppercase tracking-[0.25em] text-[#8b847a]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleStart}
            className={`px-4 py-2 rounded border text-[10px] uppercase tracking-[0.25em] ${
              'border-[#f46a2e]/60 text-[#f46a2e] hover:bg-[#2a1a12]'
            }`}
          >
            Start
          </button>
        </div>
      </div>
    </div>
  );
};
