import React, { useEffect, useState } from 'react';
import { supabase } from '../../src/lib/supabaseClient';

const parseHashTokens = () => {
  const rawHash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
  const params = new URLSearchParams(rawHash);
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  return { access_token, refresh_token };
};

const isPopup = () => {
  try {
    return window.opener !== null && window.opener !== window;
  } catch {
    return false;
  }
};

export const AuthCallbackView: React.FC = () => {
  const [message, setMessage] = useState('Finalizing authentication...');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const finishAuth = async () => {
      const search = new URLSearchParams(window.location.search);
      const code = search.get('code');

      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (!mounted) return;
        if (exchangeError) {
          setError(exchangeError.message);
          setMessage('Could not complete authentication.');
          return;
        }
        setMessage('Authentication complete.');
        // If opened as popup, close and let parent window pick up the session
        if (isPopup()) {
          window.close();
          return;
        }
        window.setTimeout(() => window.location.replace('/'), 500);
        return;
      }

      const { access_token, refresh_token } = parseHashTokens();
      if (access_token && refresh_token) {
        const { error: setSessionError } = await supabase.auth.setSession({ access_token, refresh_token });
        if (!mounted) return;
        if (setSessionError) {
          setError(setSessionError.message);
          setMessage('Could not complete authentication.');
          return;
        }
        setMessage('Authentication complete.');
        if (isPopup()) {
          window.close();
          return;
        }
        window.setTimeout(() => window.location.replace('/'), 500);
        return;
      }

      setMessage('No auth payload found. Redirecting...');
      if (isPopup()) {
        window.close();
        return;
      }
      window.setTimeout(() => window.location.replace('/'), 500);
    };

    void finishAuth();
    return () => { mounted = false; };
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--ui-bg)] px-4 py-8 font-mono text-[var(--ui-text)]">
      <div
        className="ui-panel-surface chamfer-card w-full max-w-lg border border-[var(--ui-border)] bg-[var(--ui-panel)] p-6"
        style={{ '--cut': 'var(--ui-cut-md)' } as React.CSSProperties}
      >
        <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--ui-text)]">Auth Callback</div>
        <div className="mt-3 text-[10px] uppercase tracking-[0.18em] text-[var(--ui-muted)]">{message}</div>
        {error ? <div className="mt-3 text-[10px] uppercase tracking-[0.18em] text-[#ff6b7a]">{error}</div> : null}
      </div>
    </div>
  );
};
