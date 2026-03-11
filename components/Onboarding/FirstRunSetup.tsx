import React, { useMemo, useState } from 'react';
import { ArrowRight, Boxes, Compass, Network, Sparkles } from 'lucide-react';
import { AuthDrawer } from '../UI/AuthDrawer';
import { useXP } from '../XP/xpStore';
import type { QuestLevel, SelfTreeBranch, Task } from '../XP/xpTypes';
import { encodeQuestNotesWithSteps, type QuestStepState } from '../../src/lib/quests/steps';
import { buildStarterWorkspaceCue, buildStarterWorkspaceRoute } from '../../src/onboarding/workspaceCue';
import { playClickSound, playHoverSound } from '../../utils/SoundEffects';
import type { XtationStarterTrack } from '../../src/onboarding/storage';

interface FirstRunSetupProps {
  open: boolean;
  onClose: () => void;
  onComplete: (payload: {
    questId: string;
    title: string;
    branch: SelfTreeBranch;
    track: XtationStarterTrack;
    nodeTitle?: string;
  }) => void;
}

const branchOptions: Array<{ branch: SelfTreeBranch; description: string }> = [
  { branch: 'Knowledge', description: 'Learning, study, research, and deeper understanding.' },
  { branch: 'Creation', description: 'Building, writing, design, code, and output.' },
  { branch: 'Systems', description: 'Planning, automation, structure, and process design.' },
  { branch: 'Communication', description: 'People, outreach, speaking, and negotiation.' },
  { branch: 'Physical', description: 'Training, recovery, movement, and health.' },
  { branch: 'Inner', description: 'Focus, discipline, calm, and internal stability.' },
];

const trackConfig: Record<
  XtationStarterTrack,
  {
    label: string;
    description: string;
    questType: Task['questType'];
    level: QuestLevel;
    priority: Task['priority'];
    icon: NonNullable<Task['icon']>;
    category: string;
    notes: string;
    steps: QuestStepState[];
    accent: string;
    Icon: React.ComponentType<{ size?: number; className?: string }>;
  }
> = {
  mission: {
    label: 'Mission',
    description: 'One clear action room quest with a focused execution loop.',
    questType: 'session',
    level: 2,
    priority: 'high',
    icon: 'flag',
    category: 'Quest',
    notes: 'Run a clean focused pass and close with a short debrief.',
    steps: [
      { text: 'Define what done looks like for this first pass.', done: false },
      { text: 'Run one focused work session without context switching.', done: false },
      { text: 'Capture the result and next move before closing.', done: false },
    ],
    accent: 'text-[var(--app-accent)]',
    Icon: Compass,
  },
  practice: {
    label: 'Practice',
    description: 'A smaller repeatable push to build momentum and consistency.',
    questType: 'instant',
    level: 1,
    priority: 'normal',
    icon: 'zap',
    category: 'Practice',
    notes: 'Start with a minimum viable rep so the station begins moving immediately.',
    steps: [
      { text: 'Set the minimum rep or outcome for today.', done: false },
      { text: 'Do the first rep now.', done: false },
      { text: 'Log how it felt so the next run starts cleaner.', done: false },
    ],
    accent: 'text-[#90efc4]',
    Icon: Sparkles,
  },
  system: {
    label: 'System',
    description: 'Use XTATION to build a repeatable workflow, template, or operating loop.',
    questType: 'session',
    level: 3,
    priority: 'high',
    icon: 'shield',
    category: 'System build',
    notes: 'Turn one messy process into a repeatable system you can run again later.',
    steps: [
      { text: 'Map the workflow or loop you want to improve.', done: false },
      { text: 'Build the first template, rule, or operating sheet.', done: false },
      { text: 'Test the loop once end-to-end and record friction.', done: false },
    ],
    accent: 'text-[#8cb8ff]',
    Icon: Boxes,
  },
};

export const FirstRunSetup: React.FC<FirstRunSetupProps> = ({ open, onClose, onComplete }) => {
  const { addSelfTreeNode, addTask, selfTreeNodes } = useXP();
  const [selectedBranch, setSelectedBranch] = useState<SelfTreeBranch>('Knowledge');
  const [selectedTrack, setSelectedTrack] = useState<XtationStarterTrack>('mission');
  const [questTitle, setQuestTitle] = useState('');
  const [nodeTitle, setNodeTitle] = useState('');
  const [error, setError] = useState<string | null>(null);

  const starter = trackConfig[selectedTrack];
  const previewQuestTitle = questTitle.trim() || `First ${starter.label.toLowerCase()} loop`;
  const previewRoute = useMemo(
    () =>
      buildStarterWorkspaceRoute({
        questId: '__preview__',
        title: previewQuestTitle,
        branch: selectedBranch,
        track: selectedTrack,
        nodeTitle: nodeTitle.trim() || undefined,
        createdAt: Date.now(),
      }),
    [nodeTitle, previewQuestTitle, selectedBranch, selectedTrack]
  );
  const previewCue = useMemo(
    () =>
      buildStarterWorkspaceCue({
        questId: '__preview__',
        title: previewQuestTitle,
        branch: selectedBranch,
        track: selectedTrack,
        nodeTitle: nodeTitle.trim() || undefined,
        createdAt: Date.now(),
      }),
    [nodeTitle, previewQuestTitle, selectedBranch, selectedTrack]
  );

  const nodePlaceholder = useMemo(() => {
    if (selectedBranch === 'Knowledge') return 'Example: French / AI Research / Economics';
    if (selectedBranch === 'Creation') return 'Example: Writing / Web Design / Video Editing';
    if (selectedBranch === 'Systems') return 'Example: Planning / Automation / Review Loop';
    if (selectedBranch === 'Communication') return 'Example: Outreach / Speaking / Negotiation';
    if (selectedBranch === 'Physical') return 'Example: Pushups / Running / Mobility';
    return 'Example: Focus / Discipline / Recovery';
  }, [selectedBranch]);

  const handleSeedStation = () => {
    const trimmedQuestTitle = questTitle.trim();
    const trimmedNodeTitle = nodeTitle.trim();

    if (!trimmedQuestTitle) {
      setError('Name the first quest so XTATION has something concrete to run.');
      return;
    }

    const notes = [
      starter.notes,
      `Primary branch: ${selectedBranch}.`,
      trimmedNodeTitle ? `Growth node: ${trimmedNodeTitle}.` : null,
    ]
      .filter(Boolean)
      .join('\n');

    if (trimmedNodeTitle) {
      const alreadyExists = selfTreeNodes.some(
        (node) =>
          node.rootBranch === selectedBranch &&
          node.title.trim().toLowerCase() === trimmedNodeTitle.toLowerCase()
      );

      if (!alreadyExists) {
        addSelfTreeNode({
          rootBranch: selectedBranch,
          title: trimmedNodeTitle,
          description: `Seeded during first-run setup for ${trimmedQuestTitle}.`,
        });
      }
    }

    const questId = addTask({
      title: trimmedQuestTitle,
      details: encodeQuestNotesWithSteps(notes, starter.steps),
      priority: starter.priority,
      status: 'todo',
      category: starter.category,
      questType: starter.questType,
      level: starter.level,
      selfTreePrimary: selectedBranch,
      estimatedMinutes: starter.questType === 'session' ? 45 : 15,
      icon: starter.icon,
    });

    playClickSound();
    onComplete({
      questId,
      title: trimmedQuestTitle,
      branch: selectedBranch,
      track: selectedTrack,
      nodeTitle: trimmedNodeTitle || undefined,
    });
  };

  return (
    <AuthDrawer
      open={open}
      onClose={onClose}
      variant="center"
      panelClassName="!w-[min(96vw,1320px)] !max-h-[94dvh] overflow-hidden rounded-[28px] border border-[color-mix(in_srgb,var(--app-border)_88%,transparent)] bg-[radial-gradient(circle_at_top_left,rgba(111,178,255,0.12),transparent_30%),linear-gradient(180deg,rgba(9,12,22,0.98),rgba(9,11,18,0.98))] shadow-[0_36px_140px_rgba(0,0,0,0.46)]"
    >
      <div className="flex max-h-[94dvh] flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto p-5 md:p-7">
          <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="space-y-5">
          <div className="rounded-[24px] border border-[color-mix(in_srgb,var(--app-accent)_22%,transparent)] bg-[color-mix(in_srgb,var(--app-panel)_82%,transparent)] p-5">
            <div className="text-[10px] uppercase tracking-[0.28em] text-[var(--app-accent)]">Station Setup</div>
            <h2 className="mt-3 text-3xl font-semibold text-[var(--app-text)]">Seed the first XTATION loop</h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--app-muted)]">
              Pick the branch you want to grow first, name one real quest, and let XTATION build the initial action room around it.
            </p>
          </div>

          <div className="rounded-[24px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_84%,transparent)] p-5">
            <div className="text-[10px] uppercase tracking-[0.24em] text-[var(--app-muted)]">1. Choose your first branch</div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {branchOptions.map(({ branch, description }) => (
                <button
                  key={branch}
                  type="button"
                  onMouseEnter={playHoverSound}
                  onClick={() => {
                    playClickSound();
                    setSelectedBranch(branch);
                  }}
                  className={`rounded-[20px] border px-4 py-4 text-left transition-colors ${
                    selectedBranch === branch
                      ? 'border-[var(--app-accent)] bg-[color-mix(in_srgb,var(--app-accent)_14%,transparent)]'
                      : 'border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-2)_72%,transparent)] hover:border-[var(--app-accent)]'
                  }`}
                >
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--app-text)]">{branch}</div>
                  <div className="mt-2 text-sm leading-6 text-[var(--app-muted)]">{description}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-[24px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_84%,transparent)] p-5">
            <div className="text-[10px] uppercase tracking-[0.24em] text-[var(--app-muted)]">2. Pick the first operating track</div>
            <div className="mt-4 grid gap-3 lg:grid-cols-3">
              {(['mission', 'practice', 'system'] as XtationStarterTrack[]).map((trackKey) => {
                const option = trackConfig[trackKey];
                const Icon = option.Icon;
                return (
                  <button
                    key={trackKey}
                    type="button"
                    onMouseEnter={playHoverSound}
                    onClick={() => {
                      playClickSound();
                      setSelectedTrack(trackKey);
                    }}
                    className={`rounded-[20px] border px-4 py-4 text-left transition-colors ${
                      selectedTrack === trackKey
                        ? 'border-[var(--app-accent)] bg-[color-mix(in_srgb,var(--app-accent)_14%,transparent)]'
                        : 'border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-2)_72%,transparent)] hover:border-[var(--app-accent)]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${option.accent}`}>{option.label}</div>
                      <Icon size={16} className={option.accent} />
                    </div>
                    <div className="mt-2 text-sm leading-6 text-[var(--app-muted)]">{option.description}</div>
                    <div className="mt-3 text-[10px] uppercase tracking-[0.16em] text-[var(--app-muted)]">
                      {option.questType} · L{option.level}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-[24px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_84%,transparent)] p-5">
            <div className="text-[10px] uppercase tracking-[0.24em] text-[var(--app-muted)]">3. Name the first quest</div>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <label className="block">
                <div className="mb-2 text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">Quest title</div>
                <input
                  type="text"
                  value={questTitle}
                  onChange={(event) => {
                    setQuestTitle(event.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="Example: Ship the onboarding flow"
                  className="h-12 w-full rounded-[14px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-2)_80%,transparent)] px-4 text-sm text-[var(--app-text)] outline-none transition-colors focus:border-[var(--app-accent)]"
                />
              </label>

              <label className="block">
                <div className="mb-2 text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">Optional self tree node</div>
                <input
                  type="text"
                  value={nodeTitle}
                  onChange={(event) => setNodeTitle(event.target.value)}
                  placeholder={nodePlaceholder}
                  className="h-12 w-full rounded-[14px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-2)_80%,transparent)] px-4 text-sm text-[var(--app-text)] outline-none transition-colors focus:border-[var(--app-accent)]"
                />
              </label>
            </div>

            {error ? (
              <div className="mt-4 rounded-[16px] border border-[color-mix(in_srgb,var(--app-accent)_40%,transparent)] bg-[color-mix(in_srgb,var(--app-accent)_10%,transparent)] px-4 py-3 text-sm text-[var(--app-muted)]">
                {error}
              </div>
            ) : null}
          </div>
        </section>

        <aside className="space-y-5">
          <div className="rounded-[24px] border border-[color-mix(in_srgb,var(--app-accent)_18%,transparent)] bg-[color-mix(in_srgb,var(--app-panel)_86%,transparent)] p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] uppercase tracking-[0.24em] text-[var(--app-accent)]">Preview</div>
                <div className="mt-2 text-xl font-semibold text-[var(--app-text)]">What XTATION will create</div>
              </div>
              <Network size={18} className="text-[var(--app-accent)]" />
            </div>

            <div className="mt-5 space-y-4">
              <div className="rounded-[18px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-2)_72%,transparent)] px-4 py-4">
                <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--app-muted)]">Primary branch</div>
                <div className="mt-2 text-lg font-semibold text-[var(--app-text)]">{selectedBranch}</div>
              </div>

              <div className="rounded-[18px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-2)_72%,transparent)] px-4 py-4">
                <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--app-muted)]">Quest shape</div>
                <div className="mt-2 text-lg font-semibold text-[var(--app-text)]">{trackConfig[selectedTrack].label}</div>
                <div className="mt-1 text-sm leading-6 text-[var(--app-muted)]">
                  {trackConfig[selectedTrack].questType} · L{trackConfig[selectedTrack].level} · {trackConfig[selectedTrack].priority} priority
                </div>
              </div>

              <div className="rounded-[18px] border border-[color-mix(in_srgb,var(--app-accent)_20%,transparent)] bg-[color-mix(in_srgb,var(--app-accent)_8%,transparent)] px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--app-accent)]">After launch</div>
                    <div className="mt-2 text-lg font-semibold text-[var(--app-text)]">{previewRoute.workspaceAction}</div>
                  </div>
                  <ArrowRight size={16} className="text-[var(--app-accent)]" />
                </div>
                <div className="mt-3 text-sm leading-6 text-[var(--app-muted)]">
                  XTATION will route this starter loop into {previewRoute.workspaceView === 'PROFILE' ? 'Profile' : 'Lab'} and recommend the first local move there.
                </div>
                <div className="mt-4 rounded-[14px] border border-[color-mix(in_srgb,var(--app-border)_74%,transparent)] px-3 py-3">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--app-muted)]">Recommended next move</div>
                  <div className="mt-2 text-sm font-semibold text-[var(--app-text)]">{previewCue.recommendedActionLabel}</div>
                  <div className="mt-1 text-sm leading-6 text-[var(--app-muted)]">{previewCue.recommendedDetail}</div>
                </div>
                <div className="mt-4 space-y-2">
                  {previewRoute.steps.map((step, index) => (
                    <div
                      key={`preview-route-${index}`}
                      className="rounded-[14px] border border-[color-mix(in_srgb,var(--app-border)_74%,transparent)] px-3 py-2 text-sm text-[var(--app-muted)]"
                    >
                      {index + 1}. {step}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[18px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-2)_72%,transparent)] px-4 py-4">
                <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--app-muted)]">Starter steps</div>
                <div className="mt-3 space-y-2">
                  {starter.steps.map((step) => (
                    <div key={step.text} className="rounded-[14px] border border-[color-mix(in_srgb,var(--app-border)_74%,transparent)] px-3 py-2 text-sm text-[var(--app-muted)]">
                      {step.text}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[24px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_86%,transparent)] p-5">
            <div className="text-[10px] uppercase tracking-[0.24em] text-[var(--app-muted)]">Finish setup</div>
            <div className="mt-3 text-sm leading-7 text-[var(--app-muted)]">
              This seeds the station with one real quest and optional growth node so Play opens with a concrete next move instead of an empty shell.
            </div>
          </div>
        </aside>
          </div>
        </div>

        <div className="border-t border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_92%,black)] px-5 py-4 md:px-7">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
              Seed the station now, or skip and continue with an empty local shell.
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onMouseEnter={playHoverSound}
                onClick={onClose}
                className="inline-flex h-11 items-center justify-center rounded-[14px] border border-[var(--app-border)] px-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--app-muted)] transition-colors hover:border-[var(--app-accent)] hover:text-[var(--app-text)]"
              >
                Skip for now
              </button>
              <button
                type="button"
                onMouseEnter={playHoverSound}
                onClick={handleSeedStation}
                className="ui-pressable inline-flex h-12 items-center justify-center gap-2 rounded-[14px] border border-[var(--app-accent)] bg-[color-mix(in_srgb,var(--app-accent)_18%,transparent)] px-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--app-text)]"
              >
                Seed Station
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </AuthDrawer>
  );
};
