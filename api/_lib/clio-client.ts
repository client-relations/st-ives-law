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
  'client{id,name,type,date_of_birth}',
  'responsible_attorney{id,name}',
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
  /** Named by the intake's Make scenario rather than by the firm by hand. */
  fromIntake?: boolean;
} {
  const withoutFileNumber = displayNumber.replace(/^\s*\d+\s*-\s*/, '');

  // Matters created from the intake form are named by the Make scenario, which
  // writes a couple as
  //   "JamesCarter (Engineer) and Emily Rose Carter (Teacher) - Married - Mirror wills - Carter, James"
  // Read the two spouses straight out of that shape. Taken through the generic
  // split below, the second spouse came back as "Emily Rose Carter (Teacher) -
  // Married - Mirror wills - Carter, James" and was printed into the mirror
  // documents. The first spouse is glued together by Make (no space between
  // first and last name); normaliseMatter swaps in the contact's own name.
  const intakeCouple = /^(.+?)\s*\([^)]*\)\s+and\s+(.+?)\s*\([^)]*\)\s+-\s/i.exec(withoutFileNumber);
  if (intakeCouple) {
    const mr = intakeCouple[1].trim();
    const mrs = intakeCouple[2].trim();
    return { name: `${mr} & ${mrs}`, isCouple: true, mr, mrs, fromIntake: true };
  }

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
    fromIntake: false,
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
  /** The Advance Care Directive prints these; wills do not use them. */
  client_date_of_birth: string;
  responsible_attorney: string;
  /**
   * Contact data. Clio will not nest a contact's address or phone inside a
   * matter query, so these are only filled by fetchMatter (one extra call per
   * matter, at generation time) and stay empty in the bulk sync.
   */
  client_address: string;
  client_phone: string;
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

  // An intake couple's first spouse is the Clio contact, whose real name has
  // the space Make's matter description drops ("JamesCarter" -> "James Carter").
  const mr_name =
    derived.fromIntake && rawClientName && !isRedacted(rawClientName) ? String(rawClientName) : derived.mr;

  return {
    clio_id: Number(raw?.id),
    display_number: displayNumber,
    description: String(raw?.description || ''),
    status: String(raw?.status || ''),
    client_name,
    client_type: String(raw?.client?.type || ''),
    is_couple: derived.isCouple,
    mr_name,
    mrs_name: derived.mrs,
    custom_fields,
    client_date_of_birth: String(raw?.client?.date_of_birth || ''),
    responsible_attorney: String(raw?.responsible_attorney?.name || ''),
    client_address: '',
    client_phone: '',
  };
}

/**
 * The Clio user whose name matches the person responsible on the form, so the
 * matter can carry a real responsible attorney. Needs the Clio app to hold the
 * Users read permission; without it Clio answers 403 and this returns null,
 * which leaves the matter's attorney unset rather than failing the send.
 */
export async function findUserIdByName(token: string, name: string): Promise<number | null> {
  const wanted = String(name || '').trim().toLowerCase();
  if (!wanted) return null;
  try {
    const json = await clioGet(`${CLIO_API}/users.json?fields=id,name,enabled&limit=200`, token);
    const users: { id: number; name: string; enabled: boolean }[] = json?.data || [];
    const exact = users.find((u) => u.enabled && String(u.name).trim().toLowerCase() === wanted);
    const partial = users.find((u) => u.enabled && String(u.name).toLowerCase().includes(wanted.split(' ')[0]));
    return (exact || partial)?.id ?? null;
  } catch (err) {
    console.warn(`Could not look up Clio user "${name}":`, (err as Error).message);
    return null;
  }
}

/** The client's postal address and phone, which every will and the ACD print. */
async function fetchContactDetails(
  token: string,
  contactId: number,
): Promise<{ address: string; phone: string }> {
  const fields = 'primary_address{street,city,province,postal_code},primary_phone_number';
  const json = await clioGet(`${CLIO_API}/contacts/${contactId}.json?fields=${encodeURIComponent(fields)}`, token);
  const a = json?.data?.primary_address;
  const address = a
    ? [a.street, a.city, [a.province, a.postal_code].filter(Boolean).join(' ')].filter((part) => part && String(part).trim()).join(', ')
    : '';
  return { address, phone: String(json?.data?.primary_phone_number || '') };
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
  const matter = normaliseMatter(json.data);

  // The will's execution block and the ACD's Part 1 print the client's address
  // and phone. They live on the contact, which needs its own request.
  const contactId = Number(json.data?.client?.id);
  if (contactId) {
    try {
      const contact = await fetchContactDetails(token, contactId);
      matter.client_address = contact.address;
      matter.client_phone = contact.phone;
    } catch (err) {
      console.warn(`Could not read contact ${contactId} for matter ${matterId}; address and phone stay empty`, err);
    }
  }
  return matter;
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

  // Contact and user data rather than custom fields. fetchMatter fills the
  // address and phone from the contact record; the bulk sync does not.
  if (matter.client_date_of_birth) {
    // Clio stores YYYY-MM-DD; the statutory form is read as day/month/year.
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(matter.client_date_of_birth);
    variables['Matter.Client.DateOfBirth'] = m ? `${m[3]}/${m[2]}/${m[1]}` : matter.client_date_of_birth;
  }
  if (matter.client_address) variables['Matter.Client.Address'] = matter.client_address;
  if (matter.client_phone) variables['Matter.Client.PhoneNumber'] = matter.client_phone;
  if (matter.responsible_attorney) {
    variables['Matter.ResponsibleAttorney'] = matter.responsible_attorney;
  }

  return variables;
}


/**
 * Put a file on a matter. Clio's v4 API will not take bytes inline, so this is
 * the three-step handshake api/send-to-clio-multipart.ts documents: create the
 * document record and receive a signed put_url, PUT the bytes there, then PATCH
 * the record as fully_uploaded so Clio shows it on the matter.
 *
 * Shared by that endpoint and by the end-to-end document check in
 * scripts/checks, so the test files documents exactly the way the app does.
 */
export async function uploadDocumentToMatter(
  token: string,
  matterId: number,
  fileName: string,
  bytes: Buffer,
): Promise<{ documentId: number }> {
  const jsonHeaders = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const createResponse = await fetch(
    `${CLIO_API}/documents.json?fields=id,name,latest_document_version{uuid,put_url,put_headers}`,
    {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({
        data: {
          name: fileName,
          parent: { id: Number(matterId), type: 'Matter' },
          document_version: { fully_uploaded: false },
        },
      }),
    },
  );
  const createText = await createResponse.text();
  if (!createResponse.ok) {
    throw new Error(`Clio rejected the document record (${createResponse.status}): ${createText.slice(0, 800)}`);
  }
  const created = JSON.parse(createText);
  const documentId = created?.data?.id;
  const version = created?.data?.latest_document_version;
  const putUrl: string | undefined = version?.put_url;
  const versionUuid: string | undefined = version?.uuid;
  const putHeaders: { name: string; value: string }[] = version?.put_headers || [];
  if (!documentId || !putUrl || !versionUuid) {
    throw new Error(`Clio did not return an upload URL: ${createText.slice(0, 800)}`);
  }

  const uploadHeaders: Record<string, string> = {};
  for (const h of putHeaders) uploadHeaders[h.name] = h.value;
  const uploadResponse = await fetch(putUrl, { method: 'PUT', headers: uploadHeaders, body: new Uint8Array(bytes) });
  if (!uploadResponse.ok) {
    const uploadText = await uploadResponse.text().catch(() => '');
    throw new Error(`Uploading the file to Clio storage failed (${uploadResponse.status}): ${uploadText.slice(0, 800)}`);
  }

  const finaliseResponse = await fetch(`${CLIO_API}/documents/${documentId}.json?fields=id,name`, {
    method: 'PATCH',
    headers: jsonHeaders,
    body: JSON.stringify({ data: { uuid: versionUuid, fully_uploaded: true } }),
  });
  if (!finaliseResponse.ok) {
    const finaliseText = await finaliseResponse.text();
    throw new Error(`Clio stored the file but could not finalise it (${finaliseResponse.status}): ${finaliseText.slice(0, 800)}`);
  }
  return { documentId: Number(documentId) };
}
