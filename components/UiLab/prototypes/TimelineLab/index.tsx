import React, { useMemo, useState } from 'react';
import { Panel } from '../../../UI/Panel';
import type { UiLabPrototypeRenderProps } from '../../registry';

type TimelineStatus = 'completed' | 'scheduled' | 'failed';
type TimelineLayoutMode = 'a' | 'b';
type TimelinePointsMode = 'a' | 'b';
type TimelineGranularityMode = 'a' | 'b';

interface TimelineSession {
  hour: number;
  minutes: number;
  durationMin: number;
}

interface TimelineTask {
  id: string;
  title: string;
  status: TimelineStatus;
  plannedStartHour: number | null;
  plannedDurationMin: number | null;
  actualSessions: TimelineSession[];
}

interface TimelinePoint {
  id: string;
  taskId: string;
  status: TimelineStatus;
  lane: 'mixed' | 'planned' | 'actual';
  kind: 'planned' | 'actual';
  hour: number;
  minutes: number;
}

interface TimelinePanelConfig {
  layout: TimelineLayoutMode;
  points: TimelinePointsMode;
  granularity: TimelineGranularityMode;
}

const STATUS_COLORS: Record<TimelineStatus, string> = {
  completed: '#6df2b3',
  scheduled: '#8f63ff',
  failed: '#ff6b85',
};

const TIMELINE_TASKS: TimelineTask[] = [
  { id: 'T01', title: 'Morning briefing', status: 'completed', plannedStartHour: 6, plannedDurationMin: 45, actualSessions: [{ hour: 6, minutes: 8, durationMin: 24 }, { hour: 6, minutes: 41, durationMin: 18 }] },
  { id: 'T02', title: 'Route planning', status: 'scheduled', plannedStartHour: 7, plannedDurationMin: 40, actualSessions: [] },
  { id: 'T03', title: 'System check', status: 'failed', plannedStartHour: 8, plannedDurationMin: 30, actualSessions: [{ hour: 8, minutes: 37, durationMin: 12 }] },
  { id: 'T04', title: 'Team sync', status: 'completed', plannedStartHour: 9, plannedDurationMin: 50, actualSessions: [{ hour: 9, minutes: 3, durationMin: 22 }, { hour: 9, minutes: 32, durationMin: 16 }] },
  { id: 'T05', title: 'Craft loadout', status: 'completed', plannedStartHour: 10, plannedDurationMin: 35, actualSessions: [{ hour: 10, minutes: 11, durationMin: 28 }] },
  { id: 'T06', title: 'Signal relay', status: 'scheduled', plannedStartHour: 11, plannedDurationMin: 30, actualSessions: [{ hour: 11, minutes: 4, durationMin: 10 }] },
  { id: 'T07', title: 'Data uplink', status: 'failed', plannedStartHour: 12, plannedDurationMin: 45, actualSessions: [{ hour: 12, minutes: 29, durationMin: 18 }, { hour: 12, minutes: 56, durationMin: 9 }] },
  { id: 'T08', title: 'Field review', status: 'completed', plannedStartHour: 13, plannedDurationMin: 40, actualSessions: [{ hour: 13, minutes: 17, durationMin: 31 }] },
  { id: 'T09', title: 'Quest briefing', status: 'scheduled', plannedStartHour: 14, plannedDurationMin: 35, actualSessions: [] },
  { id: 'T10', title: 'Arena prep', status: 'completed', plannedStartHour: 15, plannedDurationMin: 55, actualSessions: [{ hour: 15, minutes: 6, durationMin: 17 }, { hour: 15, minutes: 28, durationMin: 13 }, { hour: 15, minutes: 50, durationMin: 14 }] },
  { id: 'T11', title: 'Sensor calibration', status: 'completed', plannedStartHour: 16, plannedDurationMin: 25, actualSessions: [{ hour: 16, minutes: 3, durationMin: 19 }] },
  { id: 'T12', title: 'Recovery pass', status: 'failed', plannedStartHour: 17, plannedDurationMin: 45, actualSessions: [{ hour: 17, minutes: 35, durationMin: 11 }] },
  { id: 'T13', title: 'Comms patch', status: 'scheduled', plannedStartHour: 18, plannedDurationMin: 30, actualSessions: [] },
  { id: 'T14', title: 'Debrief notes', status: 'completed', plannedStartHour: 19, plannedDurationMin: 50, actualSessions: [{ hour: 19, minutes: 12, durationMin: 33 }] },
  { id: 'T15', title: 'Squad follow-up', status: 'completed', plannedStartHour: 20, plannedDurationMin: 40, actualSessions: [{ hour: 20, minutes: 15, durationMin: 16 }, { hour: 20, minutes: 41, durationMin: 12 }] },
  { id: 'T16', title: 'Nocturne pass', status: 'failed', plannedStartHour: 21, plannedDurationMin: 25, actualSessions: [{ hour: 21, minutes: 42, durationMin: 8 }] },
  { id: 'T17', title: 'Gym run', status: 'completed', plannedStartHour: null, plannedDurationMin: null, actualSessions: [{ hour: 7, minutes: 20, durationMin: 35 }] },
  { id: 'T18', title: 'Quick idea dump', status: 'scheduled', plannedStartHour: null, plannedDurationMin: null, actualSessions: [{ hour: 14, minutes: 10, durationMin: 15 }, { hour: 22, minutes: 5, durationMin: 7 }] },
  { id: 'T19', title: 'Inbox cleanup', status: 'completed', plannedStartHour: null, plannedDurationMin: null, actualSessions: [{ hour: 12, minutes: 5, durationMin: 18 }] },
  { id: 'T20', title: 'Ad-hoc support', status: 'failed', plannedStartHour: null, plannedDurationMin: null, actualSessions: [{ hour: 18, minutes: 47, durationMin: 9 }] },
];

const HOUR_TICKS = Array.from({ length: 25 }, (_, hour) => hour);

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const toHourPercent = (hour: number, minutes: number) => clamp(((hour + minutes / 60) / 24) * 100, 0, 100);

const toClusterPercent = (index: number, total: number) => {
  if (total <= 1) return 50;
  const spread = 34;
  const start = 50 - spread / 2;
  return start + (index / (total - 1)) * spread;
};

const invertMode = <T extends 'a' | 'b'>(value: T): T => (value === 'a' ? 'b' : 'a') as T;

const getTaskAnchor = (task: TimelineTask) => task.actualSessions[0] ?? null;

const buildTimelinePoints = (tasks: TimelineTask[], config: TimelinePanelConfig): TimelinePoint[] => {
  const points: TimelinePoint[] = [];

  tasks.forEach((task) => {
    const hasPlan = typeof task.plannedStartHour === 'number';
    const anchor = getTaskAnchor(task);

    if (config.points === 'a') {
      if (config.layout === 'a') {
        if (anchor) {
          points.push({
            id: `${task.id}-anchor`,
            taskId: task.id,
            status: task.status,
            lane: 'mixed',
            kind: 'actual',
            hour: anchor.hour,
            minutes: anchor.minutes,
          });
        } else if (hasPlan) {
          points.push({
            id: `${task.id}-plan`,
            taskId: task.id,
            status: task.status,
            lane: 'mixed',
            kind: 'planned',
            hour: task.plannedStartHour as number,
            minutes: 0,
          });
        }
      } else {
        if (hasPlan) {
          points.push({
            id: `${task.id}-plan`,
            taskId: task.id,
            status: task.status,
            lane: 'planned',
            kind: 'planned',
            hour: task.plannedStartHour as number,
            minutes: 0,
          });
        }
        if (anchor) {
          points.push({
            id: `${task.id}-anchor`,
            taskId: task.id,
            status: task.status,
            lane: 'actual',
            kind: 'actual',
            hour: anchor.hour,
            minutes: anchor.minutes,
          });
        }
      }
      return;
    }

    if (hasPlan) {
      points.push({
        id: `${task.id}-plan`,
        taskId: task.id,
        status: task.status,
        lane: config.layout === 'b' ? 'planned' : 'mixed',
        kind: 'planned',
        hour: task.plannedStartHour as number,
        minutes: 0,
      });
    }

    task.actualSessions.forEach((session, index) => {
      points.push({
        id: `${task.id}-session-${index}`,
        taskId: task.id,
        status: task.status,
        lane: config.layout === 'b' ? 'actual' : 'mixed',
        kind: 'actual',
        hour: session.hour,
        minutes: session.minutes,
      });
    });
  });

  return points;
};

const TimelineLabPrototype: React.FC<UiLabPrototypeRenderProps> = () => {
  const [timelineLayoutMode, setTimelineLayoutMode] = useState<TimelineLayoutMode>('a');
  const [timelinePointsMode, setTimelinePointsMode] = useState<TimelinePointsMode>('a');
  const [timelineGranularityMode, setTimelineGranularityMode] = useState<TimelineGranularityMode>('a');

  const unscheduledTasks = useMemo(() => TIMELINE_TASKS.filter((task) => task.plannedStartHour === null), []);

  const optionAConfig: TimelinePanelConfig = {
    layout: timelineLayoutMode,
    points: timelinePointsMode,
    granularity: timelineGranularityMode,
  };

  const optionBConfig: TimelinePanelConfig = {
    layout: invertMode(timelineLayoutMode),
    points: invertMode(timelinePointsMode),
    granularity: invertMode(timelineGranularityMode),
  };

  const renderTimelinePanel = (label: string, config: TimelinePanelConfig) => {
    const points = buildTimelinePoints(TIMELINE_TASKS, config);
    const rowY = config.layout === 'a' ? { mixed: 52, planned: 52, actual: 52 } : { mixed: 52, planned: 34, actual: 72 };
    const pointsWithX = points.map((point, index) => {
      const x =
        config.granularity === 'a'
          ? toHourPercent(point.hour, point.minutes)
          : toClusterPercent(index, points.length);
      return { ...point, x };
    });

    return (
      <Panel
        title={label}
        subtitle={`layout ${config.layout.toUpperCase()} • points ${config.points.toUpperCase()} • granularity ${config.granularity.toUpperCase()}`}
      >
        <div className="grid gap-4">
          <div className="relative h-[270px] rounded-[12px] border border-[var(--ui-border)] bg-[var(--ui-panel-2)] p-4">
            {config.layout === 'b' ? (
              <>
                <p className="absolute left-4 top-[22%] text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--ui-muted)]">Planned</p>
                <p className="absolute left-4 top-[60%] text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--ui-muted)]">Actual</p>
                <div className="absolute left-3 right-3 top-[31%] border-t border-[rgba(143,99,255,0.35)]" />
                <div className="absolute left-3 right-3 top-[69%] border-t border-[rgba(143,99,255,0.35)]" />
              </>
            ) : (
              <div className="absolute left-3 right-3 top-1/2 border-t border-[rgba(143,99,255,0.35)]" />
            )}

            {config.granularity === 'a' ? (
              <div className="absolute bottom-3 left-3 right-3">
                <div className="relative h-12">
                  {HOUR_TICKS.map((tick) => {
                    const left = (tick / 24) * 100;
                    return (
                      <div key={tick} className="absolute bottom-0" style={{ left: `${left}%`, transform: 'translateX(-50%)' }}>
                        <div className="h-2 w-px bg-[rgba(143,99,255,0.65)]" />
                        <div className="mt-1 text-[8px] font-semibold uppercase tracking-[0.12em] text-[var(--ui-muted)]">
                          {tick.toString().padStart(2, '0')}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[10px] font-semibold uppercase tracking-[0.25em] text-[var(--ui-muted)]">
                DAY CLUSTER
              </div>
            )}

            {pointsWithX.map((point) => {
              const color = STATUS_COLORS[point.status];
              const filled = point.kind === 'actual' || config.layout === 'a';
              const y = rowY[point.lane];
              return (
                <div
                  key={point.id}
                  className="absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
                  style={{
                    left: `${point.x}%`,
                    top: `${y}%`,
                    borderColor: color,
                    backgroundColor: filled ? color : 'transparent',
                    boxShadow: filled ? `0 0 8px ${color}88` : 'none',
                  }}
                  title={`${point.taskId} • ${point.kind} • ${point.hour.toString().padStart(2, '0')}:${point.minutes
                    .toString()
                    .padStart(2, '0')}`}
                />
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(['completed', 'scheduled', 'failed'] as TimelineStatus[]).map((status) => (
              <span
                key={status}
                className="inline-flex items-center gap-2 rounded-[10px] border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]"
                style={{
                  borderColor: `${STATUS_COLORS[status]}66`,
                  backgroundColor: `${STATUS_COLORS[status]}1F`,
                  color: STATUS_COLORS[status],
                }}
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[status] }} />
                {status}
              </span>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            {unscheduledTasks.map((task) => (
              <span
                key={`${label}-${task.id}`}
                className="chamfer-all inline-flex items-center gap-1 border border-[var(--ui-border)] bg-[var(--ui-panel)] px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-[var(--ui-muted)]"
              >
                UNSCHEDULED
                <span className="text-[var(--ui-text)]">{task.title}</span>
              </span>
            ))}
          </div>
        </div>
      </Panel>
    );
  };

  return (
    <section className="grid grid-cols-1 gap-4">
      <Panel title="Timeline Lab" subtitle="A/B preview sandbox">
        <div className="grid gap-3 lg:grid-cols-3">
          <div className="chamfer-card border border-[var(--ui-border)] bg-[var(--ui-panel-2)] p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--ui-muted)]">Layout</p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => setTimelineLayoutMode('a')}
                className={`ui-pressable chamfer-all border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${
                  timelineLayoutMode === 'a'
                    ? 'border-[var(--ui-accent)] bg-[rgba(143,99,255,0.24)] text-white ui-glow'
                    : 'border-[var(--ui-border)] bg-[var(--ui-panel)] text-[var(--ui-muted)]'
                }`}
              >
                A: mixed single line
              </button>
              <button
                type="button"
                onClick={() => setTimelineLayoutMode('b')}
                className={`ui-pressable chamfer-all border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${
                  timelineLayoutMode === 'b'
                    ? 'border-[var(--ui-accent)] bg-[rgba(143,99,255,0.24)] text-white ui-glow'
                    : 'border-[var(--ui-border)] bg-[var(--ui-panel)] text-[var(--ui-muted)]'
                }`}
              >
                B: planned/actual stacked
              </button>
            </div>
          </div>

          <div className="chamfer-card border border-[var(--ui-border)] bg-[var(--ui-panel-2)] p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--ui-muted)]">Points</p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => setTimelinePointsMode('a')}
                className={`ui-pressable chamfer-all border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${
                  timelinePointsMode === 'a'
                    ? 'border-[var(--ui-accent)] bg-[rgba(143,99,255,0.24)] text-white ui-glow'
                    : 'border-[var(--ui-border)] bg-[var(--ui-panel)] text-[var(--ui-muted)]'
                }`}
              >
                A: one point per task
              </button>
              <button
                type="button"
                onClick={() => setTimelinePointsMode('b')}
                className={`ui-pressable chamfer-all border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${
                  timelinePointsMode === 'b'
                    ? 'border-[var(--ui-accent)] bg-[rgba(143,99,255,0.24)] text-white ui-glow'
                    : 'border-[var(--ui-border)] bg-[var(--ui-panel)] text-[var(--ui-muted)]'
                }`}
              >
                B: sessions as points
              </button>
            </div>
          </div>

          <div className="chamfer-card border border-[var(--ui-border)] bg-[var(--ui-panel-2)] p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--ui-muted)]">Granularity</p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => setTimelineGranularityMode('a')}
                className={`ui-pressable chamfer-all border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${
                  timelineGranularityMode === 'a'
                    ? 'border-[var(--ui-accent)] bg-[rgba(143,99,255,0.24)] text-white ui-glow'
                    : 'border-[var(--ui-border)] bg-[var(--ui-panel)] text-[var(--ui-muted)]'
                }`}
              >
                A: hourly slots
              </button>
              <button
                type="button"
                onClick={() => setTimelineGranularityMode('b')}
                className={`ui-pressable chamfer-all border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${
                  timelineGranularityMode === 'b'
                    ? 'border-[var(--ui-accent)] bg-[rgba(143,99,255,0.24)] text-white ui-glow'
                    : 'border-[var(--ui-border)] bg-[var(--ui-panel)] text-[var(--ui-muted)]'
                }`}
              >
                B: day only
              </button>
            </div>
          </div>
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
        {renderTimelinePanel('Option A', optionAConfig)}
        {renderTimelinePanel('Option B', optionBConfig)}
      </div>
    </section>
  );
};

export default TimelineLabPrototype;
