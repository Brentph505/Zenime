import { v4 as uuidv4 } from 'uuid';
export const handler = async (event) => {
    if (event.httpMethod !== 'GET') {
        return new Response('Method Not Allowed', {
            status: 405,
        });
    }
    const csrfToken = uuidv4();
    return new Response(JSON.stringify({ csrfToken }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    });
};
