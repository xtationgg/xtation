import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Bot,
  CheckCircle2,
  Clock3,
  Flame,
  Trophy,
  X,
  Zap,
} from 'lucide-react';
import { useXP } from '../XP/xpStore';
import type { SelfTreeBranch } from '../XP/xpTypes';
import { getQuestStepCounts, parseQuestNotesAndSteps } from '../../src/lib/quests/steps';
import { useLab } from '../../src/lab/LabProvider';
import { openDuskBrief } from '../../src/dusk/bridge';
import { useOptionalPresentationEvents } from '../../src/presentation/PresentationEventsProvider';

const BRANCH_META: Record<SelfTreeBranch, { color: string; icon: string }> = {
  Knowledge: { color: '#60a5fa', icon: '📘' },
  Creation: { color: '#c084fc', icon: '🎨' },
  Systems: { color: '#34d399', icon: '⚙️' },
  Communication: { color: '#fb923c', icon: '💬' },
  Physical: { color: '#f87171', icon: '💪' },
  Inner: { color: '#facc15', icon: '🧘' },
};

const REFLECTION_PROMPTS = [
  'What felt hardest? What clicked?',
  'One thing you learned or noticed?',
  'How does this connect to your bigger picture?',
  'What would you do differently next time?',
  'What energy level did this need?',
];

const pickReflectionPrompt = (taskId: string) => {
  let hash = 0;
  for (let i = 0; i < taskId.length; i++) hash = ((hash << 5) - hash + taskId.charCodeAt(i)) | 0;
  return REFLECTION_PROMPTS[Math.abs(hash) % REFLECTION_PROMPTS.length];
};

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
  const momentum = selectors.getMomentum();
  const completedToday = selectors.getCompletedCountForDay();
  const [reflectionText, setReflectionText] = useState('');
  const [savedToLab, setSavedToLab] = useState(false);
  const [phase, setPhase] = useState<'reveal' | 'detail'>('reveal');
  const presentationEvents = useOptionalPresentationEvents();

  const stepCounts = useMemo(
    () => (task ? getQuestStepCounts(task.details) ?? { completed: 0, total: 0 } : { completed: 0, total: 0 }),
    [task],
  );

  const sessionMinutes = useMemo(() => {
    if (!task?.completedAt || !task?.startedAt) return 0;
    return Math.max(0, Math.floor((task.completedAt - task.startedAt) / 60000));
  }, [task]);

  const branchMeta = task?.selfTreePrimary ? BRANCH_META[task.selfTreePrimary] : null;
  const reflectionPlaceholder = pickReflectionPrompt(taskId);

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
    // Auto-advance to detail after the dramatic reveal moment
    const timer = setTimeout(() => setPhase('detail'), 3600);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fire once on mount
  }, [taskId]);

  const handleSaveToLab = useCallback(() => {
    if (!task || savedToLab) return;
    const parsed = parseQuestNotesAndSteps(task.details);
    const lines: string[] = [];
    lines.push(`Quest completed: ${task.title}`);
    if (task.selfTreePrimary) lines.push(`Branch: ${task.selfTreePrimary}`);
    if (sessionMinutes > 0) lines.push(`Duration: ${sessionMinutes}m`);
    if (stepCounts.total > 0)
      lines.push(`Steps: ${stepCounts.completed}/${stepCounts.total}`);
    if (xpBreakdown) lines.push(`XP earned: ${xpBreakdown.total}`);
    if (momentum.currentStreak > 0) lines.push(`Streak: ${momentum.currentStreak} days`);
    if (parsed.notes) lines.push(`\nNotes:\n${parsed.notes}`);
    if (reflectionText.trim()) lines.push(`\nReflection:\n${reflectionText.trim()}`);

    const tags = ['debrief', 'quest-completion'];
    if (task.selfTreePrimary) tags.push(task.selfTreePrimary.toLowerCase());

    lab.addNote({
      title: `Debrief: ${task.title}`,
      content: lines.join('\n'),
      kind: 'brief',
      tags,
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
      className="xt-debrief-takeover"
      role="dialog"
      aria-modal="true"
      aria-label={`Quest debrief: ${task.title}`}
    >
      {/* Phase 1: Dramatic reveal */}
      <div className={`xt-debrief-reveal ${phase === 'detail' ? 'xt-debrief-reveal--exit' : ''}`}>
        <div className="xt-debrief-reveal-content">
          <div className="xt-debrief-reveal-kicker">Quest Complete</div>
          <h1 className="xt-debrief-reveal-title">{task.title}</h1>
          {branchMeta ? (
            <div className="xt-debrief-reveal-branch" style={{ color: branchMeta.color }}>
              <span>{branchMeta.icon}</span> {task.selfTreePrimary}
            </div>
          ) : null}
          {xpTotal > 0 ? (
            <div className="xt-debrief-reveal-xp">+{xpTotal} XP</div>
          ) : null}
        </div>
        {phase === 'reveal' ? (
          <button
            type="button"
            className="xt-debrief-reveal-continue"
            onClick={() => setPhase('detail')}
          >
            Continue
          </button>
        ) : null}
      </div>

      {/* Phase 2: Detail panel */}
      <div className={`xt-debrief-detail ${phase === 'detail' ? 'xt-debrief-detail--enter' : ''}`}>
        <div className="xt-debrief-detail-inner">
          {/* Header */}
          <div className="xt-debrief-detail-header">
            <div>
              <div className="xt-debrief-detail-kicker">
                <Trophy size={13} />
                Debrief
              </div>
              <h2 className="xt-debrief-detail-title">{task.title}</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="xt-debrief-detail-close"
              aria-label="Close debrief"
            >
              <X size={14} />
            </button>
          </div>

          {/* Stats chips */}
          <div className="xt-debrief-chips">
            {xpTotal > 0 ? (
              <span className="xt-debrief-chip xt-debrief-chip--accent">
                <Zap size={10} /> +{xpTotal} XP
              </span>
            ) : null}
            {sessionMinutes > 0 ? (
              <span className="xt-debrief-chip">
                <Clock3 size={10} /> {sessionMinutes}m
              </span>
            ) : null}
            {stepCounts.total > 0 ? (
              <span className="xt-debrief-chip">
                <CheckCircle2 size={10} /> {stepCounts.completed}/{stepCounts.total} steps
              </span>
            ) : null}
            {branchMeta && task.selfTreePrimary ? (
              <span
                className="xt-debrief-chip"
                style={{ borderColor: branchMeta.color, color: branchMeta.color }}
              >
                {branchMeta.icon} {task.selfTreePrimary}
              </span>
            ) : null}
            {momentum.currentStreak > 0 ? (
              <span className="xt-debrief-chip xt-debrief-chip--streak">
                <Flame size={10} /> {momentum.currentStreak}d streak
                {momentum.streakMultiplier > 1 ? ` · x${momentum.streakMultiplier.toFixed(1)}` : ''}
              </span>
            ) : null}
          </div>

          {/* Today's context */}
          {completedToday > 1 ? (
            <div className="xt-debrief-insight">
              {completedToday === 2 ? '2nd' : completedToday === 3 ? '3rd' : `${completedToday}th`} quest completed today
            </div>
          ) : null}

          {/* XP Breakdown */}
          {xpBreakdown && xpTotal > 0 ? (
            <div className="xt-debrief-section">
              <div className="xt-debrief-section-label">XP Breakdown</div>
              <div className="xt-debrief-breakdown-grid">
                {xpBreakdown.completionBonus > 0 ? (
                  <div className="xt-debrief-breakdown-row">
                    <span>Completion</span>
                    <span className="xt-debrief-breakdown-val">+{xpBreakdown.completionBonus}</span>
                  </div>
                ) : null}
                {xpBreakdown.sessionXP > 0 ? (
                  <div className="xt-debrief-breakdown-row">
                    <span>Session</span>
                    <span className="xt-debrief-breakdown-val">+{xpBreakdown.sessionXP}</span>
                  </div>
                ) : null}
                {xpBreakdown.stepXP > 0 ? (
                  <div className="xt-debrief-breakdown-row">
                    <span>Steps</span>
                    <span className="xt-debrief-breakdown-val">+{xpBreakdown.stepXP}</span>
                  </div>
                ) : null}
                {xpBreakdown.deepBonus > 0 ? (
                  <div className="xt-debrief-breakdown-row">
                    <span>Deep focus</span>
                    <span className="xt-debrief-breakdown-val">+{xpBreakdown.deepBonus}</span>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {/* Reflection */}
          <div className="xt-debrief-section">
            <div className="xt-debrief-section-label">
              Reflection <span className="xt-debrief-section-optional">(optional)</span>
            </div>
            <textarea
              value={reflectionText}
              onChange={(e) => setReflectionText(e.target.value)}
              placeholder={reflectionPlaceholder}
              rows={3}
              className="xt-debrief-textarea"
            />
          </div>

          {/* Footer */}
          <div className="xt-debrief-footer">
            <button
              type="button"
              onClick={handleSaveToLab}
              disabled={savedToLab}
              className={`xt-debrief-btn ${savedToLab ? 'xt-debrief-btn--saved' : ''}`}
            >
              {savedToLab ? <CheckCircle2 size={12} /> : <BookOpen size={12} />}
              {savedToLab ? 'Saved' : 'Save to Lab'}
            </button>
            <button type="button" onClick={handleBriefDusk} className="xt-debrief-btn">
              <Bot size={12} /> Brief Dusk
            </button>
            <div className="flex-1" />
            <button type="button" onClick={onClose} className="xt-debrief-btn xt-debrief-btn--primary">
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
