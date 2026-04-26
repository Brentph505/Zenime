import axios from 'axios';

export const handler = async (event: { httpMethod: string; body: string | null }) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let code: string | undefined;
  try {
    const parsed = JSON.parse(event.body ?? '{}');
    code = parsed.code;
  } catch {
    return { statusCode: 400, body: 'Invalid JSON body' };
  }

  if (!code) {
    return { statusCode: 400, body: 'Authorization code is required' };
  }

  const payload = {
    client_id: process.env.VITE_CLIENT_ID,
    client_secret: process.env.VITE_CLIENT_SECRET,
    code,
    grant_type: 'authorization_code',
    redirect_uri: process.env.VITE_REDIRECT_URI,
  };

  try {
    const response = await axios.post('https://anilist.co/api/v2/oauth/token', payload, {
      headers: {
        'Content-Type': 'application/json',
        'Accept-Encoding': 'identity',
      },
    });

    if (response.data.access_token) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken: response.data.access_token }),
      };
    }

    throw new Error('Access token not found in the response');
  } catch (error: unknown) {
    const details =
      error instanceof Error
        ? axios.isAxiosError(error) && error.response
          ? error.response.data
          : error.message
        : 'An unknown error occurred';

    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to exchange token', details }),
    };
  }
};
