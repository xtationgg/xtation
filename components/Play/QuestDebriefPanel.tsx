import React, { useCallback, useMemo, useState } from 'react';
import {
  BookOpen,
  Bot,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Sparkles,
  Trophy,
  X,
  Zap,
} from 'lucide-react';
import { useXP } from '../XP/xpStore';
import type { Task, XPBreakdown } from '../XP/xpTypes';
import { getQuestStepCounts, parseQuestNotesAndSteps } from '../../src/lib/quests/steps';
import { useLab } from '../../src/lab/LabProvider';
import { openDuskBrief } from '../../src/dusk/bridge';

export interface QuestDebriefPanelProps {
  taskId: string;
  onClose: () => void;
  onNavigate?: (view: string) => void;
}

export const QuestDebriefPanel: React.FC<QuestDebriefPanelProps> = ({
  taskId,
  onClose,
  onNavigate,
}) => {
  const { selectors } = useXP();
  const lab = useLab();
  const task = selectors.getTaskById(taskId);
  const xpBreakdown = selectors.getQuestCompletionXP(taskId);
  const [reflectionText, setReflectionText] = useState('');
  const [savedToLab, setSavedToLab] = useState(false);

  const stepCounts = useMemo(
    () => (task ? getQuestStepCounts(task.details) : { completed: 0, total: 0 }),
    [task],
  );

  const sessionMinutes = useMemo(() => {
    if (!task?.completedAt || !task?.startedAt) return 0;
    return Math.max(0, Math.floor((task.completedAt - task.startedAt) / 60000));
  }, [task]);

  const handleSaveToLab = useCallback(() => {
    if (!task || savedToLab) return;
    const parsed = parseQuestNotesAndSteps(task.details);
    const lines: string[] = [];
    lines.push(`Quest completed: ${task.title}`);
    if (sessionMinutes > 0) lines.push(`Duration: ${sessionMinutes}m`);
    if (stepCounts.total > 0)
      lines.push(`Steps: ${stepCounts.completed}/${stepCounts.total}`);
    if (xpBreakdown) lines.push(`XP earned: ${xpBreakdown.total}`);
    if (parsed.notes) lines.push(`\nNotes:\n${parsed.notes}`);
    if (reflectionText.trim()) lines.push(`\nReflection:\n${reflectionText.trim()}`);

    lab.addNote({
      title: `Debrief: ${task.title}`,
      content: lines.join('\n'),
      kind: 'brief',
      tags: ['debrief', 'quest-completion'],
      linkedQuestIds: [task.id],
    });
    setSavedToLab(true);
  }, [task, lab, xpBreakdown, reflectionText, sessionMinutes, stepCounts, savedToLab]);

  const handleBriefDusk = useCallback(() => {
    if (!task) return;
    openDuskBrief({
      title: `Debrief: ${task.title}`,
      body: reflectionText.trim() || `Just completed: ${task.title}`,
      source: 'quest-debrief',
    });
  }, [task, reflectionText]);

  if (!task) return null;

  const xpTotal = xpBreakdown?.total ?? 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Quest debrief: ${task.title}`}
    >
      <div className="absolute inset-0 bg-black/50" />

      <div
        className="relative z-10 flex w-full max-w-lg flex-col overflow-hidden rounded border border-[var(--app-border)] bg-[var(--app-panel)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 border-b border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-accent)_6%,var(--app-panel))] px-5 pt-5 pb-4">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex items-center gap-2.5">
              <div
                className="flex h-8 w-8 items-center justify-center rounded"
                style={{ background: 'color-mix(in_srgb,#43d39e 18%,var(--app-panel-2))' }}
              >
                <Trophy size={16} className="text-emerald-400" />
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--app-muted)]">
                  Quest Complete
                </div>
                <h2 className="text-[15px] font-bold leading-[1.3] text-[var(--app-text)]">
                  {task.title}
                </h2>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 inline-flex h-7 w-7 items-center justify-center rounded border border-[var(--app-border)] text-[var(--app-muted)] hover:border-[var(--app-accent)] hover:text-[var(--app-accent)] transition-colors"
              aria-label="Close debrief"
            >
              <X size={14} />
            </button>
          </div>

          {/* Stat chips */}
          <div className="flex flex-wrap items-center gap-2 mt-1">
            {xpTotal > 0 ? (
              <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold tracking-[0.08em]" style={{ background: 'color-mix(in_srgb,var(--app-accent) 14%,var(--app-panel-2))', color: 'var(--app-accent)' }}>
                <Zap size={10} /> +{xpTotal} XP
              </span>
            ) : null}
            {sessionMinutes > 0 ? (
              <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium text-[var(--app-muted)]" style={{ background: 'var(--app-panel-2)' }}>
                <Clock3 size={10} /> {sessionMinutes}m
              </span>
            ) : null}
            {stepCounts.total > 0 ? (
              <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium text-[var(--app-muted)]" style={{ background: 'var(--app-panel-2)' }}>
                <CheckCircle2 size={10} /> {stepCounts.completed}/{stepCounts.total} steps
              </span>
            ) : null}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* XP Breakdown */}
          {xpBreakdown && xpTotal > 0 ? (
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--app-muted)] mb-2">
                XP Breakdown
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {xpBreakdown.sessionXP > 0 ? (
                  <div className="rounded px-2.5 py-1.5 text-[11px] text-[var(--app-text)]" style={{ background: 'var(--app-panel-2)' }}>
                    Session <span className="float-right font-semibold">+{xpBreakdown.sessionXP}</span>
                  </div>
                ) : null}
                {xpBreakdown.completionBonus > 0 ? (
                  <div className="rounded px-2.5 py-1.5 text-[11px] text-[var(--app-text)]" style={{ background: 'var(--app-panel-2)' }}>
                    Completion <span className="float-right font-semibold">+{xpBreakdown.completionBonus}</span>
                  </div>
                ) : null}
                {xpBreakdown.deepBonus > 0 ? (
                  <div className="rounded px-2.5 py-1.5 text-[11px] text-[var(--app-text)]" style={{ background: 'var(--app-panel-2)' }}>
                    Deep focus <span className="float-right font-semibold">+{xpBreakdown.deepBonus}</span>
                  </div>
                ) : null}
                {xpBreakdown.stepXP > 0 ? (
                  <div className="rounded px-2.5 py-1.5 text-[11px] text-[var(--app-text)]" style={{ background: 'var(--app-panel-2)' }}>
                    Steps <span className="float-right font-semibold">+{xpBreakdown.stepXP}</span>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {/* Reflection */}
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--app-muted)] mb-2">
              Reflection <span className="normal-case tracking-normal font-normal">(optional)</span>
            </div>
            <textarea
              value={reflectionText}
              onChange={(e) => setReflectionText(e.target.value)}
              placeholder="What went well? What's next?"
              rows={3}
              className="w-full resize-none rounded border border-[var(--app-border)] bg-[var(--app-panel-2)] px-3 py-2.5 text-[12px] text-[var(--app-text)] placeholder:text-[var(--app-muted)] focus:outline-none focus:border-[var(--app-accent)] transition-colors"
            />
          </div>
        </div>

        {/* Actions footer */}
        <div className="shrink-0 border-t border-[var(--app-border)] px-5 py-3 flex items-center gap-2">
          <button
            type="button"
            onClick={handleSaveToLab}
            disabled={savedToLab}
            className="inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-[11px] font-semibold transition-colors border"
            style={{
              background: savedToLab
                ? 'color-mix(in_srgb,#43d39e 14%,var(--app-panel-2))'
                : 'color-mix(in_srgb,var(--app-accent) 10%,var(--app-panel-2))',
              borderColor: savedToLab ? '#43d39e' : 'var(--app-border)',
              color: savedToLab ? '#43d39e' : 'var(--app-text)',
            }}
          >
            {savedToLab ? <CheckCircle2 size={12} /> : <BookOpen size={12} />}
            {savedToLab ? 'Saved to Lab' : 'Save to Lab'}
          </button>

          <button
            type="button"
            onClick={handleBriefDusk}
            className="inline-flex items-center gap-1.5 rounded border border-[var(--app-border)] px-3 py-1.5 text-[11px] font-semibold text-[var(--app-text)] hover:border-[var(--app-accent)] transition-colors"
            style={{ background: 'var(--app-panel-2)' }}
          >
            <Bot size={12} /> Brief Dusk
          </button>

          <div className="flex-1" />

          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 rounded border border-[var(--app-border)] px-3 py-1.5 text-[11px] font-medium text-[var(--app-muted)] hover:text-[var(--app-text)] transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
