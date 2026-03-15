import React, { useState, useEffect } from 'react';
import { Pause, Play, CheckCircle2, X } from 'lucide-react';
import { MonoTimer } from './shared/MonoTimer';
import type { Task } from '../XP/xpTypes';
import './focus-overlay.css';

interface FocusOverlayProps {
  quest: Task;
  sessionRunning: boolean;
  sessionPaused: boolean;
  elapsedSeconds: number;
  steps: Array<{ text: string; done: boolean }>;
  backgroundUrl?: string | null;
  onStartSession: () => void;
  onPauseSession: () => void;
  onResumeSession: () => void;
  onCompleteQuest: () => void;
  onToggleStep: (index: number) => void;
  onExit: () => void;
}

export const FocusOverlay: React.FC<FocusOverlayProps> = ({
  quest, sessionRunning, sessionPaused, elapsedSeconds,
  steps, backgroundUrl, onStartSession, onPauseSession,
  onResumeSession, onCompleteQuest, onToggleStep, onExit,
}) => {
  const [showNotes, setShowNotes] = useState(false);

  // Determine focus state
  const focusState = sessionRunning
    ? (sessionPaused ? 'paused' : 'active')
    : 'idle';

  // Keyboard shortcuts
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'Escape') onExit();
      if (e.key === ' ') {
        e.preventDefault();
        if (!sessionRunning) onStartSession();
        else if (sessionPaused) onResumeSession();
        else onPauseSession();
      }
      if (e.key === 'Enter' && steps.length > 0) {
        const nextIdx = steps.findIndex(s => !s.done);
        if (nextIdx !== -1) onToggleStep(nextIdx);
      }
      if (e.key === 'n' || e.key === 'N') setShowNotes(prev => !prev);
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [sessionRunning, sessionPaused, steps, onStartSession, onPauseSession, onResumeSession, onToggleStep, onExit]);

  const stepsTotal = steps.length;
  const stepsDone = steps.filter(s => s.done).length;

  return (
    <div className={`focus-overlay focus--${focusState}`}>
      {/* Background */}
      <div className="focus-background">
        {backgroundUrl ? (
          <div className="focus-background__image" style={{
            backgroundImage: backgroundUrl.startsWith('linear-gradient') || backgroundUrl.startsWith('radial-gradient')
              ? backgroundUrl : `url(${backgroundUrl})`,
          }} />
        ) : null}
        <div className="focus-background__overlay" />
      </div>

      {/* HUD Content */}
      <div className="focus-hud">
        {/* Exit button — top left */}
        <button className="focus-exit" onClick={onExit} title="Exit Focus (Escape)">
          <X size={18} />
        </button>

        {/* Timer — top right */}
        {(sessionRunning || elapsedSeconds > 0) ? (
          <div className="focus-timer-area">
            <MonoTimer seconds={elapsedSeconds} size="lg" className="focus-timer" />
            <div className="focus-timer-status">
              {sessionPaused ? 'PAUSED' : sessionRunning ? 'SESSION ACTIVE' : 'TRACKED'}
            </div>
          </div>
        ) : null}

        {/* Quest info — center */}
        <div className="focus-center">
          <h1 className="focus-quest-title">{quest.title}</h1>
          <div className="focus-quest-meta">
            {quest.questType || 'session'} · {quest.priority} · L{quest.level || 1}
            {quest.selfTreePrimary ? ` · ${quest.selfTreePrimary}` : ''}
          </div>

          {/* Action buttons */}
          <div className="focus-actions">
            {!sessionRunning ? (
              <button className="focus-action focus-action--primary" onClick={onStartSession}>
                <Play size={16} /> Start Session
              </button>
            ) : sessionPaused ? (
              <button className="focus-action focus-action--primary" onClick={onResumeSession}>
                <Play size={16} /> Resume
              </button>
            ) : (
              <button className="focus-action" onClick={onPauseSession}>
                <Pause size={16} /> Pause
              </button>
            )}
            <button className="focus-action focus-action--success" onClick={onCompleteQuest}>
              <CheckCircle2 size={16} /> Complete
            </button>
          </div>
        </div>

        {/* Steps — bottom left */}
        {steps.length > 0 ? (
          <div className="focus-steps">
            <div className="focus-steps-header">
              Steps {stepsDone}/{stepsTotal}
            </div>
            {steps.map((step, idx) => (
              <div
                key={idx}
                className={`focus-step ${step.done ? 'focus-step--done' : ''}`}
                onClick={() => onToggleStep(idx)}
              >
                <span className="focus-step-check">{step.done ? '✓' : ''}</span>
                <span className="focus-step-text">{step.text}</span>
              </div>
            ))}
          </div>
        ) : null}

        {/* Brief — if quest has details */}
        {quest.details && !showNotes ? (
          <div className="focus-brief">
            <span className="focus-brief-label">Brief</span>
            <p className="focus-brief-text">{quest.details}</p>
          </div>
        ) : null}

        {/* Bottom stats */}
        <div className="focus-bottom-stats">
          <span>{Math.floor(elapsedSeconds / 60)} min today</span>
          <span>·</span>
          <span>{stepsDone}/{stepsTotal} steps</span>
        </div>
      </div>
    </div>
  );
};
