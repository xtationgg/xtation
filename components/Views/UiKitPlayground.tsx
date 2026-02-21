import React, { useEffect, useMemo, useState } from 'react';
import { Bell, Play, Pause, RotateCcw, Sparkles, Volume2 } from 'lucide-react';
import { Panel } from '../UI/Panel';
import { Button } from '../UI/Button';
import { TabBar } from '../UI/Tabs';
import { Toggle } from '../UI/Toggle';
import { SideDrawer } from '../UI/SideDrawer';
import { StatPill } from '../UI/StatPill';

const TYPE_OPTIONS = ['Assault', 'Recon', 'Support', 'Stealth', 'Rush'];

const formatTimer = (seconds: number) => {
  const mins = Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0');
  const secs = (seconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
};

export const UiKitPlayground: React.FC = () => {
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [typeDrawerOpen, setTypeDrawerOpen] = useState(true);
  const [selectedType, setSelectedType] = useState(TYPE_OPTIONS[0]);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [activeTab, setActiveTab] = useState<'mission' | 'components'>('mission');

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

  return (
    <div className="h-full overflow-y-auto bg-[var(--ui-bg)] px-8 py-6 text-[var(--ui-text)]">
      <div className="mx-auto max-w-[1400px] space-y-6">
        <header className="space-y-3">
          <p className="text-[10px] uppercase tracking-[0.35em] text-[var(--ui-muted)]">Xtation UI Kit Playground</p>
          <h1 className="text-2xl font-black uppercase tracking-[0.14em]">Reusable HUD Components</h1>
          <TabBar
            tabs={[
              { value: 'mission', label: 'Mission / Timer' },
              { value: 'components', label: 'Components' },
            ]}
            value={activeTab}
            onChange={(value) => setActiveTab(value as 'mission' | 'components')}
          />
        </header>

        {activeTab === 'mission' ? (
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
        ) : (
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
        )}
      </div>
    </div>
  );
};

export default UiKitPlayground;
