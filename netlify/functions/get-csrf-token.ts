import { v4 as uuidv4 } from 'uuid';

export default async function handler(event: import('@netlify/functions').HandlerEvent, context: import('@netlify/functions').HandlerContext) {
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