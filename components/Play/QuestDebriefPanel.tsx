import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Bot,
  CheckCircle2,
  Clock3,
  Trophy,
  X,
  Zap,
} from 'lucide-react';
import { useXP } from '../XP/xpStore';
import { getQuestStepCounts, parseQuestNotesAndSteps } from '../../src/lib/quests/steps';
import { useLab } from '../../src/lab/LabProvider';
import { openDuskBrief } from '../../src/dusk/bridge';
import { useOptionalPresentationEvents } from '../../src/presentation/PresentationEventsProvider';

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
  const presentationEvents = useOptionalPresentationEvents();

  const stepCounts = useMemo(
    () => (task ? getQuestStepCounts(task.details) : { completed: 0, total: 0 }),
    [task],
  );

  const burstNodes = useMemo(
    () =>
      Array.from({ length: 10 }, (_, index) => ({
        id: `burst-${index}`,
        style: {
          '--xt-burst-angle': `${index * 34}deg`,
          '--xt-burst-delay': `${index * 40}ms`,
          '--xt-burst-distance': `${68 + (index % 3) * 10}px`,
        } as React.CSSProperties,
      })),
    []
  );

  const sessionMinutes = useMemo(() => {
    if (!task?.completedAt || !task?.startedAt) return 0;
    return Math.max(0, Math.floor((task.completedAt - task.startedAt) / 60000));
  }, [task]);

  useEffect(() => {
    if (!task) return;
    presentationEvents?.emitEvent('quest.debrief.opened', {
      source: 'user',
      metadata: {
        taskId: task.id,
        title: task.title,
        xpTotal: xpBreakdown?.total ?? 0,
      },
    });
    presentationEvents?.emitEvent('quest.reward.burst', {
      source: 'user',
      metadata: {
        taskId: task.id,
        title: task.title,
        tone: 'success',
      },
    });
  }, [presentationEvents, task, xpBreakdown?.total]);

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
      className="xt-play-debrief-shell fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Quest debrief: ${task.title}`}
    >
      <div className="xt-play-debrief-backdrop absolute inset-0" />

      <div
        className="xt-play-debrief-panel animate-fade-in relative z-10 flex w-full max-w-xl flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="xt-play-debrief-burst" aria-hidden="true">
          {burstNodes.map((node) => (
            <span key={node.id} className="xt-play-debrief-burst__particle" style={node.style} />
          ))}
        </div>

        <div className="xt-play-debrief-header shrink-0">
          <div className="mb-2 flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="xt-play-debrief-trophy flex h-8 w-8 items-center justify-center rounded">
                <Trophy size={16} className="text-emerald-400" />
              </div>
              <div>
                <div className="xt-play-debrief-kicker">
                  Quest Complete
                </div>
                <h2 className="xt-play-debrief-title">
                  {task.title}
                </h2>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="xt-play-debrief-close shrink-0 inline-flex h-7 w-7 items-center justify-center rounded"
              aria-label="Close debrief"
            >
              <X size={14} />
            </button>
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-2">
            {xpTotal > 0 ? (
              <span className="xt-play-debrief-chip xt-play-debrief-chip--accent inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold tracking-[0.08em]">
                <Zap size={10} /> +{xpTotal} XP
              </span>
            ) : null}
            {sessionMinutes > 0 ? (
              <span className="xt-play-debrief-chip inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium">
                <Clock3 size={10} /> {sessionMinutes}m
              </span>
            ) : null}
            {stepCounts.total > 0 ? (
              <span className="xt-play-debrief-chip inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium">
                <CheckCircle2 size={10} /> {stepCounts.completed}/{stepCounts.total} steps
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {xpBreakdown && xpTotal > 0 ? (
            <div>
              <div className="xt-play-debrief-section-label mb-2">
                XP Breakdown
              </div>
              <div className="grid grid-cols-2 gap-2">
                {xpBreakdown.sessionXP > 0 ? (
                  <div className="xt-play-debrief-breakdown rounded px-2.5 py-1.5 text-[11px] text-[var(--app-text)]">
                    Session <span className="float-right font-semibold">+{xpBreakdown.sessionXP}</span>
                  </div>
                ) : null}
                {xpBreakdown.completionBonus > 0 ? (
                  <div className="xt-play-debrief-breakdown rounded px-2.5 py-1.5 text-[11px] text-[var(--app-text)]">
                    Completion <span className="float-right font-semibold">+{xpBreakdown.completionBonus}</span>
                  </div>
                ) : null}
                {xpBreakdown.deepBonus > 0 ? (
                  <div className="xt-play-debrief-breakdown rounded px-2.5 py-1.5 text-[11px] text-[var(--app-text)]">
                    Deep focus <span className="float-right font-semibold">+{xpBreakdown.deepBonus}</span>
                  </div>
                ) : null}
                {xpBreakdown.stepXP > 0 ? (
                  <div className="xt-play-debrief-breakdown rounded px-2.5 py-1.5 text-[11px] text-[var(--app-text)]">
                    Steps <span className="float-right font-semibold">+{xpBreakdown.stepXP}</span>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          <div>
            <div className="xt-play-debrief-section-label mb-2">
              Reflection <span className="normal-case tracking-normal font-normal">(optional)</span>
            </div>
            <textarea
              value={reflectionText}
              onChange={(e) => setReflectionText(e.target.value)}
              placeholder="What went well? What's next?"
              rows={3}
              className="xt-play-debrief-textarea w-full resize-none rounded px-3 py-2.5 text-[12px]"
            />
          </div>
        </div>

        <div className="xt-play-debrief-footer shrink-0 flex items-center gap-2">
          <button
            type="button"
            onClick={handleSaveToLab}
            disabled={savedToLab}
            className="xt-play-debrief-action xt-play-debrief-action--lab inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-[11px] font-semibold transition-colors border"
            data-saved={savedToLab ? 'true' : 'false'}
          >
            {savedToLab ? <CheckCircle2 size={12} /> : <BookOpen size={12} />}
            {savedToLab ? 'Saved to Lab' : 'Save to Lab'}
          </button>

          <button
            type="button"
            onClick={handleBriefDusk}
            className="xt-play-debrief-action inline-flex items-center gap-1.5 rounded border px-3 py-1.5 text-[11px] font-semibold transition-colors"
          >
            <Bot size={12} /> Brief Dusk
          </button>

          <div className="flex-1" />

          <button
            type="button"
            onClick={onClose}
            className="xt-play-debrief-action xt-play-debrief-action--muted inline-flex items-center gap-1.5 rounded border px-3 py-1.5 text-[11px] font-medium transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
