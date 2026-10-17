/**
 * Serves artifacts/questionnaire/public on localhost for the Playwright tests.
 * /api/* is never served here: every test mocks it with page.route, so a test
 * that forgets a mock fails instead of reaching a real backend.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..', '..', 'artifacts', 'questionnaire', 'public');
const PORT = Number(process.env.TEST_STATIC_PORT || 4310);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith('/api/')) {
    res.writeHead(501).end('API is mocked in tests');
    return;
  }
  const rel = normalize(url.pathname === '/' ? '/intake-form.html' : url.pathname).replace(/^[/\\]+/, '');
  const file = join(ROOT, rel);
  if (!file.startsWith(ROOT)) return res.writeHead(403).end();
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' }).end(body);
  } catch {
    res.writeHead(404).end('Not found');
  }
}).listen(PORT, '127.0.0.1', () => console.log(`static server on http://localhost:${PORT}`));
