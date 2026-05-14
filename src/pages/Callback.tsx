/**
 * Callback.tsx
 *
 * Handles the AniList OAuth redirect.
 *
 * Why the `useRef` guard?
 * ───────────────────────
 * React 18 (StrictMode) intentionally mounts → unmounts → remounts every component
 * in development to surface side-effect bugs.  Even in production a fast navigation
 * back to this route, a hot-module reload, or a parent Suspense boundary can cause
 * the effect to fire twice before the component is torn down.
 *
 * AniList authorization codes are SINGLE-USE.  A second POST to
 * /.netlify/functions/exchange-token with the same code returns 500 (invalid_grant),
 * which shows up in the console as "Error in token exchange: Failed to exchange token".
 *
 * The `exchanged` ref is the idiomatic React solution: it is set synchronously to
 * `true` on the first render that owns the code, so any subsequent re-run of the
 * effect exits immediately without making a network request.
 *
 * Separately, the `?code=` param is removed from the URL once exchange starts so
 * that a hard refresh on the callback URL does not replay the (already-used) code.
 */

import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

type ExchangeState = 'idle' | 'exchanging' | 'success' | 'error';

export default function Callback() {
  const [searchParams]        = useSearchParams();
  const navigate               = useNavigate();
  const [state, setState]      = useState<ExchangeState>('idle');
  const [errorMsg, setErrorMsg] = useState<string>('');

  /**
   * Guards against double-invocation.
   * Using a ref (not state) means the write is synchronous and visible to the
   * very next effect run — state updates are asynchronous and arrive too late.
   */
  const exchanged = useRef(false);

  useEffect(() => {
    // ── Guard: already exchanged in this mount cycle ──────────────────────────
    if (exchanged.current) return;
    exchanged.current = true;

    const code  = searchParams.get('code');
    const state = searchParams.get('state');        // CSRF token echoed back by AniList

    // ── Validate code presence ────────────────────────────────────────────────
    if (!code) {
      console.error('[Callback] No authorization code in URL');
      setState('error');
      setErrorMsg('Missing authorization code. Please try logging in again.');
      return;
    }

    // ── Optional: CSRF validation ─────────────────────────────────────────────
    const storedCsrf = sessionStorage.getItem('anilist_csrf');
    if (storedCsrf && state !== storedCsrf) {
      console.error('[Callback] CSRF token mismatch');
      setState('error');
      setErrorMsg('Security check failed. Please try logging in again.');
      return;
    }
    sessionStorage.removeItem('anilist_csrf');

    // ── Remove the code from the URL immediately ──────────────────────────────
    // This prevents a hard-refresh from replaying an already-used code.
    window.history.replaceState({}, document.title, window.location.pathname);

    setState('exchanging');

    // ── Determine the exchange endpoint ───────────────────────────────────────
    const platform = import.meta.env.VITE_DEPLOY_PLATFORM;
    const endpoint = platform === 'VERCEL'
      ? '/api/exchange-token'
      : '/.netlify/functions/exchange-token';

    // ── Exchange the code for an access token ─────────────────────────────────
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

        // ── Store token ───────────────────────────────────────────────────────
        localStorage.setItem('accessToken', json.accessToken);

        // ── Fetch user data & cache it ────────────────────────────────────────
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
        const viewer   = userJson?.data?.Viewer;

        if (viewer) {
          localStorage.setItem('zenime_userData', JSON.stringify({ data: viewer, ts: Date.now() }));
          localStorage.setItem('zenime_lastValidation', Date.now().toString());
          console.log('[Callback] ✅ Cached user data after token exchange:', viewer.name);
        }

        // ── Notify AuthProvider ───────────────────────────────────────────────
        window.dispatchEvent(
          new CustomEvent('authTokenReceived', { detail: { token: json.accessToken } }),
        );

        setState('success');

        // Small delay so the success state is briefly visible, then navigate home.
        setTimeout(() => navigate('/', { replace: true }), 500);

      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[Callback] Token exchange error:', msg);
        setState('error');
        setErrorMsg(msg);
      }
    })();

    // searchParams is stable for the lifetime of this page load; navigate is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── UI ────────────────────────────────────────────────────────────────────────

  if (state === 'error') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
                    justifyContent: 'center', minHeight: '100vh', gap: '1rem',
                    fontFamily: 'sans-serif', padding: '2rem', textAlign: 'center' }}>
        <p style={{ color: '#e53e3e', maxWidth: 480 }}>
          Login failed: {errorMsg || 'Unknown error'}
        </p>
        <button
          onClick={() => navigate('/', { replace: true })}
          style={{ padding: '0.5rem 1.5rem', cursor: 'pointer',
                   borderRadius: 6, border: 'none', background: '#3182ce',
                   color: '#fff', fontSize: '1rem' }}
        >
          Back to home
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
                  minHeight: '100vh', fontFamily: 'sans-serif' }}>
      <p style={{ opacity: 0.7 }}>
        {state === 'success' ? '✅ Logged in! Redirecting…' : 'Completing login…'}
      </p>
    </div>
  );
}