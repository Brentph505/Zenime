import { v4 as uuidv4 } from 'uuid';

export default async function handler(event: import('@netlify/functions').HandlerEvent, context: import('@netlify/functions').HandlerContext) {
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: 'Method Not Allowed',
    };
  }

  const csrfToken = uuidv4();

  return {
    statusCode: 200,
    body: JSON.stringify({ csrfToken }),
  };
};