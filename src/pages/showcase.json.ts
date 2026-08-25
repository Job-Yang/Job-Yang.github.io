import type { APIRoute } from 'astro';
import { buildShowcase } from '../lib/showcase';

export const prerender = true;

export const GET: APIRoute = async () => {
  return new Response(
    JSON.stringify(await buildShowcase()),
    {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=300, s-maxage=300',
      },
    },
  );
};
