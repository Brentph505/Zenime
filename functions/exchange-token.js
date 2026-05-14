import axios from 'axios';
/**
 * exchange-token.ts  (Netlify Function)
 *
 * Exchanges an AniList authorization code for an access token.
 *
 * ⚠️  IMPORTANT — Environment variables in Netlify Functions:
 *   `VITE_*` variables are injected into the *frontend build* at compile time,
 *   but are NOT automatically available inside serverless functions at runtime.
 *   In the Netlify dashboard add the following plain (non-VITE_) variables:
 *
 *     ANILIST_CLIENT_ID      ← same value as VITE_CLIENT_ID
 *     ANILIST_CLIENT_SECRET  ← same value as VITE_CLIENT_SECRET
 *     ANILIST_REDIRECT_URI   ← same value as VITE_REDIRECT_URI
 *
 *   The function falls back to the VITE_ names so existing deployments keep
 *   working, but the plain names are preferred and should be set explicitly.
 */
export const handler = async (event) => {
    const CORS_HEADERS = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
    };
    // ── CORS preflight ──────────────────────────────────────────────────────────
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers: CORS_HEADERS, body: '' };
    }
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers: CORS_HEADERS,
            body: JSON.stringify({ error: 'Method Not Allowed' }),
        };
    }
    // ── Env-var validation ──────────────────────────────────────────────────────
    // Prefer plain names; fall back to VITE_ for backward compatibility.
    const clientId = process.env.ANILIST_CLIENT_ID ?? process.env.VITE_CLIENT_ID;
    const clientSecret = process.env.ANILIST_CLIENT_SECRET ?? process.env.VITE_CLIENT_SECRET;
    const redirectUri = process.env.ANILIST_REDIRECT_URI ?? process.env.VITE_REDIRECT_URI;
    if (!clientId || !clientSecret || !redirectUri) {
        const missing = [
            !clientId && 'ANILIST_CLIENT_ID',
            !clientSecret && 'ANILIST_CLIENT_SECRET',
            !redirectUri && 'ANILIST_REDIRECT_URI',
        ].filter(Boolean);
        console.error('[exchange-token] ❌ Missing env vars:', missing.join(', '));
        return {
            statusCode: 500,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: 'Server misconfiguration',
                details: `Missing environment variables: ${missing.join(', ')}. ` +
                    'Add ANILIST_CLIENT_ID, ANILIST_CLIENT_SECRET, and ANILIST_REDIRECT_URI ' +
                    'to the Netlify environment settings.',
            }),
        };
    }
    // ── Parse body ──────────────────────────────────────────────────────────────
    let code;
    try {
        ({ code } = JSON.parse(event.body ?? '{}'));
    }
    catch {
        return {
            statusCode: 400,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Invalid JSON body' }),
        };
    }
    if (!code) {
        return {
            statusCode: 400,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Authorization code is required' }),
        };
    }
    // ── Token exchange ──────────────────────────────────────────────────────────
    try {
        const response = await axios.post('https://anilist.co/api/v2/oauth/token', {
            client_id: clientId,
            client_secret: clientSecret,
            code,
            grant_type: 'authorization_code',
            redirect_uri: redirectUri,
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                // Disable compression so we can read the body if AniList returns an error.
                'Accept-Encoding': 'identity',
            },
            timeout: 15000,
        });
        const accessToken = response.data?.access_token;
        if (!accessToken) {
            throw new Error('Access token missing from AniList response');
        }
        return {
            statusCode: 200,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
            body: JSON.stringify({ accessToken }),
        };
    }
    catch (error) {
        const isAxios = axios.isAxiosError(error);
        const status = isAxios ? error.response?.status : undefined;
        const details = isAxios ? (error.response?.data ?? error.message) : String(error);
        // AniList returns 400 with {"error":"invalid_grant"} when the code has
        // already been used. Surface a clearer message instead of a generic 500.
        const isUsedCode = status === 400 &&
            typeof details === 'object' &&
            details.error === 'invalid_grant';
        if (isUsedCode) {
            console.warn('[exchange-token] ⚠️  Code already used (invalid_grant). ' +
                'This usually means the callback fired twice — see README for the useRef fix.');
            return {
                statusCode: 400,
                headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    error: 'Authorization code already used',
                    details: 'This code has already been exchanged for a token. ' +
                        'Ensure the callback component guards against double-invocation.',
                }),
            };
        }
        console.error('[exchange-token] ❌ Token exchange failed:', details);
        return {
            statusCode: 500,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Failed to exchange token', details }),
        };
    }
};
