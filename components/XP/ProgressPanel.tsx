import React, { useMemo, useState } from 'react';
import { useXP } from './xpStore';
import { XPMode, XPSessionImpact } from './xpTypes';

const modeOptions: { mode: XPMode; points: number; warning?: string }[] = [
  { mode: 'Easy', points: 480 },
  { mode: 'Medium', points: 720 },
  { mode: 'Hard', points: 960 },
  { mode: 'Extreme', points: 1080, warning: 'not recommended' },
];

const impactOptions: { value: XPSessionImpact; label: string }[] = [
  { value: 'normal', label: 'Normal impact' },
  { value: 'medium', label: 'Medium impact' },
  { value: 'hard', label: 'Hard impact' },
];

const formatTimer = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

const formatTimeRange = (startAt: number, endAt: number) => {
  const start = new Date(startAt);
  const end = new Date(endAt);
  return `${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${end.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
};

export const ProgressPanel: React.FC = () => {
  const {
    dateKey,
    dayConfig,
    stats,
    tasks,
    selectors,
    setMode,
    addManualSession,
    updateSession,
    reassignSessionTask,
    cancelSession,
    activeSessionId,
    elapsedSeconds,
    startSession,
    stopSession,
    pauseSession,
  } = useXP();
  const todayTrackedMinutes = selectors.getTrackedMinutesForDay(dateKey);
  const todayTargetMinutes = selectors.getTargetXP(dateKey);
  const todayProgressPct = selectors.getProgressPct(dateKey);
  const todayOvercapPct = Math.max(0, todayProgressPct - 100);
  const todayRemainingMinutes = Math.max(0, todayTargetMinutes - todayTrackedMinutes);
  const todayCompletedCount = selectors.getCompletedCountForDay(dateKey);
  const todayEventCount = selectors.getDayActivityCount(dateKey);

  const [manualTitle, setManualTitle] = useState('');
  const [manualTag, setManualTag] = useState('Focus');
  const [manualMinutes, setManualMinutes] = useState(30);
  const [manualStart, setManualStart] = useState('');
  const [manualImpact, setManualImpact] = useState<XPSessionImpact>('normal');
  const [manualNotes, setManualNotes] = useState('');
  const [timerTitle, setTimerTitle] = useState('Focus Session');
  const [timerTag, setTimerTag] = useState('Focus');

  const sortedSessions = useMemo(
    () => [...selectors.getTodaySessions()].sort((a, b) => b.startAt - a.startAt).slice(0, 20),
    [selectors]
  );

  return (
    <div className="space-y-4">
      <div className="border border-[#e2e4ea] bg-white rounded-lg shadow-sm p-4 space-y-3">
        <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-[#666]">
          <span>Daily Mode</span>
          <span className="text-[#ff2a3a] font-semibold">{dayConfig.mode}</span>
        </div>
        <div className="grid sm:grid-cols-4 gap-2">
          {modeOptions.map((opt) => (
            <button
              key={opt.mode}
              type="button"
              onClick={() => setMode(opt.mode)}
              className={`rounded border px-2 py-2 text-left text-[11px] transition-colors ${
                dayConfig.mode === opt.mode
                  ? 'border-[#ff2a3a] bg-[#fff5f6] text-[#0f1115]'
                  : 'border-[#e2e4ea] bg-white text-[#555]'
              }`}
            >
              <div className="uppercase tracking-[0.15em] font-semibold">{opt.mode}</div>
              <div className="text-[10px] text-[#777]">{opt.points} XP</div>
              {opt.warning && <div className="text-[9px] text-[#ff2a3a] mt-1">{opt.warning}</div>}
            </button>
          ))}
        </div>
      </div>

      <div className="border border-[#e2e4ea] bg-white rounded-lg shadow-sm p-4 space-y-3">
        <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-[#666]">
          <span>Today Summary</span>
          <span className="text-[#ff2a3a] font-semibold">{stats.evaluationLabel}</span>
        </div>
        <div className="grid sm:grid-cols-4 gap-3 text-sm">
          <div className="p-3 border border-[#e2e4ea] rounded bg-[#f9fafc]">
            <div className="text-[11px] uppercase tracking-[0.15em] text-[#666]">Earned</div>
            <div className="text-lg font-black text-[#0f1115]">{todayTrackedMinutes} MIN</div>
          </div>
          <div className="p-3 border border-[#e2e4ea] rounded bg-[#f9fafc]">
            <div className="text-[11px] uppercase tracking-[0.15em] text-[#666]">Remaining</div>
            <div className="text-lg font-black text-[#0f1115]">{todayRemainingMinutes} MIN</div>
          </div>
          <div className="p-3 border border-[#e2e4ea] rounded bg-[#f9fafc]">
            <div className="text-[11px] uppercase tracking-[0.15em] text-[#666]">Progress</div>
            <div className="text-lg font-black text-[#0f1115]">{todayProgressPct}%</div>
          </div>
          <div className="p-3 border border-[#e2e4ea] rounded bg-[#f9fafc]">
            <div className="text-[11px] uppercase tracking-[0.15em] text-[#666]">Evaluation</div>
            <div className="text-[12px] font-semibold text-[#0f1115]">
              {stats.evaluationLabel} ({todayTrackedMinutes} MIN)
            </div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#777] mt-1">
              {todayCompletedCount} completed · {todayEventCount} events
            </div>
            {todayOvercapPct > 0 && (
              <div className="text-[10px] uppercase tracking-[0.2em] text-[#ff2a3a] mt-1">
                Overcap +{todayOvercapPct}%
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="border border-[#e2e4ea] bg-white rounded-lg shadow-sm p-4 space-y-3">
        <div className="text-xs uppercase tracking-[0.2em] text-[#666]">Quick Timer</div>
        <div className="grid md:grid-cols-[1.6fr,0.9fr,auto] gap-2 items-center">
          <input
            value={timerTitle}
            onChange={(e) => setTimerTitle(e.target.value)}
            placeholder="Timer title"
            className="border border-[#d8dae0] rounded px-3 py-2 text-sm text-[#0f1115] bg-white"
            disabled={!!activeSessionId}
          />
          <input
            value={timerTag}
            onChange={(e) => setTimerTag(e.target.value)}
            placeholder="Tag"
            className="border border-[#d8dae0] rounded px-3 py-2 text-sm text-[#0f1115] bg-white"
            disabled={!!activeSessionId}
          />
          {!activeSessionId ? (
            <button
              type="button"
              onClick={() =>
                startSession({
                  title: timerTitle.trim() || 'Focus Session',
                  tag: timerTag.trim() || 'Focus',
                  source: 'timer',
                })
              }
              className="px-3 py-2 rounded border border-[#0f1115] text-[11px] uppercase tracking-[0.2em] text-[#0f1115]"
            >
              Start
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={pauseSession}
                className="px-3 py-2 rounded border border-[#666] text-[11px] uppercase tracking-[0.2em] text-[#666]"
              >
                Pause
              </button>
              <button
                type="button"
                onClick={stopSession}
                className="px-3 py-2 rounded border border-[#ff2a3a] text-[11px] uppercase tracking-[0.2em] text-[#ff2a3a]"
              >
                Stop
              </button>
            </div>
          )}
        </div>
        {activeSessionId && (
          <div className="text-[11px] text-[#555]">Running: {formatTimer(elapsedSeconds)}</div>
        )}
      </div>

      <div className="border border-[#e2e4ea] bg-white rounded-lg shadow-sm p-4 space-y-3">
        <div className="text-xs uppercase tracking-[0.2em] text-[#666]">Manual Log</div>
        <div className="grid md:grid-cols-[1.6fr,0.9fr,0.6fr,0.8fr] gap-2 items-center">
          <input
            value={manualTitle}
            onChange={(e) => setManualTitle(e.target.value)}
            placeholder="Session title"
            className="border border-[#d8dae0] rounded px-3 py-2 text-sm text-[#0f1115] bg-white"
          />
          <input
            value={manualTag}
            onChange={(e) => setManualTag(e.target.value)}
            placeholder="Tag"
            className="border border-[#d8dae0] rounded px-3 py-2 text-sm text-[#0f1115] bg-white"
          />
          <input
            type="number"
            min={0}
            value={manualMinutes}
            onChange={(e) => setManualMinutes(Number(e.target.value) || 0)}
            className="border border-[#d8dae0] rounded px-3 py-2 text-sm text-[#0f1115] bg-white"
          />
          <input
            type="datetime-local"
            value={manualStart}
            onChange={(e) => setManualStart(e.target.value)}
            className="border border-[#d8dae0] rounded px-3 py-2 text-sm text-[#0f1115] bg-white [color-scheme:light]"
          />
        </div>
        <div className="grid md:grid-cols-[1.2fr,0.8fr,auto] gap-2 items-center">
          <textarea
            value={manualNotes}
            onChange={(e) => setManualNotes(e.target.value)}
            placeholder="Notes (optional)"
            className="border border-[#d8dae0] rounded px-3 py-2 text-sm text-[#0f1115] bg-white min-h-[70px]"
          />
          <select
            value={manualImpact}
            onChange={(e) => setManualImpact(e.target.value as XPSessionImpact)}
            className="border border-[#d8dae0] rounded px-3 py-2 text-sm text-[#0f1115] bg-white"
          >
            {impactOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              if (!manualTitle.trim()) return;
              if (manualMinutes <= 0) return;
              addManualSession({
                title: manualTitle.trim(),
                tag: manualTag.trim() || 'Focus',
                minutes: manualMinutes,
                notes: manualNotes.trim() || undefined,
                impactRating: manualImpact,
                startAt: manualStart ? new Date(manualStart).getTime() : undefined,
              });
              setManualTitle('');
              setManualNotes('');
              setManualStart('');
              setManualImpact('normal');
            }}
            className="px-3 py-2 rounded border border-[#0f1115] text-[11px] uppercase tracking-[0.2em] text-[#0f1115]"
          >
            Add
          </button>
        </div>
      </div>

      <div className="border border-[#e2e4ea] bg-white rounded-lg shadow-sm p-4 space-y-3">
        <div className="text-xs uppercase tracking-[0.2em] text-[#666]">Sessions Ledger</div>
        {sortedSessions.length === 0 && <div className="text-[11px] text-[#777]">No sessions yet.</div>}
        <div className="space-y-2">
          {sortedSessions.map((session) => {
            const isRunning = session.status === 'running';
            const sessionDisplayMs = selectors.getSessionDisplayMs(session);
            const computedMinutes = Math.max(0, Math.floor(sessionDisplayMs / 60000));
            return (
              <div key={session.id} className="border border-[#e2e4ea] rounded p-3 bg-white space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <input
                    value={session.title}
                    onChange={(e) => updateSession(session.id, { title: e.target.value })}
                    className="border border-[#d8dae0] rounded px-2 py-1 text-sm text-[#0f1115] bg-white disabled:bg-[#f2f3f5] flex-1"
                    disabled={isRunning}
                  />
                  <input
                    value={session.tag}
                    onChange={(e) => updateSession(session.id, { tag: e.target.value })}
                    className="border border-[#d8dae0] rounded px-2 py-1 text-sm text-[#0f1115] bg-white disabled:bg-[#f2f3f5] w-28"
                    disabled={isRunning}
                  />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-[#666] uppercase tracking-[0.2em]">
                  <span>Status: {session.status}</span>
                  <span>
                    {isRunning
                      ? `Running ${formatTimer(elapsedSeconds)}`
                      : `${computedMinutes} min`}
                  </span>
                  <span>{formatTimeRange(session.startAt, session.endAt)}</span>
                </div>
                <div className="grid md:grid-cols-[1fr,0.6fr,0.9fr,auto] gap-2 items-center">
                  <textarea
                    value={session.notes || ''}
                    onChange={(e) => updateSession(session.id, { notes: e.target.value })}
                    className="border border-[#d8dae0] rounded px-2 py-1 text-sm text-[#0f1115] bg-white min-h-[60px] disabled:bg-[#f2f3f5]"
                    placeholder="Notes"
                    disabled={isRunning}
                  />
                  <select
                    value={session.impactRating}
                    onChange={(e) => updateSession(session.id, { impactRating: e.target.value as XPSessionImpact })}
                    className="border border-[#d8dae0] rounded px-2 py-1 text-sm text-[#0f1115] bg-white"
                    disabled={isRunning}
                  >
                    {impactOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  {!isRunning ? (
                    <select
                      value={session.taskId || session.linkedTaskIds?.[0] || ''}
                      onChange={(e) => reassignSessionTask(session.id, e.target.value || null)}
                      className="border border-[#d8dae0] rounded px-2 py-1 text-sm text-[#0f1115] bg-white"
                    >
                      <option value="">No task</option>
                      {tasks.map((task) => (
                        <option key={task.id} value={task.id}>
                          {task.title}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="text-[10px] uppercase tracking-[0.2em] text-[#777]">Running</div>
                  )}
                  {session.status === 'running' && (
                    <button
                      type="button"
                      onClick={() => cancelSession(session.id)}
                      className="px-3 py-2 rounded border border-[#ff2a3a] text-[11px] uppercase tracking-[0.2em] text-[#ff2a3a]"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
