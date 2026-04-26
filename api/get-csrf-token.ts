import { v4 as uuidv4 } from 'uuid';

export const handler = async (event: { httpMethod: string }) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const csrfToken = uuidv4();

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ csrfToken }),
  };
};
