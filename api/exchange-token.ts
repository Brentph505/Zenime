import axios from 'axios';

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  let body: { code?: string };
  try {
    body = await req.json();
  } catch {
    return new Response('Invalid JSON body', { status: 400 });
  }

  const { code } = body;
  if (!code) {
    return new Response('Authorization code is required', { status: 400 });
  }

  const payload = {
    client_id: process.env.VITE_CLIENT_ID,
    client_secret: process.env.VITE_CLIENT_SECRET,
    code,
    grant_type: 'authorization_code',
    redirect_uri: process.env.VITE_REDIRECT_URI,
  };

  const url = 'https://anilist.co/api/v2/oauth/token';

  try {
    const response = await axios.post(url, payload, {
      headers: {
        'Content-Type': 'application/json',
        'Accept-Encoding': 'identity',
      },
    });

    if (response.data.access_token) {
      return new Response(JSON.stringify({ accessToken: response.data.access_token }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } else {
      throw new Error('Access token not found in the response');
    }
  } catch (error: unknown) {
    if (error instanceof Error) {
      const message = error.message;
      const details = axios.isAxiosError(error) && error.response ? error.response.data : message;
      return new Response(JSON.stringify({ error: 'Failed to exchange token', details }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    } else {
      return new Response(
        JSON.stringify({ error: 'Failed to exchange token', details: 'An unknown error occurred' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }
}

export const config = { path: '/api/exchange-token' }; // adjust path as needed
