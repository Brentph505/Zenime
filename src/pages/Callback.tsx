/**
 * Callback.tsx
 *
 * Handles the AniList OAuth redirect.
 *
 * Why the `useRef` guard?
 * ───────────────────────
 * React 18 (StrictMode) intentionally mounts → unmounts → remounts every component
 * in development to surface side-effect bugs. Even in production a fast navigation
 * back to this route, a hot-module reload, or a parent Suspense boundary can cause
 * the effect to fire twice before the component is torn down.
 *
 * AniList authorization codes are SINGLE-USE. A second POST to
 * /.netlify/functions/exchange-token with the same code returns 500 (invalid_grant),
 * which shows up in the console as "Error in token exchange: Failed to exchange token".
 *
 * The `exchanged` ref is set synchronously on the first run, so any later re-run of
 * the effect exits immediately without making a network request.
 *
 * Separately, the `?code=` param is removed from the URL once exchange starts so
 * that a hard refresh on the callback URL does not replay the (already-used) code.
 *
 * NOTE: the redirect timeout below is intentionally NOT cleared on unmount. With the
 * guard above, StrictMode's first (fake) unmount would otherwise cancel it and the
 * second run would never schedule it again.
 */

import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import styled, { keyframes } from 'styled-components';
import { FaCheck, FaExclamationTriangle } from 'react-icons/fa';

// ─── Design tokens (same as the Info page) ───────────────────────────────────

const A = {
  accent:     '#c084fc',
  accentDim:  'rgba(192,132,252,0.15)',
  accentGlow: 'rgba(192,132,252,0.10)',
  text:       'var(--global-text)',
  muted:      'var(--global-text-muted)',
  card:       'var(--global-card-bg)',
  border:     'var(--global-border)',
  danger:     '#f87171',
};

// ─── Steps ────────────────────────────────────────────────────────────────────

const STEPS = [
  'Checking the login request',
  'Signing you in',
  'Loading your profile',
] as const;

type Viewer = { name: string; avatar?: string };

// ─── Animations ───────────────────────────────────────────────────────────────

const rise = keyframes`
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
`;
const spin = keyframes`to { transform: rotate(360deg); }`;
const pop = keyframes`
  0%   { transform: scale(0.6); opacity: 0; }
  70%  { transform: scale(1.08); }
  100% { transform: scale(1); opacity: 1; }
`;

// ─── Styled ───────────────────────────────────────────────────────────────────

const Page = styled.div`
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  box-sizing: border-box;
  font-family: 'DM Sans', 'Segoe UI', sans-serif;
  color: ${A.text};
  background:
    radial-gradient(60rem 28rem at 50% -8rem, ${A.accentGlow}, transparent 70%),
    transparent;
`;

const Card = styled.main`
  width: 100%;
  max-width: 400px;
  padding: 2rem 1.75rem 1.75rem;
  background: #f8f9fa;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  box-sizing: border-box;
  animation: ${rise} 0.45s ease both;
  .dark-mode & { background: var(--global-div-tr); border-color: ${A.border}; }
  @media (max-width: 480px) { padding: 1.5rem 1.15rem; }
  @media (prefers-reduced-motion: reduce) { animation: none; }
`;

const Brand = styled.div`
  font-size: 1.1rem;
  font-weight: 800;
  letter-spacing: 0.02em;
  margin-bottom: 1.5rem;
  color: #1f2937;
  .dark-mode & { color: ${A.text}; }
  span { color: ${A.accent}; }
`;

const Badge = styled.div<{ $tone: 'work' | 'ok' | 'err' }>`
  width: 56px;
  height: 56px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1rem;
  overflow: hidden;
  flex-shrink: 0;
  border: 1px solid ${({ $tone }) =>
    $tone === 'err' ? 'rgba(248,113,113,0.5)' : A.accent};
  background: ${({ $tone }) =>
    $tone === 'err' ? 'rgba(248,113,113,0.12)' : A.accentDim};
  color: ${({ $tone }) => ($tone === 'err' ? A.danger : A.accent)};
  ${({ $tone }) => $tone !== 'work' && `animation: ${pop} 0.4s ease both;`}
  @media (prefers-reduced-motion: reduce) { animation: none; }
`;

const Avatar = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
`;

const Ring = styled.div`
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 2.5px solid ${A.accentDim};
  border-top-color: ${A.accent};
  animation: ${spin} 0.8s linear infinite;
  @media (prefers-reduced-motion: reduce) { animation-duration: 2.4s; }
`;

const Heading = styled.h1`
  font-size: 1.4rem;
  font-weight: 800;
  line-height: 1.2;
  margin: 0 0 0.35rem;
  color: #1f2937;
  word-break: break-word;
  .dark-mode & { color: ${A.text}; }
`;

const Sub = styled.p`
  font-size: 0.88rem;
  line-height: 1.6;
  margin: 0;
  color: #6b7280;
  .dark-mode & { color: ${A.muted}; }
`;

const StepList = styled.ol`
  list-style: none;
  margin: 1.5rem 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
`;

const StepRow = styled.li<{ $state: 'pending' | 'active' | 'done' | 'failed' }>`
  display: flex;
  align-items: center;
  gap: 0.7rem;
  padding: 0.5rem 0;
  font-size: 0.85rem;
  font-weight: ${({ $state }) => ($state === 'active' || $state === 'failed' ? 600 : 500)};
  color: ${({ $state }) =>
    $state === 'failed' ? A.danger :
    $state === 'pending' ? '#9ca3af' : '#1f2937'};
  .dark-mode & {
    color: ${({ $state }) =>
      $state === 'failed' ? A.danger :
      $state === 'pending' ? A.muted : A.text};
  }
`;

const StepDot = styled.span<{ $state: 'pending' | 'active' | 'done' | 'failed' }>`
  width: 20px;
  height: 20px;
  border-radius: 50%;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.55rem;
  border: 1px solid ${({ $state }) =>
    $state === 'failed' ? A.danger :
    $state === 'pending' ? A.border : A.accent};
  background: ${({ $state }) =>
    $state === 'done' ? A.accent :
    $state === 'failed' ? 'rgba(248,113,113,0.12)' : 'transparent'};
  color: ${({ $state }) =>
    $state === 'done' ? '#0a0a0c' :
    $state === 'failed' ? A.danger : A.accent};
`;

const MiniRing = styled.span`
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 2px solid ${A.accentDim};
  border-top-color: ${A.accent};
  animation: ${spin} 0.8s linear infinite;
  @media (prefers-reduced-motion: reduce) { animation-duration: 2.4s; }
`;

const ErrorBox = styled.div`
  margin-top: 1.25rem;
  padding: 0.7rem 0.85rem;
  border: 1px solid rgba(248,113,113,0.4);
  border-radius: 8px;
  background: rgba(248,113,113,0.08);
  color: ${A.danger};
  font-size: 0.8rem;
  line-height: 1.5;
  word-break: break-word;
`;

const PrimaryBtn = styled.button`
  width: 100%;
  margin-top: 1.25rem;
  padding: 0.75rem;
  background: ${A.accent};
  color: #0a0a0c;
  border: none;
  border-radius: 6px;
  font-size: 0.82rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
  transition: filter 0.2s, transform 0.15s;
  &:hover { filter: brightness(1.12); transform: translateY(-1px); }
  &:focus-visible { outline: 2px solid ${A.accent}; outline-offset: 3px; }
`;

// ─── Component ────────────────────────────────────────────────────────────────

export default function Callback() {
  const [searchParams] = useSearchParams();
  const navigate       = useNavigate();

  // 0..2 = the step currently running, 3 = finished
  const [step, setStep]         = useState(0);
  const [failedStep, setFailed] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [viewer, setViewer]     = useState<Viewer | null>(null);

  /**
   * Guards against double-invocation. A ref (not state) is written
   * synchronously, so the very next effect run sees it.
   */
  const exchanged = useRef(false);

  useEffect(() => {
    if (exchanged.current) return;
    exchanged.current = true;

    let current = 0; // step index, mirrored to state, used to know where a failure happened
    const goTo = (n: number) => { current = n; setStep(n); };
    const fail = (msg: string) => { setFailed(current); setErrorMsg(msg); };

    const code      = searchParams.get('code');
    const csrfState = searchParams.get('state'); // CSRF token echoed back by AniList

    // ── Step 0: validate the request ──────────────────────────────────────────
    if (!code) {
      console.error('[Callback] No authorization code in URL');
      fail('Missing authorization code. Please try logging in again.');
      return;
    }

    const storedCsrf = sessionStorage.getItem('anilist_csrf');
    if (storedCsrf && csrfState !== storedCsrf) {
      console.error('[Callback] CSRF token mismatch');
      fail('Security check failed. Please try logging in again.');
      return;
    }
    sessionStorage.removeItem('anilist_csrf');

    // Remove the code from the URL immediately so a hard refresh can't replay it.
    window.history.replaceState({}, document.title, window.location.pathname);

    // ── Step 1: exchange the code for a token ─────────────────────────────────
    goTo(1);

    const platform = import.meta.env.VITE_DEPLOY_PLATFORM;
    const endpoint = platform === 'VERCEL'
      ? '/api/exchange-token'
      : '/.netlify/functions/exchange-token';

    (async () => {
      try {
        const res = await fetch(endpoint, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ code }),
        });

        const json = await res.json();

        if (!res.ok || !json.accessToken) {
          throw new Error(json.error ?? json.details ?? `HTTP ${res.status}`);
        }

        localStorage.setItem('accessToken', json.accessToken);

        // ── Step 2: fetch the profile & cache it ────────────────────────────────
        goTo(2);

        // A failed profile fetch should not undo a successful login, so it is
        // non-fatal: the token is already stored and AuthProvider can refetch.
        try {
          const userRes = await fetch('https://graphql.anilist.co', {
            method:  'POST',
            headers: {
              'Content-Type':  'application/json',
              'Authorization': `Bearer ${json.accessToken}`,
            },
            body: JSON.stringify({
              query: `query { Viewer { id name avatar { large medium } bannerImage
                statistics {
                  anime { count meanScore minutesWatched episodesWatched }
                  manga { count meanScore chaptersRead volumesRead }
                }
              }}`,
            }),
          });

          const userJson = await userRes.json();
          const v        = userJson?.data?.Viewer;

          if (v) {
            localStorage.setItem('zenime_userData', JSON.stringify({ data: v, ts: Date.now() }));
            localStorage.setItem('zenime_lastValidation', Date.now().toString());
            console.log('[Callback] ✅ Cached user data after token exchange:', v.name);
            setViewer({ name: v.name, avatar: v.avatar?.large ?? v.avatar?.medium });
          }
        } catch (profileErr) {
          console.warn('[Callback] Profile fetch failed (non-fatal):', profileErr);
        }

        // Notify AuthProvider
        window.dispatchEvent(
          new CustomEvent('authTokenReceived', { detail: { token: json.accessToken } }),
        );

        goTo(3);

        // Leave the welcome state visible for a moment, then go home.
        setTimeout(() => navigate('/', { replace: true }), 1400);

      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[Callback] Token exchange error:', msg);
        fail(msg);
      }
    })();

    // searchParams is stable for the lifetime of this page load; navigate is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── UI ────────────────────────────────────────────────────────────────────

  const isError = failedStep !== null;
  const isDone  = !isError && step === 3;
  const tone    = isError ? 'err' : isDone ? 'ok' : 'work';

  const heading = isError
    ? "Couldn't sign you in"
    : isDone
      ? viewer ? `Welcome back, ${viewer.name}` : "You're signed in"
      : 'Signing you in';

  const sub = isError
    ? 'Nothing was changed on your account. Go back and try again.'
    : isDone
      ? 'Taking you to the home page.'
      : 'Connecting your AniList account. This only takes a moment.';

  const stepState = (i: number): 'pending' | 'active' | 'done' | 'failed' => {
    if (isError) return i < failedStep! ? 'done' : i === failedStep ? 'failed' : 'pending';
    if (i < step) return 'done';
    if (i === step) return 'active';
    return 'pending';
  };

  return (
    <Page>
      <Card aria-live="polite" aria-busy={!isError && !isDone}>
        <Brand>Ze<span>nime</span></Brand>

        <Badge $tone={tone}>
          {isError ? <FaExclamationTriangle size={20} />
            : isDone
              ? (viewer?.avatar
                  ? <Avatar src={viewer.avatar} alt="" />
                  : <FaCheck size={20} />)
              : <Ring />}
        </Badge>

        <Heading>{heading}</Heading>
        <Sub>{sub}</Sub>

        <StepList>
          {STEPS.map((label, i) => {
            const s = stepState(i);
            return (
              <StepRow key={label} $state={s}>
                <StepDot $state={s}>
                  {s === 'done'   && <FaCheck />}
                  {s === 'failed' && '!'}
                  {s === 'active' && <MiniRing />}
                </StepDot>
                {label}
              </StepRow>
            );
          })}
        </StepList>

        {isError && (
          <>
            <ErrorBox role="alert">{errorMsg || 'Unknown error'}</ErrorBox>
            <PrimaryBtn onClick={() => navigate('/', { replace: true })}>
              Back to home
            </PrimaryBtn>
          </>
        )}
      </Card>
    </Page>
  );
}