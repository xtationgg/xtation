import React, { useState } from 'react';
import { supabase } from '../../src/lib/supabaseClient';

export const ResetPassword: React.FC = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (isSubmitting) return;
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
      setNotice(`Reset failed: ${error.message}`);
      return;
    }

    setNotice('Password updated. Redirecting to home...');
    window.setTimeout(() => {
      window.location.assign(window.location.origin);
    }, 1200);
  };

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-[var(--ui-bg)] px-4 font-mono text-[var(--ui-text)]">
      <div className="ui-panel-surface chamfer-card w-full max-w-md border border-[var(--ui-border)] bg-[var(--ui-panel)] p-6">
        <div className="mb-1 text-[11px] uppercase tracking-[0.26em] text-[var(--ui-text)]">Reset Password</div>
        <div className="mb-5 text-[10px] uppercase tracking-[0.18em] text-[var(--ui-muted)]">
          Set a new password for your account
        </div>

        <label className="mb-2 block text-[10px] uppercase tracking-[0.2em] text-[var(--ui-muted)]">New Password</label>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mb-3 h-10 w-full border border-[var(--ui-border)] bg-[var(--ui-panel-2)] px-3 text-sm text-[var(--ui-text)] outline-none focus:border-[var(--ui-accent)]"
          placeholder="••••••••"
        />

        <label className="mb-2 block text-[10px] uppercase tracking-[0.2em] text-[var(--ui-muted)]">Confirm Password</label>
        <input
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          className="mb-4 h-10 w-full border border-[var(--ui-border)] bg-[var(--ui-panel-2)] px-3 text-sm text-[var(--ui-text)] outline-none focus:border-[var(--ui-accent)]"
          placeholder="••••••••"
        />

        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={isSubmitting}
          className="ui-pressable h-10 w-full border border-[var(--ui-accent)] bg-[rgba(143,99,255,0.2)] text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--ui-text)] hover:bg-[rgba(143,99,255,0.28)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? 'Updating...' : 'Update Password'}
        </button>

        {notice ? <div className="mt-3 text-[10px] uppercase tracking-[0.18em] text-[var(--ui-muted)]">{notice}</div> : null}
      </div>
    </div>
  );
};

