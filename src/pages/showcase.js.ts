import type { APIRoute } from 'astro';
import { buildShowcase } from '../lib/showcase';

export const prerender = true;

export const GET: APIRoute = async () => {
  const payload = JSON.stringify(await buildShowcase()).replace(/</g, '\\u003c');
  return new Response(`window.__JOB_YANG_SHOWCASE__ = ${payload};\n`, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=300',
    },
  });
};
