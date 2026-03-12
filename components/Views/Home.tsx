import React from 'react';
import { Bot, Braces, FileText, Sparkles, Workflow } from 'lucide-react';

const labCards = [
  {
    title: 'Workspace',
    subtitle: 'One home for active systems',
    body: 'Assistant projects, recent notes, and system status should converge here instead of scattering across random panels.',
    icon: Sparkles,
  },
  {
    title: 'Automations',
    subtitle: 'Rules driven by engine events',
    body: 'Quest completion, session start, reminders, and follow-up logic should be understandable, reversible, and local-first.',
    icon: Workflow,
  },
  {
    title: 'Assistants',
    subtitle: 'Structured work, not chat chaos',
    body: 'Research, coding, writing, and planning should live inside scoped projects with linked notes, quests, and generated outputs.',
    icon: Bot,
  },
  {
    title: 'Knowledge',
    subtitle: 'Obsidian-like, but actionable',
    body: 'Notes, canvases, and collections should connect directly to quests, self-tree growth, players, and automations.',
    icon: FileText,
  },
];

export const Home: React.FC = () => {
  return (
    <div className="min-h-full w-full bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.06),transparent_32%),linear-gradient(180deg,rgba(12,12,17,0.96),rgba(10,10,14,0.98))] px-4 py-6 md:px-8 md:py-8">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6">
        <section className="overflow-hidden rounded-[28px] border border-[color-mix(in_srgb,var(--app-border)_70%,transparent)] bg-[linear-gradient(135deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))] p-6 shadow-[0_28px_80px_rgba(0,0,0,0.32)] md:p-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="text-[10px] uppercase tracking-[0.28em] text-[var(--app-accent)]">Lab / System Workshop</div>
              <h1 className="mt-2 text-3xl font-semibold tracking-[0.01em] text-[var(--app-text)] md:text-4xl">
                Build the machine behind your execution.
              </h1>
              <p className="mt-3 text-sm leading-6 text-[color-mix(in_srgb,var(--app-text)_72%,var(--app-muted))]">
                Lab is where Xtation becomes more than a timer. It is the place for automations, assistant projects,
                notes, templates, and the systems that make Play sharper over time.
              </p>
            </div>

            <div className="inline-flex items-center gap-2 rounded-full border border-[color-mix(in_srgb,var(--app-accent)_28%,transparent)] bg-[color-mix(in_srgb,var(--app-accent)_10%,transparent)] px-4 py-2 text-[10px] uppercase tracking-[0.18em] text-[var(--app-accent)]">
              <Braces size={14} />
              Lab V1 is the next major build track
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
          {labCards.map(({ title, subtitle, body, icon: Icon }) => (
            <article
              key={title}
              className="rounded-[24px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_86%,transparent)] p-5 shadow-[0_20px_40px_rgba(0,0,0,0.22)]"
            >
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[color-mix(in_srgb,var(--app-accent)_26%,transparent)] bg-[color-mix(in_srgb,var(--app-accent)_12%,transparent)] text-[var(--app-accent)]">
                <Icon size={18} />
              </div>
              <h2 className="mt-4 text-xl font-semibold text-[var(--app-text)]">{title}</h2>
              <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">{subtitle}</div>
              <p className="mt-4 text-sm leading-6 text-[var(--app-muted)]">{body}</p>
            </article>
          ))}
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <article className="rounded-[24px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_86%,transparent)] p-5">
            <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--app-muted)]">Locked Structure</div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {['Workspace', 'Automations', 'Assistants', 'Knowledge', 'Templates', 'Extensions'].map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-[color-mix(in_srgb,var(--app-border)_78%,transparent)] bg-[color-mix(in_srgb,var(--app-panel-2)_72%,transparent)] px-4 py-3 text-sm text-[var(--app-text)]"
                >
                  {item}
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-[24px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_86%,transparent)] p-5">
            <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--app-muted)]">Current Direction</div>
            <div className="mt-4 space-y-3 text-sm leading-6 text-[var(--app-muted)]">
              <p>Play is now the primary action room.</p>
              <p>Lab is the next major system to implement on top of the locked architecture.</p>
              <p>Notes, assistant projects, and event-driven automations will land here, not inside random side panels.</p>
            </div>
          </article>
        </section>
      </div>
    </div>
  );
};
