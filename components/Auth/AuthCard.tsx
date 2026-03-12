import React, { useState } from 'react';
import { EyeOrb } from '../UI/EyeOrb';
import { playClickSound, playHoverSound } from '../../utils/SoundEffects';
import { useAuth } from '../../src/auth/AuthProvider';
import { writeAuthTransitionSignal } from '../../src/auth/authTransitionSignal';
import { buildAuthTransitionPreviewDescriptor } from '../../src/auth/authTransitionDescriptor';
import type { LocalStationStatus } from '../../src/welcome/localStationStatus';
import type { LocalEntryTransitionDescriptor } from '../../src/welcome/localEntryTransition';

type AuthMode = 'login' | 'signup';

interface AuthCardProps {
  title?: string;
  eyebrow?: string;
  description?: string;
  variant?: 'drawer' | 'landing';
  showOrb?: boolean;
  isGuestMode?: boolean;
  continuityStatus?: LocalStationStatus | null;
  entryDescriptor?: LocalEntryTransitionDescriptor | null;
  showEntryDescriptor?: boolean;
  onSuccess?: (mode: AuthMode) => void;
}

export const AuthCard: React.FC<AuthCardProps> = ({
  title = 'HELLO PLAYER',
  eyebrow,
  description,
  variant = 'drawer',
  showOrb = variant === 'drawer',
  isGuestMode = false,
  continuityStatus = null,
  entryDescriptor = null,
  showEntryDescriptor = true,
  onSuccess,
}) => {
  const { error, signInWithGoogle, signUpWithPassword, signInWithPassword, requestPasswordReset } = useAuth();
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);
  const authTransitionPreview = buildAuthTransitionPreviewDescriptor({
    mode: authMode,
    fromGuestMode: isGuestMode,
    workspaceLabel: continuityStatus?.workspaceLabel ?? 'Play',
    continuityStatus,
  });
  const showTransitionPreview = Boolean(continuityStatus) || isGuestMode;

  const handlePrimaryAuthSubmit = async () => {
    if (isAuthSubmitting) return;
    if (!authEmail.trim() || !authPassword) {
      setAuthNotice('Enter email and password.');
      return;
    }

    setIsAuthSubmitting(true);
    setAuthNotice(null);

    const success =
      authMode === 'login'
        ? await signInWithPassword(authEmail, authPassword)
        : await signUpWithPassword(authEmail, authPassword);

    setIsAuthSubmitting(false);

    if (!success) {
      setAuthNotice(authMode === 'login' ? 'Login failed. Check credentials.' : null);
      return;
    }

    if (authMode === 'login') {
      writeAuthTransitionSignal({
        mode: 'login',
        fromGuestMode: isGuestMode,
      });
      setAuthNotice('Logged in successfully.');
      onSuccess?.('login');
      return;
    }

    writeAuthTransitionSignal({
      mode: 'signup',
      fromGuestMode: isGuestMode,
    });
    setAuthNotice('Account created. Check email if confirmation is enabled.');
    setAuthMode('login');
    onSuccess?.('signup');
  };

  const handleSendResetLink = async () => {
    if (isAuthSubmitting) return;
    const targetEmail = authEmail.trim();
    if (!targetEmail) {
      setAuthNotice('Enter your email to receive a reset link.');
      return;
    }

    setIsAuthSubmitting(true);
    setAuthNotice(null);
    const success = await requestPasswordReset(targetEmail);
    setIsAuthSubmitting(false);

    if (success) {
      setAuthNotice('Reset email sent. Check your inbox.');
    }
  };

  const handleGoogleSignIn = async () => {
    if (isAuthSubmitting) return;
    setIsAuthSubmitting(true);
    setAuthNotice(null);
    writeAuthTransitionSignal({
      mode: 'oauth',
      fromGuestMode: isGuestMode,
    });
    await signInWithGoogle();
    setIsAuthSubmitting(false);
  };

  const shellClassName =
    variant === 'landing'
      ? 'xt-auth-shell'
      : 'rounded-[12px] bg-[#1f162d]';

  const buttonClassName =
    variant === 'landing'
      ? 'h-11 text-[11px]'
      : 'h-9 rounded-[8px] text-[11px]';
  const continuityGuardrails = [
    'No local station is overwritten without a handoff review.',
    'You can keep the account station, import local work, or return to local mode.',
    'XTATION confirms the active workspace after sign-in before you continue.',
  ];

  return (
    <div className={`relative overflow-hidden ${shellClassName}`}>
      <form
        className={`relative z-10 flex h-full min-h-0 flex-col ${
          variant === 'landing'
            ? 'max-h-[min(840px,calc(100dvh-180px))] justify-start gap-4 overflow-y-auto px-5 py-5 pr-3 sm:px-6 sm:py-6 sm:pr-4'
            : 'justify-center gap-2.5 px-7 py-6'
        }`}
        onSubmit={(event) => {
          event.preventDefault();
          void handlePrimaryAuthSubmit();
        }}
      >
        {showOrb ? (
          <div className={`flex justify-center ${variant === 'landing' ? 'pb-2 pt-1' : 'pb-8 pt-1'}`}>
            <EyeOrb
              onClick={() => {}}
              ariaLabel="Decorative orb"
              className={`pointer-events-none cursor-default p-0 ${variant === 'landing' ? 'h-[120px] w-[120px]' : 'auth-mini-orb h-[156px] w-[156px]'}`}
            />
          </div>
        ) : null}

        <div className={variant === 'landing' ? 'space-y-2 text-left' : 'text-center'}>
          {eyebrow ? (
            <div className="xt-auth-eyebrow">{eyebrow}</div>
          ) : null}
          <div className={variant === 'landing' ? 'xt-auth-title' : 'text-[12px] font-semibold uppercase tracking-[0.2em] text-[#f8c74c]'}>
            {title}
          </div>
          {description ? (
            <div className={`leading-6 text-[var(--app-muted)] ${variant === 'landing' ? 'xt-auth-description' : 'mx-auto max-w-sm text-[10px] tracking-[0.08em]'}`}>
              {description}
            </div>
          ) : null}
        </div>

        {showTransitionPreview ? (
          <div className="xt-auth-continuity">
            <div className="xt-auth-continuity__eyebrow">After {authTransitionPreview.modeLabel}</div>
            <div className="xt-auth-continuity__title">{authTransitionPreview.title}</div>
            <div className="xt-auth-continuity__detail">{authTransitionPreview.detail}</div>
            <div className="xt-auth-continuity__chips">
              {authTransitionPreview.chips.map((chip) => (
                <span key={chip} className="xt-auth-continuity__chip">
                  {chip}
                </span>
              ))}
            </div>
            {showEntryDescriptor && entryDescriptor ? (
              <div className="xt-auth-continuity__entry">
                <div className="xt-auth-continuity__entry-kicker">Next local resume</div>
                <div className="xt-auth-continuity__entry-title">{entryDescriptor.title}</div>
                <div className="xt-auth-continuity__entry-detail">{entryDescriptor.detail}</div>
                <div className="xt-auth-continuity__chips">
                  <span className="xt-auth-continuity__chip xt-auth-continuity__chip--accent">
                    {entryDescriptor.workspaceLabel}
                  </span>
                  {entryDescriptor.chips.map((chip) => (
                    <span key={`entry-${chip}`} className="xt-auth-continuity__chip">
                      {chip}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
            {isGuestMode ? (
              variant === 'landing' ? (
                <div className="rounded-[8px] border border-[color-mix(in_srgb,var(--app-border)_80%,transparent)] bg-[color-mix(in_srgb,var(--app-panel)_72%,transparent)] px-3 py-2 text-[11px] leading-5 text-[var(--ui-muted)]">
                  Safety checks stay active: no overwrite without review, and workspace confirmation happens before continue.
                </div>
              ) : (
                <div className="xt-auth-continuity__list">
                  {continuityGuardrails.map((line) => (
                    <div key={line} className="xt-auth-continuity__item">
                      {line}
                    </div>
                  ))}
                </div>
              )
            ) : null}
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onMouseEnter={playHoverSound}
            onClick={() => {
              playClickSound();
              setAuthMode('login');
              setAuthNotice(null);
            }}
            className={`xt-auth-mode ui-pressable border font-semibold uppercase tracking-[0.2em] transition-colors ${
              authMode === 'login'
                ? 'border-[var(--ui-accent)] bg-[color-mix(in_srgb,var(--app-accent)_58%,transparent)] text-[var(--ui-text)]'
                : 'border-[color-mix(in_srgb,var(--app-accent)_35%,var(--app-border))] bg-transparent text-[var(--ui-text)]'
            } ${buttonClassName}`}
          >
            Login
          </button>
          <button
            type="button"
            onMouseEnter={playHoverSound}
            onClick={() => {
              playClickSound();
              setAuthMode('signup');
              setAuthNotice(null);
            }}
            className={`xt-auth-mode ui-pressable border font-semibold uppercase tracking-[0.2em] transition-colors ${
              authMode === 'signup'
                ? 'border-[var(--ui-accent)] bg-[color-mix(in_srgb,var(--app-accent)_58%,transparent)] text-[var(--ui-text)]'
                : 'border-[color-mix(in_srgb,var(--app-accent)_35%,var(--app-border))] bg-transparent text-[var(--ui-text)]'
            } ${buttonClassName}`}
          >
            Sign Up
          </button>
        </div>

        <div className="space-y-3">
          <input
            type="email"
            value={authEmail}
            onChange={(event) => setAuthEmail(event.target.value)}
            placeholder="Email"
            data-auth-initial-focus="true"
            className={`xt-auth-input w-full border border-transparent px-4 text-sm text-[var(--ui-text)] outline-none transition-colors focus:border-[var(--ui-accent)] ${buttonClassName}`}
            autoFocus
          />
          <input
            type="password"
            value={authPassword}
            onChange={(event) => setAuthPassword(event.target.value)}
            placeholder="Password"
            className={`xt-auth-input w-full border border-transparent px-4 text-sm text-[var(--ui-text)] outline-none transition-colors focus:border-[var(--ui-accent)] ${buttonClassName}`}
          />
          {authMode === 'login' ? (
            <button
              type="button"
              onMouseEnter={playHoverSound}
              onClick={() => void handleSendResetLink()}
              disabled={isAuthSubmitting}
              className="text-left text-[9px] uppercase tracking-[0.18em] text-[var(--ui-muted)] hover:text-[var(--ui-text)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Forgot password?
            </button>
          ) : null}
        </div>

        {(authNotice || error) ? (
          <div className="min-h-[20px] text-[10px] leading-[1.45] tracking-[0.04em] text-[var(--ui-muted)]">
            {authNotice || error}
          </div>
        ) : (
          <div className="min-h-[20px]" />
        )}

        <div className="flex flex-col gap-3">
          <button
            type="submit"
            disabled={isAuthSubmitting}
            onMouseEnter={playHoverSound}
            className={`xt-auth-primary ui-pressable border border-[var(--ui-accent)] font-semibold uppercase tracking-[0.2em] text-[var(--ui-text)] disabled:cursor-not-allowed disabled:opacity-60 ${buttonClassName}`}
          >
            {authMode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
          <button
            type="button"
            onClick={() => void handleGoogleSignIn()}
            disabled={isAuthSubmitting}
            onMouseEnter={playHoverSound}
            className={`xt-auth-secondary ui-pressable border border-[color-mix(in_srgb,var(--app-accent)_35%,var(--app-border))] bg-transparent font-semibold uppercase tracking-[0.2em] text-[var(--ui-text)] disabled:cursor-not-allowed disabled:opacity-60 ${buttonClassName}`}
          >
            Continue with Google
          </button>
        </div>
      </form>
    </div>
  );
};
