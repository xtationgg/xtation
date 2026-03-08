import React from 'react';
import { Layers } from 'lucide-react';
import { Project, Milestone } from '../XP/xpTypes';

const STATUS_COLORS: Record<Project['status'], string> = {
  Draft: 'text-[var(--app-muted)]',
  Active: 'text-[var(--app-accent)]',
  OnHold: 'text-[color-mix(in_srgb,var(--app-accent)_55%,var(--app-muted))]',
  Completed: 'text-[color-mix(in_srgb,var(--app-accent)_80%,#ffffff)]',
  Archived: 'text-[var(--app-muted)] opacity-60',
};

interface ProjectCardProps {
  project: Project;
  milestones: Milestone[];
  onOpen: () => void;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({ project, milestones, onOpen }) => {
  const projectMilestones = milestones.filter((m) => m.projectId === project.id);
  const completed = projectMilestones.filter((m) => m.isCompleted).length;
  const total = projectMilestones.length;
  const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
      className="relative w-full overflow-hidden rounded-[12px] border border-[var(--app-border)] bg-[var(--app-panel)] hover:bg-[color-mix(in_srgb,var(--app-accent)_7%,var(--app-panel))] transition-colors cursor-pointer p-3"
    >
      <div className="flex items-start gap-2">
        <div className="mt-0.5 shrink-0 text-[var(--app-muted)]">
          <Layers size={14} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="truncate text-[12px] font-semibold leading-5 tracking-[0.04em] text-[var(--app-text)]">
              {project.title}
            </span>
            <span className="shrink-0 rounded px-1 py-px text-[8px] font-semibold uppercase tracking-[0.14em] text-[var(--app-muted)] ring-1 ring-inset ring-[var(--app-border)]">
              {project.type}
            </span>
            <span className="shrink-0 rounded px-1 py-px text-[8px] font-semibold uppercase tracking-[0.14em] text-[var(--app-accent)] ring-1 ring-inset ring-[color-mix(in_srgb,var(--app-accent)_40%,transparent)]">
              L{project.level}
            </span>
          </div>

          <div className="mt-0.5 flex items-center gap-2">
            <span className="text-[9px] uppercase tracking-[0.12em] text-[var(--app-muted)]">
              {project.selfTreePrimary}
            </span>
            <span className={`text-[9px] uppercase tracking-[0.12em] font-semibold ${STATUS_COLORS[project.status]}`}>
              {project.status}
            </span>
          </div>

          {total > 0 ? (
            <div className="mt-2">
              <div className="mb-1 flex justify-between">
                <span className="text-[9px] text-[var(--app-muted)]">
                  {completed}/{total} milestones
                </span>
                <span className="text-[9px] text-[var(--app-muted)]">{progressPct}%</span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--app-border)_70%,transparent)]">
                <div
                  className="h-full rounded-full bg-[var(--app-accent)] transition-[width] duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="mt-1 text-[9px] text-[var(--app-muted)]">No milestones yet</div>
          )}
        </div>
      </div>
    </article>
  );
};
