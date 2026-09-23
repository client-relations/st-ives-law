/**
 * Run the /api serverless functions locally.
 *
 * `vite dev` serves the UI but not the functions in /api, which are Vercel
 * handlers. Without this, anything touching Clio or document generation can
 * only be tested by deploying. This runs the real handlers in-process; the
 * dev-server proxy in artifacts/questionnaire/vite.config.ts forwards /api
 * here, so the whole app works from one origin at http://localhost:3000.
 *
 *   pnpm --filter @workspace/scripts dev:api
 *
 * Needs a .env at the repo root with the server-side credentials (Clio OAuth,
 * SUPABASE_SERVICE_ROLE_KEY). `vercel env pull` fills one in if the project is
 * linked. It is gitignored — never commit it.
 *
 * This is a development convenience, not a production server. Vercel runs the
 * same handler files directly.
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';

const PORT = Number(process.env.DEV_API_PORT || 3100);
const API_DIR = join(import.meta.dirname, '..', '..', 'api');

/** Route -> handler module. Add an entry when you add an endpoint. */
const ROUTES: Record<string, string> = {
  '/api/sync-clio-matters': 'sync-clio-matters.ts',
  '/api/clio-matter': 'clio-matter.ts',
  '/api/generate-document': 'generate-document.ts',
  '/api/send-to-clio-multipart': 'send-to-clio-multipart.ts',
};

type VercelRequest = IncomingMessage & { query: Record<string, string>; body: unknown };

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(chunk as Buffer));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  });
}

/** Adapt Node's response to the slice of Vercel's API the handlers use. */
function decorate(res: ServerResponse) {
  const target = res as ServerResponse & {
    status: (code: number) => typeof target;
    json: (payload: unknown) => typeof target;
  };
  target.status = (code: number) => {
    target.statusCode = code;
    return target;
  };
  target.json = (payload: unknown) => {
    target.setHeader('Content-Type', 'application/json');
    target.end(JSON.stringify(payload));
    return target;
  };
  return target;
}

createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://localhost:${PORT}`);
  const moduleName = ROUTES[url.pathname];

  if (!moduleName) {
    decorate(res).status(404).json({ error: `No local handler for ${url.pathname}` });
    return;
  }

  const raw = await readBody(req);
  const request = req as VercelRequest;
  request.query = Object.fromEntries(url.searchParams);
  try {
    request.body = raw ? JSON.parse(raw) : {};
  } catch {
    request.body = {};
  }

  console.log(`[api] ${req.method} ${url.pathname}`);
  try {
    // Imported per request so edits to a handler take effect without a restart.
    const module = await import(
      `${pathToFileURL(join(API_DIR, moduleName)).href}?t=${Date.now()}`
    );
    await module.default(request, decorate(res));
  } catch (error) {
    console.error(`[api] ${url.pathname} threw:`, error);
    if (!res.headersSent) {
      decorate(res).status(500).json({ error: String((error as Error)?.message || error) });
    }
  }
}).listen(PORT, () => {
  console.log(`Dev API on http://localhost:${PORT}`);
  console.log(`Routes: ${Object.keys(ROUTES).join(', ')}`);

  const missing = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'CLIO_CLIENT_ID',
    'CLIO_CLIENT_SECRET',
    'CLIO_REFRESH_TOKEN',
  ].filter((name) => !process.env[name]);

  if (missing.length) {
    console.warn(`Missing from .env: ${missing.join(', ')} — those routes will fail.`);
  }
});
