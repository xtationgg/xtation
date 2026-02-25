import React, { useEffect, useMemo, useState } from 'react';
import { Bell, Play, Pause, RotateCcw, Sparkles, Volume2 } from 'lucide-react';
import { Panel } from '../UI/Panel';
import { Button } from '../UI/Button';
import { TabBar } from '../UI/Tabs';
import { Toggle } from '../UI/Toggle';
import { SideDrawer } from '../UI/SideDrawer';
import { StatPill } from '../UI/StatPill';
import { ThemeSwitcher } from '../UI/ThemeSwitcher';
import { useTheme } from '../../src/theme/ThemeProvider';

const TYPE_OPTIONS = ['Assault', 'Recon', 'Support', 'Stealth', 'Rush'];

type UiKitTab = 'components' | 'mission_composer' | 'timeline_lab' | 'proto_02' | 'proto_03';
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

interface TimelinePanelConfig {
  layout: TimelineLayoutMode;
  points: TimelinePointsMode;
  granularity: TimelineGranularityMode;
}

type TimelineRow = 'planned' | 'actual' | 'unscheduled';

interface TimelinePreviewPoint {
  id: string;
  taskId: string;
  title: string;
  status: TimelineStatus;
  row: TimelineRow;
  kind: 'planned' | 'actual';
  hour: number;
  minutes: number;
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

const formatTimer = (seconds: number) => {
  const mins = Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0');
  const secs = (seconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const UiKitPlayground: React.FC = () => {
  const { theme, options } = useTheme();
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [typeDrawerOpen, setTypeDrawerOpen] = useState(true);
  const [selectedType, setSelectedType] = useState(TYPE_OPTIONS[0]);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [activeTab, setActiveTab] = useState<UiKitTab>('components');
  const [showReference, setShowReference] = useState(true);
  const [referenceOpacity, setReferenceOpacity] = useState(100);
  const [timelineLayoutMode, setTimelineLayoutMode] = useState<TimelineLayoutMode>('a');
  const [timelinePointsMode, setTimelinePointsMode] = useState<TimelinePointsMode>('a');
  const [timelineGranularityMode, setTimelineGranularityMode] = useState<TimelineGranularityMode>('a');
  const [timelinePreviewVariant, setTimelinePreviewVariant] = useState<'a' | 'b'>('a');
  const [timelineUnscheduledOpen, setTimelineUnscheduledOpen] = useState(false);
  const [timelineTooltip, setTimelineTooltip] = useState<{
    x: number;
    y: number;
    title: string;
    status: TimelineStatus;
    time: string;
  } | null>(null);

  useEffect(() => {
    if (!running || paused) return;
    const interval = window.setInterval(() => {
      setTimerSeconds((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(interval);
  }, [running, paused]);

  const statusTone = useMemo(() => {
    if (!running) return 'neutral' as const;
    return paused ? ('paused' as const) : ('active' as const);
  }, [running, paused]);

  const statusLabel = running ? (paused ? 'Paused' : 'Active') : 'Idle';
  const activeThemeLabel = options.find((option) => option.value === theme)?.label ?? theme;
  const unscheduledTasks = useMemo(() => TIMELINE_TASKS.filter((task) => task.plannedStartHour === null), []);
  const activeTimelineConfig: TimelinePanelConfig = {
    layout: timelineLayoutMode,
    points: timelinePointsMode,
    granularity: timelineGranularityMode,
  };
  const timelinePoints = useMemo(() => {
    const points: TimelinePreviewPoint[] = [];

    TIMELINE_TASKS.forEach((task) => {
      const hasPlan = typeof task.plannedStartHour === 'number';
      const isUnscheduled = !hasPlan;
      const firstSession = task.actualSessions[0] ?? null;

      if (activeTimelineConfig.points === 'a') {
        if (isUnscheduled) {
          if (firstSession) {
            points.push({
              id: `${task.id}-unscheduled-anchor`,
              taskId: task.id,
              title: task.title,
              status: task.status,
              row: 'unscheduled',
              kind: 'actual',
              hour: firstSession.hour,
              minutes: firstSession.minutes,
            });
          }
          return;
        }

        if (activeTimelineConfig.layout === 'b') {
          if (firstSession) {
            points.push({
              id: `${task.id}-actual-anchor`,
              taskId: task.id,
              title: task.title,
              status: task.status,
              row: 'actual',
              kind: 'actual',
              hour: firstSession.hour,
              minutes: firstSession.minutes,
            });
          } else if (hasPlan) {
            points.push({
              id: `${task.id}-planned-anchor`,
              taskId: task.id,
              title: task.title,
              status: task.status,
              row: 'planned',
              kind: 'planned',
              hour: task.plannedStartHour as number,
              minutes: 0,
            });
          }
          return;
        }

        const fallbackHour = hasPlan ? (task.plannedStartHour as number) : 12;
        const fallbackMinutes = firstSession?.minutes ?? 0;
        points.push({
          id: `${task.id}-single-anchor`,
          taskId: task.id,
          title: task.title,
          status: task.status,
          row: 'actual',
          kind: firstSession ? 'actual' : 'planned',
          hour: firstSession?.hour ?? fallbackHour,
          minutes: fallbackMinutes,
        });
        return;
      }

      if (isUnscheduled) {
        task.actualSessions.forEach((session, sessionIndex) => {
          points.push({
            id: `${task.id}-unscheduled-session-${sessionIndex}`,
            taskId: task.id,
            title: task.title,
            status: task.status,
            row: 'unscheduled',
            kind: 'actual',
            hour: session.hour,
            minutes: session.minutes,
          });
        });
        return;
      }

      if (activeTimelineConfig.layout === 'b' && hasPlan) {
        points.push({
          id: `${task.id}-planned`,
          taskId: task.id,
          title: task.title,
          status: task.status,
          row: 'planned',
          kind: 'planned',
          hour: task.plannedStartHour as number,
          minutes: 0,
        });
      }

      if (task.actualSessions.length > 0) {
        task.actualSessions.forEach((session, sessionIndex) => {
          points.push({
            id: `${task.id}-actual-session-${sessionIndex}`,
            taskId: task.id,
            title: task.title,
            status: task.status,
            row: 'actual',
            kind: 'actual',
            hour: session.hour,
            minutes: session.minutes,
          });
        });
      } else if (activeTimelineConfig.layout === 'a' && hasPlan) {
        points.push({
          id: `${task.id}-single-planned`,
          taskId: task.id,
          title: task.title,
          status: task.status,
          row: 'actual',
          kind: 'planned',
          hour: task.plannedStartHour as number,
          minutes: 0,
        });
      }
    });

    return points;
  }, [timelineLayoutMode, timelinePointsMode]);

  const timelineChart = useMemo(() => {
    const chart = {
      width: 1200,
      height: 400,
      marginLeft: 48,
      marginRight: 22,
      marginTop: 24,
      marginBottom: 44,
      dotRadius: 5,
      verticalGap: 11,
      stackMaxVisible: 10,
    };

    const innerWidth = chart.width - chart.marginLeft - chart.marginRight;
    const hourStep = innerWidth / 24;
    const stackStep = chart.dotRadius * 2 + chart.verticalGap;

    const buckets = Array.from({ length: 24 }, () => [] as (TimelinePreviewPoint & { sortValue: number })[]);
    timelinePoints.forEach((point, index) => {
      const minutesFromMidnight = point.hour * 60 + point.minutes;
      const hourBucket = activeTimelineConfig.granularity === 'b' ? 12 : Math.floor(minutesFromMidnight / 60);
      const normalizedBucket = clamp(hourBucket, 0, 23);
      buckets[normalizedBucket].push({
        ...point,
        sortValue: minutesFromMidnight * 100 + (TIMELINE_TASKS.length - index),
      });
    });

    buckets.forEach((bucket) => bucket.sort((a, b) => b.sortValue - a.sortValue));

    const dotItems: Array<
      TimelinePreviewPoint & {
        cx: number;
        cy: number;
        overflowCount: number;
      }
    > = [];

    const overflowItems: Array<{ hour: number; count: number; x: number; y: number }> = [];
    const stackTopY = chart.marginTop + 24;

    buckets.forEach((bucket, hour) => {
      const x = chart.marginLeft + hourStep * hour + hourStep / 2;
      const visible = bucket.slice(0, chart.stackMaxVisible);
      visible.forEach((point, stackIndex) => {
        dotItems.push({
          ...point,
          cx: x,
          cy: stackTopY + stackIndex * stackStep,
          overflowCount: Math.max(0, bucket.length - chart.stackMaxVisible),
        });
      });

      if (bucket.length > chart.stackMaxVisible) {
        overflowItems.push({
          hour,
          count: bucket.length - chart.stackMaxVisible,
          x,
          y: stackTopY + chart.stackMaxVisible * stackStep + 2,
        });
      }
    });

    return { ...chart, innerWidth, hourStep, dotItems, overflowItems };
  }, [timelinePoints, activeTimelineConfig.granularity]);

  return (
    <div className="h-full overflow-y-auto bg-[var(--ui-bg)] px-8 py-6 text-[var(--ui-text)]">
      <div className="mx-auto max-w-[1400px] space-y-6">
        <header className="space-y-3">
          <p className="text-[10px] uppercase tracking-[0.35em] text-[var(--ui-muted)]">Xtation UI Kit Playground</p>
          <h1 className="text-2xl font-black uppercase tracking-[0.14em]">Reusable HUD Components</h1>
          <TabBar
            tabs={[
              { value: 'components', label: 'COMPONENTS' },
              { value: 'mission_composer', label: 'MISSION COMPOSER' },
              { value: 'timeline_lab', label: 'TIMELINE_LAB' },
              { value: 'proto_02', label: 'PROTO_02' },
              { value: 'proto_03', label: 'PROTO_03' },
            ]}
            value={activeTab}
            onChange={(value) => setActiveTab(value as UiKitTab)}
          />
        </header>

        <section className="grid grid-cols-1">
          <Panel title="Theme Preview" subtitle={`Current Theme: ${activeThemeLabel}`}>
            <ThemeSwitcher compact />
          </Panel>
        </section>

        {activeTab === 'components' ? (
          <>
            <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.6fr_0.78fr_0.72fr]">
              <Panel
                title="Mission Card"
                subtitle="left content panel"
                headerSlot={
                  <div className="flex items-center gap-2">
                    <StatPill label="Type" value={selectedType} tone="active" />
                    <StatPill label="State" value={statusLabel} tone={statusTone} />
                  </div>
                }
                className="min-h-[360px]"
              >
                <div className="grid gap-4">
                  <div className="chamfer-card border border-[var(--ui-border)] bg-[var(--ui-panel-2)] p-4">
                    <p className="text-[10px] uppercase tracking-[0.25em] text-[var(--ui-muted)]">Directive</p>
                    <p className="mt-2 text-2xl font-black uppercase tracking-[0.12em]">Secure Relay Node 7</p>
                    <p className="mt-2 max-w-[72ch] text-sm text-[var(--ui-muted)]">
                      Keep pressure on the zone, maintain line of sight, and hold objectives until extraction arrives.
                    </p>
                  </div>

                  <div className="chamfer-all flex items-center justify-between border border-[var(--ui-border)] bg-[var(--ui-panel-2)] px-4 py-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.24em] text-[var(--ui-muted)]">Elapsed</p>
                      <p className="mt-1 text-4xl font-black tracking-[0.12em] text-[var(--ui-text)]">{formatTimer(timerSeconds)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatPill label="Sound" value={soundOn ? 'On' : 'Off'} tone={soundOn ? 'active' : 'paused'} />
                      <StatPill label="Phase" value={running ? 'Live' : 'Prep'} tone={running ? 'active' : 'neutral'} />
                    </div>
                  </div>
                </div>
              </Panel>

              <Panel title="Actions" subtitle="middle action block" className="min-h-[360px]">
                <div className="grid gap-3">
                  <Button
                    variant="primary"
                    leftIcon={<Play size={14} />}
                    active={running && !paused}
                    onClick={() => {
                      setRunning(true);
                      setPaused(false);
                    }}
                  >
                    Start
                  </Button>

                  <Button
                    variant="secondary"
                    leftIcon={<Pause size={14} />}
                    active={running && paused}
                    disabled={!running}
                    onClick={() => setPaused((prev) => !prev)}
                  >
                    {paused ? 'Resume' : 'Pause'}
                  </Button>

                  <Button
                    variant="secondary"
                    leftIcon={<RotateCcw size={14} />}
                    onClick={() => {
                      setRunning(false);
                      setPaused(false);
                      setTimerSeconds(0);
                    }}
                  >
                    Reset
                  </Button>

                  <div className="pt-2">
                    <Toggle checked={soundOn} onChange={setSoundOn} label="Sound" />
                  </div>

                  <div className="mt-2 flex items-center gap-2">
                    <Button variant="icon" leftIcon={<Bell size={14} />} title="Notify" />
                    <Button variant="icon" leftIcon={<Sparkles size={14} />} title="Effects" />
                    <Button variant="icon" leftIcon={<Volume2 size={14} />} title="Audio" />
                  </div>
                </div>
              </Panel>

              <SideDrawer
                title="Type Select"
                open={typeDrawerOpen}
                onToggle={() => setTypeDrawerOpen((prev) => !prev)}
                collapsedLabel={selectedType}
              >
                <div className="grid gap-2">
                  {TYPE_OPTIONS.map((type) => {
                    const selected = type === selectedType;
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => {
                          setSelectedType(type);
                          setTypeDrawerOpen(false);
                        }}
                        className={`ui-pressable chamfer-card border px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.22em] ${
                          selected
                            ? 'border-[var(--ui-accent)] bg-[rgba(143,99,255,0.2)] text-white ui-glow'
                            : 'border-[var(--ui-border)] bg-[var(--ui-panel-2)] text-[var(--ui-muted)] hover:border-[var(--ui-accent)] hover:text-[var(--ui-text)]'
                        }`}
                      >
                        {type}
                      </button>
                    );
                  })}
                </div>
              </SideDrawer>
            </section>

            <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Panel title="Buttons" subtitle="primary / secondary / icon">
                <div className="flex flex-wrap items-center gap-3">
                  <Button variant="primary" leftIcon={<Play size={14} />}>
                    Primary
                  </Button>
                  <Button variant="secondary" leftIcon={<Pause size={14} />}>
                    Secondary
                  </Button>
                  <Button variant="icon" leftIcon={<Bell size={14} />} />
                </div>
              </Panel>

              <Panel title="Status Pills" subtitle="active / paused / neutral">
                <div className="flex flex-wrap items-center gap-2">
                  <StatPill label="Mission" value="Active" tone="active" />
                  <StatPill label="Mission" value="Paused" tone="paused" />
                  <StatPill label="Mission" value="Idle" tone="neutral" />
                </div>
              </Panel>
            </section>
          </>
        ) : activeTab === 'mission_composer' ? (
          <section className="grid grid-cols-1">
            <Panel title="Mission Composer" subtitle="1:1 reference build" className="min-h-[520px]">
              <div className="grid gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShowReference((prev) => !prev)}
                    className={`ui-pressable chamfer-all border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] ${
                      showReference
                        ? 'border-[var(--ui-accent)] bg-[rgba(143,99,255,0.2)] text-[var(--ui-text)] ui-glow'
                        : 'border-[var(--ui-border)] bg-[var(--ui-panel)] text-[var(--ui-muted)] hover:text-[var(--ui-text)]'
                    }`}
                  >
                    SHOW REFERENCE {showReference ? 'ON' : 'OFF'}
                  </button>
                  <div className="flex items-center gap-2 rounded-[12px] border border-[var(--ui-border)] bg-[var(--ui-panel)] px-3 py-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--ui-muted)]">Opacity</span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={referenceOpacity}
                      onChange={(event) => setReferenceOpacity(Number(event.target.value))}
                      className="accent-[var(--ui-accent)]"
                    />
                    <span className="min-w-[36px] text-right text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--ui-text)]">
                      {referenceOpacity}%
                    </span>
                  </div>
                </div>

                <div className="overflow-auto rounded-[10px] border border-[var(--ui-border)] bg-[var(--ui-panel-2)] p-4">
                  <div className="relative" style={{ width: 1920, height: 1016 }}>
                    {showReference ? (
                      <img
                        src="/ui-reference/mission-02.png"
                        alt="Mission Composer reference"
                        className="pointer-events-none absolute inset-0"
                        style={{ width: 1920, height: 1016, opacity: referenceOpacity / 100 }}
                      />
                    ) : null}
                    <div id="composer-overlay" className="absolute inset-0" />
                  </div>
                </div>
              </div>
            </Panel>
          </section>
        ) : activeTab === 'timeline_lab' ? (
          <section className="mx-auto grid w-full max-w-[1280px] grid-cols-1 gap-3">
            <div className="chamfer-card flex h-11 items-center justify-between border border-[var(--ui-border)] bg-[var(--ui-panel)] px-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--ui-text)]">TIMELINE LAB</p>
                <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--ui-muted)]">Day view prototype</p>
              </div>
              <div className="flex items-center gap-1 rounded-[10px] border border-[var(--ui-border)] bg-[var(--ui-panel-2)] p-1">
                <button
                  type="button"
                  onClick={() => setTimelinePreviewVariant('a')}
                  className={`ui-pressable chamfer-all border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${
                    timelinePreviewVariant === 'a'
                      ? 'border-[var(--ui-accent)] bg-[rgba(143,99,255,0.24)] text-white ui-glow'
                      : 'border-transparent bg-transparent text-[var(--ui-muted)]'
                  }`}
                >
                  A
                </button>
                <button
                  type="button"
                  onClick={() => setTimelinePreviewVariant('b')}
                  className={`ui-pressable chamfer-all border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${
                    timelinePreviewVariant === 'b'
                      ? 'border-[var(--ui-accent)] bg-[rgba(143,99,255,0.24)] text-white ui-glow'
                      : 'border-transparent bg-transparent text-[var(--ui-muted)]'
                  }`}
                >
                  B
                </button>
              </div>
            </div>

            <div className="chamfer-card flex h-11 items-center gap-3 overflow-x-auto whitespace-nowrap border border-[var(--ui-border)] bg-[var(--ui-panel)] px-3">
              <div className="flex shrink-0 items-center gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--ui-muted)]">Layout</span>
                <button
                  type="button"
                  onClick={() => setTimelineLayoutMode('a')}
                  className={`ui-pressable chamfer-all border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${
                    timelineLayoutMode === 'a'
                      ? 'border-[var(--ui-accent)] bg-[rgba(143,99,255,0.24)] text-white'
                      : 'border-[var(--ui-border)] bg-[var(--ui-panel-2)] text-[var(--ui-muted)]'
                  }`}
                >
                  Single
                </button>
                <button
                  type="button"
                  onClick={() => setTimelineLayoutMode('b')}
                  className={`ui-pressable chamfer-all border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${
                    timelineLayoutMode === 'b'
                      ? 'border-[var(--ui-accent)] bg-[rgba(143,99,255,0.24)] text-white'
                      : 'border-[var(--ui-border)] bg-[var(--ui-panel-2)] text-[var(--ui-muted)]'
                  }`}
                >
                  Planned/Actual
                </button>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--ui-muted)]">Points</span>
                <button
                  type="button"
                  onClick={() => setTimelinePointsMode('a')}
                  className={`ui-pressable chamfer-all border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${
                    timelinePointsMode === 'a'
                      ? 'border-[var(--ui-accent)] bg-[rgba(143,99,255,0.24)] text-white'
                      : 'border-[var(--ui-border)] bg-[var(--ui-panel-2)] text-[var(--ui-muted)]'
                  }`}
                >
                  Tasks
                </button>
                <button
                  type="button"
                  onClick={() => setTimelinePointsMode('b')}
                  className={`ui-pressable chamfer-all border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${
                    timelinePointsMode === 'b'
                      ? 'border-[var(--ui-accent)] bg-[rgba(143,99,255,0.24)] text-white'
                      : 'border-[var(--ui-border)] bg-[var(--ui-panel-2)] text-[var(--ui-muted)]'
                  }`}
                >
                  Sessions
                </button>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--ui-muted)]">Granularity</span>
                <button
                  type="button"
                  onClick={() => setTimelineGranularityMode('a')}
                  className={`ui-pressable chamfer-all border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${
                    timelineGranularityMode === 'a'
                      ? 'border-[var(--ui-accent)] bg-[rgba(143,99,255,0.24)] text-white'
                      : 'border-[var(--ui-border)] bg-[var(--ui-panel-2)] text-[var(--ui-muted)]'
                  }`}
                >
                  Hourly
                </button>
                <button
                  type="button"
                  onClick={() => setTimelineGranularityMode('b')}
                  className={`ui-pressable chamfer-all border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${
                    timelineGranularityMode === 'b'
                      ? 'border-[var(--ui-accent)] bg-[rgba(143,99,255,0.24)] text-white'
                      : 'border-[var(--ui-border)] bg-[var(--ui-panel-2)] text-[var(--ui-muted)]'
                  }`}
                >
                  Day-only
                </button>
              </div>
            </div>

            <Panel title={`Preview ${timelinePreviewVariant.toUpperCase()}`} subtitle="Single preview mode" className="min-h-[420px]">
              <div className="relative grid gap-3">
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

                <div className="relative h-[400px] overflow-hidden rounded-[12px] border border-[var(--ui-border)] bg-[var(--ui-panel-2)]">
                  <button
                    type="button"
                    onClick={() => setTimelineUnscheduledOpen((prev) => !prev)}
                    className="ui-pressable chamfer-all absolute right-3 top-3 z-[6] border border-[var(--ui-border)] bg-[var(--ui-panel)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--ui-text)] hover:border-[var(--ui-accent)]"
                  >
                    Unscheduled ({unscheduledTasks.length})
                  </button>

                  <svg viewBox={`0 0 ${timelineChart.width} ${timelineChart.height}`} className="h-full w-full">
                    <defs>
                      <pattern id="timeline-lab-grid" width={timelineChart.hourStep} height={22} patternUnits="userSpaceOnUse">
                        <path d={`M ${timelineChart.hourStep} 0 L 0 0 0 22`} fill="none" stroke="rgba(143,99,255,0.08)" strokeWidth="1" />
                      </pattern>
                    </defs>
                    <rect
                      x={timelineChart.marginLeft}
                      y={timelineChart.marginTop}
                      width={timelineChart.innerWidth}
                      height={timelineChart.height - timelineChart.marginTop - timelineChart.marginBottom}
                      fill="url(#timeline-lab-grid)"
                    />

                    {HOUR_TICKS.filter((tick) => tick % 2 === 0).map((tick) => {
                      const x = timelineChart.marginLeft + (timelineChart.innerWidth / 24) * tick;
                      const yBase = timelineChart.height - timelineChart.marginBottom;
                      return (
                        <g key={`axis-${tick}`}>
                          <line x1={x} y1={yBase} x2={x} y2={yBase + 6} stroke="rgba(143,99,255,0.45)" strokeWidth="1" />
                          <text
                            x={x}
                            y={yBase + 18}
                            textAnchor="middle"
                            fontSize="10"
                            fill="rgba(168,176,206,0.72)"
                            style={{ letterSpacing: '0.08em' }}
                          >
                            {tick.toString().padStart(2, '0')}
                          </text>
                        </g>
                      );
                    })}

                    <line
                      x1={timelineChart.marginLeft}
                      y1={timelineChart.height - timelineChart.marginBottom}
                      x2={timelineChart.width - timelineChart.marginRight}
                      y2={timelineChart.height - timelineChart.marginBottom}
                      stroke="rgba(143,99,255,0.32)"
                      strokeWidth="1"
                    />

                    {timelineChart.dotItems.map((point) => {
                      const isCompleted = point.status === 'completed';
                      const isScheduled = point.status === 'scheduled';
                      const isFailed = point.status === 'failed';
                      const dotFill = isScheduled ? 'transparent' : isFailed ? '#ed4245' : 'rgba(143,99,255,0.9)';
                      const dotStroke = isScheduled ? 'rgba(168,176,206,0.75)' : isFailed ? '#ed4245' : 'rgba(143,99,255,0.95)';
                      const dotStrokeWidth = isScheduled ? 2 : 1.5;

                      return (
                        <g key={point.id}>
                          <circle cx={point.cx} cy={point.cy} r={timelineChart.dotRadius} fill={dotFill} stroke={dotStroke} strokeWidth={dotStrokeWidth} />
                          <circle
                            cx={point.cx}
                            cy={point.cy}
                            r={timelineChart.dotRadius + 5}
                            fill="transparent"
                            onMouseMove={(event) => {
                              const svgRect = event.currentTarget.ownerSVGElement?.getBoundingClientRect();
                              if (!svgRect) return;
                              setTimelineTooltip({
                                x: event.clientX - svgRect.left + 10,
                                y: event.clientY - svgRect.top - 10,
                                title: point.title,
                                status: point.status,
                                time: `${point.hour.toString().padStart(2, '0')}:${point.minutes.toString().padStart(2, '0')}`,
                              });
                            }}
                            onMouseLeave={() => setTimelineTooltip(null)}
                          />
                        </g>
                      );
                    })}

                    {timelineChart.overflowItems.map((overflow) => (
                      <g key={`overflow-${overflow.hour}`}>
                        <rect
                          x={overflow.x - 12}
                          y={overflow.y - 9}
                          width="24"
                          height="16"
                          rx="8"
                          fill="rgba(24,28,48,0.95)"
                          stroke="rgba(143,99,255,0.45)"
                        />
                        <text
                          x={overflow.x}
                          y={overflow.y + 3}
                          textAnchor="middle"
                          fontSize="9"
                          fill="rgba(206,214,240,0.9)"
                          style={{ letterSpacing: '0.04em' }}
                        >
                          +{overflow.count}
                        </text>
                      </g>
                    ))}
                  </svg>

                  {timelineTooltip ? (
                    <div
                      className="pointer-events-none absolute z-10 rounded-[7px] border border-[var(--ui-border)] bg-[rgba(8,10,20,0.96)] px-2 py-1.5 text-[10px] text-[var(--ui-text)] shadow-[0_6px_16px_rgba(0,0,0,0.35)]"
                      style={{ left: timelineTooltip.x, top: timelineTooltip.y }}
                    >
                      <p className="font-semibold">{timelineTooltip.title}</p>
                      <p className="text-[var(--ui-muted)]">{timelineTooltip.status}</p>
                      <p className="text-[var(--ui-muted)]">{timelineTooltip.time}</p>
                    </div>
                  ) : null}

                  <aside
                    className={`absolute bottom-0 right-0 top-0 z-[7] w-[260px] border-l border-[var(--ui-border)] bg-[rgba(14,16,30,0.96)] p-3 transition-transform duration-150 ${
                      timelineUnscheduledOpen ? 'translate-x-0' : 'translate-x-full'
                    }`}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--ui-text)]">Unscheduled</p>
                      <button
                        type="button"
                        onClick={() => setTimelineUnscheduledOpen(false)}
                        className="ui-pressable chamfer-all border border-[var(--ui-border)] bg-[var(--ui-panel-2)] px-2 py-1 text-[9px] uppercase tracking-[0.15em] text-[var(--ui-muted)]"
                      >
                        Close
                      </button>
                    </div>
                    <div className="grid gap-2">
                      {unscheduledTasks.map((task) => (
                        <div key={task.id} className="chamfer-card border border-[var(--ui-border)] bg-[var(--ui-panel)] px-2 py-1.5">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--ui-text)]">{task.title}</p>
                          <p className="text-[9px] uppercase tracking-[0.14em] text-[var(--ui-muted)]">{task.status}</p>
                        </div>
                      ))}
                    </div>
                  </aside>
                </div>
              </div>
            </Panel>
          </section>
        ) : (
          <section className="grid grid-cols-1">
            <Panel
              title={activeTab === 'proto_02' ? 'PROTO_02' : 'PROTO_03'}
              subtitle="Empty slot for next prototype"
              className="min-h-[260px]"
            >
              <p className="text-sm text-[var(--ui-muted)]">Ready for next design.</p>
            </Panel>
          </section>
        )}
      </div>
    </div>
  );
};

export default UiKitPlayground;
