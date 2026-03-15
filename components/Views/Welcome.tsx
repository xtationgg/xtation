import React, { useCallback, useState } from 'react';
import { SignInPage } from '../ui/sign-in';
import { useAuth } from '../../src/auth/AuthProvider';
import { writeAuthTransitionSignal } from '../../src/auth/authTransitionSignal';
import { playClickSound } from '../../utils/SoundEffects';

interface WelcomeProps {
  onEnterLocalMode: () => void;
  onResumeGuidedSetup?: () => void;
}

export const Welcome: React.FC<WelcomeProps> = ({ onEnterLocalMode }) => {
  const { error, signInWithGoogle, signUpWithPassword, signInWithPassword, requestPasswordReset } = useAuth();
  const [notice, setNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSignIn = useCallback(async (email: string, password: string) => {
    if (isSubmitting || !email.trim() || !password) {
      setNotice('Enter email and password.');
      return;
    }
    setIsSubmitting(true);
    setNotice(null);
    const success = await signInWithPassword(email, password);
    setIsSubmitting(false);
    if (!success) {
      setNotice('Login failed. Check credentials.');
      return;
    }
    writeAuthTransitionSignal({ mode: 'login', fromGuestMode: false });
    setNotice('Logged in successfully.');
  }, [isSubmitting, signInWithPassword]);

  const handleSignUp = useCallback(async (email: string, password: string) => {
    if (isSubmitting || !email.trim() || !password) {
      setNotice('Enter email and password.');
      return;
    }
    setIsSubmitting(true);
    setNotice(null);
    const success = await signUpWithPassword(email, password);
    setIsSubmitting(false);
    if (!success) {
      setNotice('Sign up failed. Try again.');
      return;
    }
    writeAuthTransitionSignal({ mode: 'signup', fromGuestMode: false });
    setNotice('Account created. Check email if confirmation is enabled.');
  }, [isSubmitting, signUpWithPassword]);

  const handleGoogleSignIn = useCallback(async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setNotice(null);
    writeAuthTransitionSignal({ mode: 'oauth', fromGuestMode: false });
    await signInWithGoogle();
    setIsSubmitting(false);
  }, [isSubmitting, signInWithGoogle]);

  const handleResetPassword = useCallback(async (email: string) => {
    if (isSubmitting) return;
    if (!email.trim()) {
      setNotice('Enter your email to receive a reset link.');
      return;
    }
    setIsSubmitting(true);
    setNotice(null);
    const success = await requestPasswordReset(email);
    setIsSubmitting(false);
    if (success) setNotice('Reset email sent. Check your inbox.');
  }, [isSubmitting, requestPasswordReset]);

  const handleEnterLocal = useCallback(() => {
    playClickSound();
    onEnterLocalMode();
  }, [onEnterLocalMode]);

  return (
    <SignInPage
      onSignIn={handleSignIn}
      onSignUp={handleSignUp}
      onGoogleSignIn={handleGoogleSignIn}
      onResetPassword={handleResetPassword}
      onEnterLocal={handleEnterLocal}
      notice={notice}
      error={error}
      isSubmitting={isSubmitting}
    />
  );
};
