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
 * `relationships` is NOT among them: Clio rejects it as a matter field
 * ("relationships} is not a valid field"), and the standalone
 * /relationships.json endpoint answers 403 for this app. That matters because
 * relationships are how the firm's instructions represent a couple — a Company
 * contact named "<Mr> and <Mrs>" with both people attached as related contacts
 * labelled "Mr" and "Mrs". Without that access, couples are inferred from the
 * matter's display number instead. See deriveCoupleNames below.
 *
 * custom_field_values is requested even though this app currently gets every
 * value back redacted, so that the sync starts populating the moment the Clio
 * app is granted the scope.
 */
const MATTER_FIELDS = [
  'id',
  'display_number',
  'description',
  'status',
  'client{id,name,type}',
  'custom_field_values{id,field_name,field_type,value}',
].join(',');

/** Clio blanks out fields an app cannot read rather than refusing the request. */
function isRedacted(value: unknown): boolean {
  return typeof value === 'string' && /^\*+$/.test(value.trim());
}

/**
 * Recover the client name, and whether it's a couple, from the display number.
 *
 * Contact names come back as "******" for this app, but the matter's display
 * number is readable and the firm embeds the client in it:
 *
 *   "230129-Mrs Juliette Anne Topham,"                     -> single
 *   "230127-Dr Bala Sunderm Goyal & Dr Anjalee Goyal,"     -> couple
 *
 * The "&" is also a far better couple signal than client.type, which this
 * firm's data sets to "Company" on plainly individual clients.
 */
export function deriveFromDisplayNumber(displayNumber: string): {
  name: string;
  isCouple: boolean;
  mr: string;
  mrs: string;
} {
  const withoutFileNumber = displayNumber.replace(/^\s*\d+\s*-\s*/, '');
  const name = withoutFileNumber.replace(/[,\s]+$/, '').trim();

  const parts = name.split(/\s+&\s+|\s+and\s+/i).map((part) => part.trim()).filter(Boolean);

  // "&" alone is not enough: this firm has clients like "A & A Khodarahmi Pty
  // Ltd", which is one company, not two spouses. Two extra tests separate them
  // — a company suffix anywhere in the name, and each side of the "&" having to
  // look like a person's name rather than an initial.
  const looksLikeCompany =
    /\b(pty|ltd|limited|inc|incorporated|llc|corp|corporation|co|services|enterprises|holdings|group|trust|superannuation|smsf|fund|nominees|investments|partners|associates)\b/i.test(
      name,
    );
  const bothSidesArePeople = parts.every((part) => part.split(/\s+/).length >= 2);

  const isCouple = parts.length === 2 && !looksLikeCompany && bothSidesArePeople;

  return {
    name,
    isCouple,
    mr: isCouple ? parts[0] : '',
    mrs: isCouple ? parts[1] : '',
  };
}

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
    // A redacted value arrives as {id: null, redacted: true} with no field_name.
    // Storing those would fill the mirror with nothing; skip them so the
    // completeness badge honestly reports zero until the scope is granted.
    if (cfv?.redacted) continue;

    // field_name is the custom field's name — "InitialExecutor", "Beneficiary1".
    // It doubles as the template variable name, so store it verbatim.
    const name = cfv?.field_name;
    if (!name) continue;
    const value = cfv?.value;
    if (value === null || value === undefined || value === '') continue;
    custom_fields[name] = String(value);
  }

  const displayNumber = String(raw?.display_number || '');
  const derived = deriveFromDisplayNumber(displayNumber);

  // Use the real contact name when this app is allowed to see it, and fall back
  // to the name embedded in the display number when Clio redacts it.
  const rawClientName = raw?.client?.name;
  const client_name =
    rawClientName && !isRedacted(rawClientName) ? String(rawClientName) : derived.name;

  return {
    clio_id: Number(raw?.id),
    display_number: displayNumber,
    description: String(raw?.description || ''),
    status: String(raw?.status || ''),
    client_name,
    client_type: String(raw?.client?.type || ''),
    is_couple: derived.isCouple,
    mr_name: derived.mr,
    mrs_name: derived.mrs,
    custom_fields,
  };
}

/**
 * Pull matters, following Clio's paging cursor until a time budget runs out.
 *
 * This is the call that cannot run on page load: one request per 200 matters,
 * and the count only ever grows. The firm is already at 2037 matters, which is
 * eleven pages and about 80 seconds — past Vercel's 60s ceiling. So the sync is
 * resumable: when the budget is spent it returns the cursor it stopped on, and
 * the caller invokes again until nextCursor comes back null.
 */
export async function fetchMatters(
  token: string,
  options: { cursor?: string; budgetMs?: number } = {},
): Promise<{ matters: ClioMatter[]; nextCursor: string | null }> {
  const budgetMs = options.budgetMs ?? 40_000;
  const startedAt = Date.now();

  let url =
    options.cursor ||
    `${CLIO_API}/matters.json?fields=${encodeURIComponent(MATTER_FIELDS)}&limit=200&order=id(asc)`;
  const matters: ClioMatter[] = [];

  while (url) {
    const json = await clioGet(url, token);
    for (const raw of json?.data || []) matters.push(normaliseMatter(raw));

    // Clio hands back the next page as a full URL; absent means we're done.
    url = json?.meta?.paging?.next || '';

    if (url && Date.now() - startedAt >= budgetMs) {
      console.log(`Budget spent after ${matters.length} matters; handing back a cursor`);
      return { matters, nextCursor: url };
    }
  }

  return { matters, nextCursor: null };
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
