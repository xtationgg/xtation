import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';

export interface AuthUserLite {
  id: string;
  email: string | null;
  avatar: string | null;
  name: string | null;
}

interface AuthContextValue {
  session: Session | null;
  user: AuthUserLite | null;
  loading: boolean;
  error: string | null;
  signInWithGoogle: () => Promise<void>;
  signUpWithEmailPassword: (email: string, password: string) => Promise<boolean>;
  signInWithEmailPassword: (email: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const toUserLite = (user: User | null): AuthUserLite | null => {
  if (!user) return null;
  const metadata = (user.user_metadata || {}) as Record<string, unknown>;
  const name =
    (typeof metadata.full_name === 'string' && metadata.full_name) ||
    (typeof metadata.name === 'string' && metadata.name) ||
    null;
  const avatar =
    (typeof metadata.avatar_url === 'string' && metadata.avatar_url) ||
    (typeof metadata.picture === 'string' && metadata.picture) ||
    null;
  return {
    id: user.id,
    email: user.email ?? null,
    avatar,
    name,
  };
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isMountedRef = useRef(true);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<AuthUserLite | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    isMountedRef.current = true;

    // Initial session fetch handles refresh/reload after OAuth redirect.
    supabase.auth
      .getSession()
      .then(({ data, error: sessionError }) => {
        if (!isMountedRef.current) return;
        if (sessionError) {
          setError(sessionError.message);
        } else {
          setError(null);
        }
        setSession(data.session ?? null);
        setUser(toUserLite(data.session?.user ?? null));
        setLoading(false);
      })
      .catch((caughtError) => {
        if (!isMountedRef.current) return;
        setError(caughtError instanceof Error ? caughtError.message : 'Failed to load session');
        setLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!isMountedRef.current) return;
      setSession(nextSession ?? null);
      setUser(toUserLite(nextSession?.user ?? null));
      setLoading(false);
      setError(null);
    });

    return () => {
      isMountedRef.current = false;
      subscription.unsubscribe();
    };
  }, []);

  const signInWithGoogle = async () => {
    setError(null);
    const redirectTo = window.location.origin;
    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });
    if (signInError) {
      setError(signInError.message);
      console.error('[auth] Google login failed:', signInError.message);
    }
  };

  const signUpWithEmailPassword = async (email: string, password: string): Promise<boolean> => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      setError('Email and password are required');
      return false;
    }
    setError(null);
    const { error: signUpError } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
    });
    if (signUpError) {
      setError(signUpError.message);
      console.error('[auth] Sign up failed:', signUpError.message);
      return false;
    }
    return true;
  };

  const signInWithEmailPassword = async (email: string, password: string): Promise<boolean> => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      setError('Email and password are required');
      return false;
    }
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });
    if (signInError) {
      setError(signInError.message);
      console.error('[auth] Email/password login failed:', signInError.message);
      return false;
    }
    return true;
  };

  const signOut = async () => {
    setError(null);
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      setError(signOutError.message);
      console.error('[auth] Logout failed:', signOutError.message);
    }
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user,
      loading,
      error,
      signInWithGoogle,
      signUpWithEmailPassword,
      signInWithEmailPassword,
      signOut,
    }),
    [session, user, loading, error]
  );

  // Extension point:
  // This provider can later include additional identity providers
  // (Apple, Discord, etc.) for web/mobile/desktop with the same state shape.
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
