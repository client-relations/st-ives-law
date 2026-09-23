/// <reference types="node" />

/**
 * Shared Clio API client.
 *
 * Until now every Clio call in this project pushed data *up* (a matter via the
 * Make webhook, a document via send-to-clio-multipart). The document generation
 * screen reverses that: Clio becomes the source of truth for which clients
 * exist and for the merge-field values that go into their documents.
 *
 * The happy accident that makes this cheap: the firm's Clio custom fields are
 * named exactly like the template placeholders. A custom field called
 * "InitialExecutor" is what fills << Matter.CustomField.InitialExecutor >>.
 * See "1. Instructions for Clio Coded Precedents.docx" for the full list.
 */

const CLIO_BASE = process.env.CLIO_API_BASE || 'https://au.app.clio.com';
export const CLIO_API = `${CLIO_BASE}/api/v4`;

/** Cached across warm invocations so we don't re-exchange on every request. */
let cachedToken: { value: string; expiresAt: number } | null = null;

/**
 * Obtain a usable Clio access token.
 *
 * With CLIO_CLIENT_ID + CLIO_CLIENT_SECRET + CLIO_REFRESH_TOKEN set, this
 * mints a fresh access token on demand and nobody ever pastes a token again.
 * Refresh tokens do not expire unless revoked.
 */
export async function getClioAccessToken(): Promise<{ token?: string; error?: string }> {
  const clientId = process.env.CLIO_CLIENT_ID;
  const clientSecret = process.env.CLIO_CLIENT_SECRET;
  const refreshToken = process.env.CLIO_REFRESH_TOKEN;

  if (clientId && clientSecret && refreshToken) {
    // Reuse a cached token until a minute before it lapses.
    if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
      return { token: cachedToken.value };
    }

    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });

    const response = await fetch(`${CLIO_BASE}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    const text = await response.text();
    if (!response.ok) {
      console.error('Clio token refresh failed:', response.status, text);
      return { error: `Clio refused the refresh token (${response.status}): ${text.slice(0, 300)}` };
    }

    try {
      const json = JSON.parse(text);
      if (!json.access_token) return { error: 'Clio returned no access_token' };
      cachedToken = {
        value: json.access_token,
        // expires_in is seconds; default to 1h if Clio omits it.
        expiresAt: Date.now() + (Number(json.expires_in) || 3600) * 1000,
      };
      console.log('Clio access token refreshed');
      return { token: cachedToken.value };
    } catch {
      return { error: 'Clio token response was not valid JSON' };
    }
  }

  // Fallback: a manually pasted access token. Expires in days.
  const staticToken = process.env.CLIO_API_TOKEN;
  if (staticToken) return { token: staticToken };

  return {
    error:
      'No Clio credentials configured. Set CLIO_CLIENT_ID + CLIO_CLIENT_SECRET + ' +
      'CLIO_REFRESH_TOKEN (self-renewing), or CLIO_API_TOKEN (expires).',
  };
}

/**
 * GET a Clio URL with auth, retrying once when Clio rate-limits us.
 *
 * Clio answers 429 with a Retry-After header. A full sync of a busy firm is
 * dozens of sequential pages, so hitting the limit is a question of when, not
 * if — honouring the header is cheaper than guessing a delay.
 */
async function clioGet(url: string, token: string, attempt = 0): Promise<any> {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });

  if (response.status === 429 && attempt < 3) {
    const retryAfter = Number(response.headers.get('Retry-After')) || 5;
    console.warn(`Clio rate-limited; waiting ${retryAfter}s before retry ${attempt + 1}`);
    await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
    return clioGet(url, token, attempt + 1);
  }

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Clio GET ${url} failed (${response.status}): ${text.slice(0, 500)}`);
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Clio GET ${url} returned invalid JSON`);
  }
}

/**
 * The fields we need off a matter.
 *
 * `relationships` is how a couple is represented: the instructions docx has the
 * firm create a Company contact named "<Mr> and <Mrs>", then attach both people
 * as related contacts labelled "Mr" and "Mrs". That labelling is what produces
 * << Matter.Relationships.Mr.Name >> in the templates.
 */
const MATTER_FIELDS = [
  'id',
  'display_number',
  'description',
  'status',
  'client{id,name,type}',
  'relationships{id,description,contact{id,name}}',
  'custom_field_values{id,field_name,field_type,value}',
].join(',');

export type ClioMatter = {
  clio_id: number;
  display_number: string;
  description: string;
  status: string;
  client_name: string;
  client_type: string;
  is_couple: boolean;
  mr_name: string;
  mrs_name: string;
  custom_fields: Record<string, string>;
};

/**
 * Flatten Clio's nested matter into the shape the dashboard stores and reads.
 *
 * Everything downstream (the client table, the completeness badge, the merge)
 * works off this shape, so Clio's response format is contained to this file.
 */
export function normaliseMatter(raw: any): ClioMatter {
  const custom_fields: Record<string, string> = {};
  for (const cfv of raw?.custom_field_values || []) {
    // field_name is the custom field's name — "InitialExecutor", "Beneficiary1".
    // It doubles as the template variable name, so store it verbatim.
    const name = cfv?.field_name;
    if (!name) continue;
    const value = cfv?.value;
    if (value === null || value === undefined || value === '') continue;
    custom_fields[name] = String(value);
  }

  const relationships: any[] = raw?.relationships || [];
  const named = (label: string) =>
    relationships.find(
      (r) => String(r?.description || '').trim().toLowerCase() === label,
    )?.contact?.name || '';

  const mr_name = named('mr');
  const mrs_name = named('mrs');

  // Prefer the explicit Mr/Mrs relationship pair. Fall back to the client being
  // a Company, which is how the instructions have couples set up — a matter
  // whose client is a Person is always a single.
  const is_couple = Boolean(mr_name && mrs_name) || raw?.client?.type === 'Company';

  return {
    clio_id: Number(raw?.id),
    display_number: String(raw?.display_number || ''),
    description: String(raw?.description || ''),
    status: String(raw?.status || ''),
    client_name: String(raw?.client?.name || ''),
    client_type: String(raw?.client?.type || ''),
    is_couple,
    mr_name,
    mrs_name,
    custom_fields,
  };
}

/**
 * Pull every matter, following Clio's paging cursor.
 *
 * This is the call that cannot run on page load: it is one request per 200
 * matters, and the count only ever grows. It belongs in the scheduled sync.
 */
export async function fetchAllMatters(
  token: string,
  options: { pageLimit?: number } = {},
): Promise<ClioMatter[]> {
  const maxPages = options.pageLimit ?? 100;
  let url = `${CLIO_API}/matters.json?fields=${encodeURIComponent(MATTER_FIELDS)}&limit=200&order=id(asc)`;
  const matters: ClioMatter[] = [];

  for (let page = 0; page < maxPages && url; page++) {
    const json = await clioGet(url, token);
    for (const raw of json?.data || []) matters.push(normaliseMatter(raw));

    // Clio hands back the next page as a full URL; absent means we're done.
    url = json?.meta?.paging?.next || '';
    if (url) console.log(`Synced ${matters.length} matters so far, fetching next page`);
  }

  return matters;
}

/** Fetch a single matter fresh, for the moment a document is generated. */
export async function fetchMatter(token: string, matterId: string | number): Promise<ClioMatter> {
  const url = `${CLIO_API}/matters/${matterId}.json?fields=${encodeURIComponent(MATTER_FIELDS)}`;
  const json = await clioGet(url, token);
  if (!json?.data) throw new Error(`Clio returned no matter ${matterId}`);
  return normaliseMatter(json.data);
}

/**
 * Turn a matter into the variable map the DOCX merge expects.
 *
 * The template placeholders are fully-qualified — << Matter.CustomField.X >>,
 * << Matter.Client.Name >> — so the keys here carry the same prefixes.
 * Deliberately omits empty values: document-processor leaves a placeholder it
 * was given no value for intact, so the lawyer can see what still needs filling.
 */
export function toTemplateVariables(matter: ClioMatter): Record<string, string> {
  const variables: Record<string, string> = {};

  for (const [name, value] of Object.entries(matter.custom_fields)) {
    variables[`Matter.CustomField.${name}`] = value;
  }

  if (matter.client_name) variables['Matter.Client.Name'] = matter.client_name;
  if (matter.display_number) variables['Matter.ClientReferenceNumber'] = matter.display_number;
  if (matter.mr_name) variables['Matter.Relationships.Mr.Name'] = matter.mr_name;
  if (matter.mrs_name) variables['Matter.Relationships.Mrs.Name'] = matter.mrs_name;

  return variables;
}
