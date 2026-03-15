import React, { useState, useCallback } from 'react';
import { Eye, EyeOff, ArrowRight, Check } from 'lucide-react';

const GoogleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="si-icon-svg">
    <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-2.641-.21-5.236-.611-7.743z" />
    <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
    <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
    <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C42.022 35.026 44 30.038 44 24c0-2.641-.21-5.236-.611-7.743z" />
  </svg>
);

const isVideo = (src: string) => /\.(mp4|webm|ogg|mov)(\?|$)/i.test(src) || src.startsWith('blob:');

export interface SignInPageProps {
  mediaSrc?: string;
  mediaSuccessSrc?: string;
  onSignIn?: (email: string, password: string) => Promise<boolean> | void;
  onSignUp?: (email: string, password: string) => Promise<boolean> | void;
  onGoogleSignIn?: () => void;
  onResetPassword?: (email: string) => void;
  onEnterLocal?: () => void;
  notice?: string | null;
  error?: string | null;
  isSubmitting?: boolean;
  compact?: boolean;
}

export const SignInPage: React.FC<SignInPageProps> = ({
  mediaSrc = 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1920&q=80',
  mediaSuccessSrc = 'https://images.unsplash.com/photo-1534996858221-380b92700493?w=1920&q=80',
  onSignIn,
  onSignUp,
  onGoogleSignIn,
  onResetPassword,
  onEnterLocal,
  notice = null,
  error = null,
  isSubmitting = false,
  compact = false,
}) => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authSuccess, setAuthSuccess] = useState(false);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const handler = mode === 'login' ? onSignIn : onSignUp;
    if (!handler) return;
    const result = await handler(email, password);
    if (result === true) setAuthSuccess(true);
  }, [mode, email, password, onSignIn, onSignUp]);

  return (
    <div className="si-viewport">
      <div className={`si-card ${compact ? 'si-card--compact' : ''} ${authSuccess ? 'si-card--done' : ''}`}>

        {!compact ? (
          <div className="si-card-media">
            <div className={`si-ml ${authSuccess ? 'si-ml--out' : ''}`}>
              {mediaSrc && isVideo(mediaSrc) ? (
                <video src={mediaSrc} autoPlay loop muted playsInline className="si-mf" />
              ) : mediaSrc ? (
                <img src={mediaSrc} alt="" className="si-mf" draggable={false} />
              ) : null}
            </div>
            <div className={`si-ml si-ml--back ${authSuccess ? 'si-ml--show' : ''}`}>
              {mediaSuccessSrc && isVideo(mediaSuccessSrc) ? (
                <video src={mediaSuccessSrc} autoPlay loop muted playsInline className="si-mf" />
              ) : mediaSuccessSrc ? (
                <img src={mediaSuccessSrc} alt="" className="si-mf" draggable={false} />
              ) : null}
            </div>
            <div className={`si-card-scrim ${authSuccess ? 'si-card-scrim--light' : ''}`} />
            <div className="si-card-brand">
              <div className="si-card-brand-logo">XTATION</div>
              <div className="si-card-brand-sub">{authSuccess ? 'Station online' : 'Your personal operating system'}</div>
            </div>
          </div>
        ) : null}

        <div className={`si-panel ${authSuccess ? 'si-panel--success' : ''}`}>
          <div className="si-panel-inner">
            <div className="si-brand si-anim si-anim-d1">xtation</div>

            <div className="si-header si-anim si-anim-d2">
              <h1 className="si-title">
                {authSuccess ? "You're in" : mode === 'login' ? 'Welcome back' : 'Get started'}
              </h1>
              <p className="si-subtitle">
                {authSuccess
                  ? 'Authenticated. Entering station...'
                  : mode === 'login'
                    ? 'Sign in to continue where you left off'
                    : 'Create your account to begin'}
              </p>
            </div>

            {!authSuccess ? (
              <>
                <div className="si-tabs si-anim si-anim-d2">
                  <button type="button" className={`si-tab ${mode === 'login' ? 'si-tab--on' : ''}`} onClick={() => setMode('login')}>Sign In</button>
                  <button type="button" className={`si-tab ${mode === 'signup' ? 'si-tab--on' : ''}`} onClick={() => setMode('signup')}>Create Account</button>
                </div>

                <form className="si-form" onSubmit={handleSubmit}>
                  <div className="si-field si-anim si-anim-d3">
                    <label className="si-label">Email</label>
                    <div className="si-input-wrap">
                      <input name="email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="si-input" autoFocus />
                    </div>
                  </div>

                  <div className="si-field si-anim si-anim-d4">
                    <label className="si-label">Password</label>
                    <div className="si-input-wrap">
                      <input name="password" type={showPassword ? 'text' : 'password'} placeholder="Enter password" value={password} onChange={(e) => setPassword(e.target.value)} className="si-input si-input--pw" />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="si-toggle-pw" tabIndex={-1}>
                        {showPassword ? <EyeOff /> : <Eye />}
                      </button>
                    </div>
                  </div>

                  {mode === 'login' ? (
                    <div className="si-row si-anim si-anim-d5">
                      <label className="si-check-label">
                        <span className="si-check-box">
                          <input type="checkbox" name="rememberMe" className="si-check-native" />
                          <span className="si-check-mark" />
                        </span>
                        <span>Remember me</span>
                      </label>
                      <button type="button" className="si-link" onClick={() => onResetPassword?.(email)}>Forgot password?</button>
                    </div>
                  ) : null}

                  {(notice || error) ? (
                    <div className={`si-msg ${error ? 'si-msg--err' : ''}`}>{notice || error}</div>
                  ) : null}

                  <button type="submit" disabled={isSubmitting} className="si-btn-primary si-anim si-anim-d6">
                    <span>{isSubmitting ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}</span>
                    {!isSubmitting ? <ArrowRight /> : null}
                  </button>
                </form>

                <div className="si-sep si-anim si-anim-d7">
                  <span className="si-sep-line" />
                  <span className="si-sep-text">or</span>
                  <span className="si-sep-line" />
                </div>

                <button type="button" onClick={onGoogleSignIn} disabled={isSubmitting} className="si-btn-google si-anim si-anim-d8">
                  <GoogleIcon />
                  <span>Continue with Google</span>
                </button>

                {onEnterLocal ? (
                  <button type="button" onClick={onEnterLocal} className="si-btn-local si-anim si-anim-d9">Enter Local Mode</button>
                ) : null}
              </>
            ) : (
              <div className="si-success si-anim si-anim-d1">
                <div className="si-success-icon"><Check /></div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
