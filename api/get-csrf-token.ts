import { v4 as uuidv4 } from 'uuid';

export const handler = async (): Promise<Response> => {
  const csrfToken = uuidv4();

  return new Response(JSON.stringify({ csrfToken }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
