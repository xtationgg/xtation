import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../src/lib/supabaseClient';

const hasRecoveryHint = () => {
  const href = window.location.href;
  return href.includes('type=recovery') || href.includes('access_token=') || href.includes('refresh_token=');
};

export const ResetPasswordView: React.FC = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);

  const canSubmit = useMemo(
    () => hasRecoverySession && password.length >= 6 && password === confirmPassword && !isSubmitting,
    [hasRecoverySession, password, confirmPassword, isSubmitting]
  );

  useEffect(() => {
    let mounted = true;

    const checkRecovery = async () => {
      const recoveryHint = hasRecoveryHint();
      const { data, error } = await supabase.auth.getSession();
      if (!mounted) return;

      if (!error && data.session) {
        setHasRecoverySession(true);
        setNotice(null);
        setIsChecking(false);
        return;
      }

      if (!recoveryHint) {
        setHasRecoverySession(false);
        setNotice('Invalid or expired reset link. Request a new one from LOGIN.');
        setIsChecking(false);
        return;
      }

      // detectSessionInUrl may complete asynchronously; retry once.
      window.setTimeout(async () => {
        const { data: retryData } = await supabase.auth.getSession();
        if (!mounted) return;
        if (retryData.session) {
          setHasRecoverySession(true);
          setNotice(null);
        } else {
          setHasRecoverySession(false);
          setNotice('Recovery session not found. Request a new reset email.');
        }
        setIsChecking(false);
      }, 450);
    };

    void checkRecovery();
    return () => {
      mounted = false;
    };
  }, []);

  const handleSave = async () => {
    if (isSubmitting) return;
    if (!hasRecoverySession) {
      setNotice('Recovery session not found. Request a new reset email.');
      return;
    }
    if (!password || !confirmPassword) {
      setNotice('Enter and confirm your new password.');
      return;
    }
    if (password.length < 6) {
      setNotice('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setNotice('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    setNotice(null);
    const { error } = await supabase.auth.updateUser({ password });
    setIsSubmitting(false);

    if (error) {
      setNotice(`Password update failed: ${error.message}`);
      return;
    }

    setNotice('Password updated. Redirecting...');
    window.setTimeout(() => {
      window.location.hash = '#/';
    }, 1100);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--ui-bg)] px-4 py-8 font-mono text-[var(--ui-text)]">
      <div
        className="ui-panel-surface chamfer-card w-full max-w-md border border-[var(--ui-border)] bg-[var(--ui-panel)] p-6"
        style={{ '--cut': 'var(--ui-cut-md)' } as React.CSSProperties}
      >
        <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--ui-text)]">Reset Password</div>
        <div className="mt-1 mb-5 text-[10px] uppercase tracking-[0.18em] text-[var(--ui-muted)]">
          Set a new password for your account
        </div>

        <label className="mb-2 block text-[10px] uppercase tracking-[0.2em] text-[var(--ui-muted)]">New Password</label>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="••••••••"
          className="mb-3 h-10 w-full border border-[var(--ui-border)] bg-[var(--ui-panel-2)] px-3 text-sm text-[var(--ui-text)] outline-none focus:border-[var(--ui-accent)]"
          disabled={isChecking}
        />

        <label className="mb-2 block text-[10px] uppercase tracking-[0.2em] text-[var(--ui-muted)]">Confirm Password</label>
        <input
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          placeholder="••••••••"
          className="mb-4 h-10 w-full border border-[var(--ui-border)] bg-[var(--ui-panel-2)] px-3 text-sm text-[var(--ui-text)] outline-none focus:border-[var(--ui-accent)]"
          disabled={isChecking}
        />

        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={!canSubmit || isChecking}
          className="ui-pressable h-10 w-full border border-[var(--ui-accent)] bg-[rgba(143,99,255,0.2)] text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--ui-text)] hover:bg-[rgba(143,99,255,0.28)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isChecking ? 'Checking Recovery...' : isSubmitting ? 'Saving...' : 'Save Password'}
        </button>

        {notice ? <div className="mt-3 text-[10px] uppercase tracking-[0.18em] text-[var(--ui-muted)]">{notice}</div> : null}
      </div>
    </div>
  );
};

