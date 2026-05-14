import axios from 'axios';
export const handler = async (event) => {
    // Handle CORS preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
            },
            body: '',
        };
    }
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
            },
            body: 'Method Not Allowed',
        };
    }
    const body = event.body ?? '{}';
    const { code } = JSON.parse(body);
    if (!code) {
        return {
            statusCode: 400,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
            },
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
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ accessToken: response.data.access_token }),
            };
        }
        else {
            throw new Error('Access token not found in the response');
        }
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const details = axios.isAxiosError(error) && error.response ? error.response.data : message;
        console.error('Token exchange error:', details);
        return {
            statusCode: 500,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                error: 'Failed to exchange token',
                details,
            }),
        };
    }
};
