import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore - plain JS module without types
import { HttpError, sendError } from '../../api/_lib/server.js';

const LEAD_ID = '00000000-0000-4000-8000-000000000001';

function fakeRes(req: unknown) {
  const res: any = { req, statusCode: 0, body: undefined };
  res.status = (code: number) => { res.statusCode = code; return res; };
  res.json = (payload: unknown) => { res.body = payload; return res; };
  return res;
}

function captureWarn(fn: () => void): string[] {
  const lines: string[] = [];
  const spy = mock.method(console, 'warn', (...args: unknown[]) => { lines.push(args.join(' ')); });
  try {
    fn();
  } finally {
    spy.mock.restore();
  }
  return lines;
}

test('a 4xx logs one line with status, route and lead_id only', () => {
  const req = {
    url: '/api/submit-form',
    query: {},
    body: {
      lead_id: LEAD_ID,
      form_type: 'inquiry',
      form_data: { client_name: 'Test Client', client_email: 'isuru+test@lex-ops.io', client_phone: '0400 000 000' },
    },
  };
  const res = fakeRes(req);
  const lines = captureWarn(() =>
    sendError(res, new HttpError(409, 'This form has already been submitted.', 'ALREADY_SUBMITTED')));

  assert.deepEqual(lines, [`[api] 409 /api/submit-form lead_id=${LEAD_ID}`]);
  assert.equal(res.statusCode, 409);
  assert.deepEqual(res.body, { error: 'This form has already been submitted.', code: 'ALREADY_SUBMITTED' });
});

test('the log line never carries the message, the body or the query string', () => {
  const req = { url: `/api/get-form?lead_id=${LEAD_ID}&email=isuru%2Btest%40lex-ops.io`, query: { lead_id: LEAD_ID } };
  const lines = captureWarn(() =>
    sendError(fakeRes(req), new HttpError(400, '"isuru+test@lex-ops.io" is not a valid email address.')));

  assert.equal(lines.length, 1);
  assert.equal(lines[0], `[api] 400 /api/get-form lead_id=${LEAD_ID}`);
  assert.doesNotMatch(lines[0], /@|Test Client|email/);
});

test('a lead_id that is not a UUID is not echoed into the log', () => {
  const req = { url: '/api/submit-form', body: JSON.stringify({ lead_id: 'Test Client <isuru+test@lex-ops.io>' }) };
  const lines = captureWarn(() => sendError(fakeRes(req), new HttpError(400, 'Missing or invalid lead_id')));
  assert.deepEqual(lines, ['[api] 400 /api/submit-form lead_id=-']);
});

test('a 5xx is not logged as a client error and is reported generically', () => {
  const res = fakeRes({ url: '/api/submit-form' });
  const errorSpy = mock.method(console, 'error', () => {});
  try {
    const lines = captureWarn(() => sendError(res, new Error('db down')));
    assert.deepEqual(lines, []);
  } finally {
    errorSpy.mock.restore();
  }
  assert.equal(res.statusCode, 500);
  assert.deepEqual(res.body, { error: 'Server error' });
});
