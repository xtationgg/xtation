import React, { useMemo, useState } from 'react';
import { Task, TaskPriority } from '../XP/xpTypes';
import { useXP } from '../XP/xpStore';
import { Flag, Shield, Star, Sword, Zap, Clock, Info } from 'lucide-react';
import { QuestDetailPanel } from './QuestDetailPanel';

interface QuestsItemProps {
  tasks: Task[];
}

const priorityOrder: Record<TaskPriority, number> = {
  urgent: 0,
  high: 1,
  normal: 2
};

const STEPS_BLOCK_REGEX = /\n?---\s*\n\[xstation_steps_v1\]\s*\n([\s\S]*?)\n---\s*$/;

const stripStepsBlock = (details?: string): string =>
  details ? details.replace(STEPS_BLOCK_REGEX, '').trim() : '';

const getStepCounts = (details?: string): { total: number; done: number } | null => {
  if (!details) return null;
  const match = details.match(STEPS_BLOCK_REGEX);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1]?.trim());
    const steps = Array.isArray(parsed?.steps) ? parsed.steps : [];
    if (steps.length === 0) return null;
    return { total: steps.length, done: steps.filter((s: { done?: boolean }) => s.done).length };
  } catch {
    return null;
  }
};

const iconMap: Record<Task['icon'], React.ReactNode> = {
  sword: <Sword size={14} className="text-[#f3f0e8]" />,
  shield: <Shield size={14} className="text-[#f3f0e8]" />,
  star: <Star size={14} className="text-[#f3f0e8]" />,
  zap: <Zap size={14} className="text-[#f3f0e8]" />,
  flag: <Flag size={14} className="text-[#f3f0e8]" />
};

export const QuestsItem: React.FC<QuestsItemProps> = ({ tasks }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  const { now, selectors, dateKey, resumeTaskSession } = useXP();
  const activeSession = selectors.getActiveSession();
  const selectedDayKey = dateKey;

  const formatElapsed = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatCountdown = (ms: number) => {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (days > 0) return `${days}d ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds
      .toString()
      .padStart(2, '0')}`;
  };

  const activeMissions = useMemo(() => {
    return selectors
      .getActiveTasks()
      .sort((a, b) => {
        const aRunning =
          !!activeSession &&
          (a.status === 'active' ||
            activeSession.taskId === a.id ||
            (activeSession.linkedTaskIds || []).includes(a.id))
            ? 1
            : 0;
        const bRunning =
          !!activeSession &&
          (b.status === 'active' ||
            activeSession.taskId === b.id ||
            (activeSession.linkedTaskIds || []).includes(b.id))
            ? 1
            : 0;
        if (aRunning !== bRunning) return bRunning - aRunning;
        const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
        if (priorityDiff !== 0) return priorityDiff;
        return (b.createdAt || 0) - (a.createdAt || 0);
      });
  }, [tasks, selectors, selectedDayKey, now, activeSession]);

  const runningMission = useMemo(() => {
    if (!activeSession) return null;
    return activeMissions.find(
      (m) => activeSession.taskId === m.id || (activeSession.linkedTaskIds || []).includes(m.id)
    ) ?? null;
  }, [activeMissions, activeSession]);

  const liveSessionSeconds = activeSession
    ? Math.max(0, Math.floor(selectors.getSessionDisplayMs(activeSession, now) / 1000))
    : 0;

  return (
    <div className="w-full rounded-xl border border-white/10 bg-gradient-to-b from-[#242427] to-[#1a1a1c] shadow-[0_10px_24px_rgba(0,0,0,0.45)] overflow-hidden transition-all duration-300">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full px-4 py-3 flex items-center justify-between uppercase tracking-[0.32em] text-[11px] text-[#f3f0e8]"
      >
        <span>Quests</span>
        <span className="flex items-center gap-2">
          <span className="text-[10px] tracking-[0.2em] text-[#9a9288]">{activeMissions.length}</span>
          <span
            className={`w-7 h-7 rounded-lg flex items-center justify-center text-lg font-bold ${
              isOpen ? 'bg-[#1a1a1d] text-[#f3f0e8] border border-white/20' : 'bg-white/90 text-black'
            }`}
          >
            {isOpen ? 'X' : '+'}
          </span>
        </span>
      </button>

      {activeSession && (
        <div className="px-4 py-2 flex items-center justify-between border-t border-[#f46a2e]/20 bg-[#f46a2e]/[0.06]">
          <div className="flex items-center gap-2 min-w-0">
            <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-[#f46a2e] animate-pulse" />
            <span className="text-[10px] uppercase tracking-[0.2em] text-[#f3f0e8] truncate">
              {runningMission?.title || activeSession.title || 'Active Session'}
            </span>
          </div>
          <span className="shrink-0 ml-3 font-mono text-[11px] tracking-[0.12em] text-[#f46a2e]">
            {formatElapsed(liveSessionSeconds)}
          </span>
        </div>
      )}

      <div
        className={`transition-all duration-300 overflow-hidden ${
          isOpen ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="px-4 pb-4 pt-1 flex flex-col gap-3">
          {activeMissions.length === 0 ? (
            <div className="text-[10px] uppercase tracking-[0.3em] text-[#726c64]">No active quests.</div>
          ) : (
            activeMissions.map((mission) => {
              const runningSession =
                activeSession &&
                (activeSession.taskId === mission.id || (activeSession.linkedTaskIds || []).includes(mission.id))
                  ? activeSession
                  : null;
              const isRunning = !!runningSession;
              const runningSeconds = runningSession
                ? Math.max(0, Math.floor(selectors.getSessionDisplayMs(runningSession, now) / 1000))
                : 0;
              const totalElapsedSeconds = Math.max(
                0,
                Math.floor(selectors.getTaskTodayMs(mission.id, selectedDayKey, now) / 1000)
              );
              return (
                <div
                  key={mission.id}
                  className="rounded-lg border border-white/10 bg-[#0f0f10] px-3 py-2 flex items-stretch justify-between gap-3"
                >
                  <div className="flex-1 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-md border border-white/10 bg-[#1a1a1d] flex items-center justify-center">
                          {iconMap[mission.icon || 'flag']}
                        </span>
                        <span className="text-[11px] uppercase tracking-[0.2em] text-[#f3f0e8]">
                          {mission.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {(() => { const s = getStepCounts(mission.details); return s ? (
                          <span className="text-[9px] tracking-[0.18em] text-[#8b847a]">{s.done}/{s.total}</span>
                        ) : null; })()}
                        <span className="text-[9px] uppercase tracking-[0.28em] text-[#f46a2e]">
                          {mission.priority}
                        </span>
                        <button
                          type="button"
                          aria-label={`View details for ${mission.title}`}
                          onClick={(e) => { e.stopPropagation(); setDetailTaskId(mission.id); }}
                          className="inline-flex h-5 w-5 items-center justify-center rounded text-[#8b847a] hover:text-[#f3f0e8] transition-colors"
                        >
                          <Info size={12} />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[9px] uppercase tracking-[0.24em] text-[#8b847a]">
                      {(() => {
                        const notes = stripStepsBlock(mission.details);
                        return notes ? <span className="truncate max-w-[120px]">{notes}</span> : null;
                      })()}
                      {totalElapsedSeconds > 0 && (
                        <span className="text-[#f3f0e8]">{formatElapsed(totalElapsedSeconds)} today</span>
                      )}
                      {isRunning && <span className="text-[#f46a2e]">Live {formatElapsed(runningSeconds)}</span>}
                      {!isRunning && mission.scheduledAt && mission.scheduledAt > now ? (
                        <span>{`IN ${formatCountdown(mission.scheduledAt - now)}`}</span>
                      ) : !isRunning && mission.scheduledAt && mission.scheduledAt <= now ? (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); resumeTaskSession(mission.id); }}
                          className="rounded px-1.5 py-0.5 text-[9px] uppercase tracking-[0.24em] font-semibold border border-[#f46a2e]/50 text-[#f46a2e] hover:bg-[#f46a2e]/10 transition-colors"
                        >
                          Start
                        </button>
                      ) : !isRunning ? null : (
                        <span className="text-[#f46a2e]">ACTIVE</span>
                      )}
                    </div>
                  </div>
                  {isRunning && (
                    <div className="min-w-[140px] flex flex-col items-center justify-center border-l border-white/10 pl-3">
                      <div className="flex items-center gap-2 text-[#8b847a] text-[9px] uppercase tracking-[0.3em]">
                        <Clock size={12} />
                        <span>Running</span>
                      </div>
                      <div className="text-2xl font-semibold tracking-[0.2em] text-[#f3f0e8]">
                        {formatElapsed(totalElapsedSeconds)}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
      {detailTaskId ? (
        <QuestDetailPanel taskId={detailTaskId} onClose={() => setDetailTaskId(null)} />
      ) : null}
    </div>
  );
};
