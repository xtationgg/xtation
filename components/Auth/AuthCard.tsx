import React, { useState } from 'react';
import { EyeOrb } from '../UI/EyeOrb';
import { playClickSound, playHoverSound } from '../../utils/SoundEffects';
import { useAuth } from '../../src/auth/AuthProvider';
import { writeAuthTransitionSignal } from '../../src/auth/authTransitionSignal';
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
  onSuccess,
}) => {
  const { error, signInWithGoogle, signUpWithPassword, signInWithPassword, requestPasswordReset } = useAuth();
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);

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

  return (
    <div className="xt-auth-clean">
      <form
        className="xt-auth-clean-form"
        onSubmit={(event) => {
          event.preventDefault();
          void handlePrimaryAuthSubmit();
        }}
      >
        {showOrb ? (
          <div className="xt-auth-clean-orb">
            <EyeOrb
              onClick={() => {}}
              ariaLabel="Decorative orb"
              className="pointer-events-none cursor-default p-0 h-[100px] w-[100px]"
            />
          </div>
        ) : null}

        <div className="xt-auth-clean-header">
          {eyebrow ? <div className="xt-auth-clean-eyebrow">{eyebrow}</div> : null}
          <div className="xt-auth-clean-title">{title}</div>
          {description ? <div className="xt-auth-clean-desc">{description}</div> : null}
        </div>

        {/* Mode toggle */}
        <div className="xt-auth-clean-modes">
          <button
            type="button"
            onMouseEnter={playHoverSound}
            onClick={() => { playClickSound(); setAuthMode('login'); setAuthNotice(null); }}
            className={`xt-auth-clean-mode ${authMode === 'login' ? 'xt-auth-clean-mode--active' : ''}`}
          >
            Login
          </button>
          <button
            type="button"
            onMouseEnter={playHoverSound}
            onClick={() => { playClickSound(); setAuthMode('signup'); setAuthNotice(null); }}
            className={`xt-auth-clean-mode ${authMode === 'signup' ? 'xt-auth-clean-mode--active' : ''}`}
          >
            Sign Up
          </button>
        </div>

        {/* Inputs */}
        <div className="xt-auth-clean-inputs">
          <input
            type="email"
            value={authEmail}
            onChange={(event) => setAuthEmail(event.target.value)}
            placeholder="Email"
            data-auth-initial-focus="true"
            className="xt-auth-clean-input"
            autoFocus
          />
          <input
            type="password"
            value={authPassword}
            onChange={(event) => setAuthPassword(event.target.value)}
            placeholder="Password"
            className="xt-auth-clean-input"
          />
          {authMode === 'login' ? (
            <button
              type="button"
              onMouseEnter={playHoverSound}
              onClick={() => void handleSendResetLink()}
              disabled={isAuthSubmitting}
              className="xt-auth-clean-forgot"
            >
              Forgot password?
            </button>
          ) : null}
        </div>

        {/* Notice */}
        {(authNotice || error) ? (
          <div className="xt-auth-clean-notice">{authNotice || error}</div>
        ) : null}

        {/* Submit buttons */}
        <div className="xt-auth-clean-actions">
          <button
            type="submit"
            disabled={isAuthSubmitting}
            onMouseEnter={playHoverSound}
            className="xt-auth-clean-submit ui-pressable"
          >
            {authMode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
          <button
            type="button"
            onClick={() => void handleGoogleSignIn()}
            disabled={isAuthSubmitting}
            onMouseEnter={playHoverSound}
            className="xt-auth-clean-google ui-pressable"
          >
            Continue with Google
          </button>
        </div>
      </form>
    </div>
  );
};
