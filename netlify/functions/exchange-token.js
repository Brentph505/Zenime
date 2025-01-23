const axios = require('axios');

exports.handler = async function(event, context) {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: 'Method Not Allowed',
    };
  }

  const { code } = JSON.parse(event.body);
  if (!code) {
    return {
      statusCode: 400,
      body: 'Authorization code is required',
    };
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
      return {
        statusCode: 200,
        body: JSON.stringify({ accessToken: response.data.access_token }),
      };
    } else {
      throw new Error('Access token not found in the response');
    }
  } catch (error) {
    const message = error.message;
    const details = axios.isAxiosError(error) && error.response ? error.response.data : message;
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to exchange token',
        details,
      }),
    };
  }
};
