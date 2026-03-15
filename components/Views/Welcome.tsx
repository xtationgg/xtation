import React, { useCallback, useMemo, useState } from 'react';
import { SignInPage } from '../UI/sign-in';
import { useAuth } from '../../src/auth/AuthProvider';
import { writeAuthTransitionSignal } from '../../src/auth/authTransitionSignal';
import { playClickSound } from '../../utils/SoundEffects';
import { readSignInMediaConfig } from '../../src/admin/signInMedia';

interface WelcomeProps {
  onEnterLocalMode: () => void;
  onResumeGuidedSetup?: () => void;
}

export const Welcome: React.FC<WelcomeProps> = ({ onEnterLocalMode }) => {
  const { error, signInWithGoogle, signUpWithPassword, signInWithPassword, requestPasswordReset } = useAuth();
  const mediaConfig = useMemo(() => readSignInMediaConfig(), []);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSignIn = useCallback(async (email: string, password: string): Promise<boolean> => {
    if (isSubmitting || !email.trim() || !password) {
      setNotice('Enter email and password.');
      return false;
    }
    setIsSubmitting(true);
    setNotice(null);
    const success = await signInWithPassword(email, password);
    setIsSubmitting(false);
    if (!success) {
      setNotice('Login failed. Check credentials.');
      return false;
    }
    writeAuthTransitionSignal({ mode: 'login', fromGuestMode: false });
    return true;
  }, [isSubmitting, signInWithPassword]);

  const handleSignUp = useCallback(async (email: string, password: string): Promise<boolean> => {
    if (isSubmitting || !email.trim() || !password) {
      setNotice('Enter email and password.');
      return false;
    }
    setIsSubmitting(true);
    setNotice(null);
    const success = await signUpWithPassword(email, password);
    setIsSubmitting(false);
    if (!success) {
      setNotice('Sign up failed. Try again.');
      return false;
    }
    writeAuthTransitionSignal({ mode: 'signup', fromGuestMode: false });
    setNotice('Account created. Check email if confirmation is enabled.');
    return true;
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
      mediaSrc={mediaConfig.mediaSrc}
      mediaSuccessSrc={mediaConfig.mediaSuccessSrc}
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
