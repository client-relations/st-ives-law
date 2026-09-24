import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { authHeaders } from '../lib/dashboard-actions';
import {
  DOCUMENTS,
  PACKAGES,
  WILL_DOCUMENT_IDS,
  getDocument,
  missingFieldsFor,
  type DocumentId,
} from '../lib/documentPackages';

/**
 * Document generation, driven by Clio rather than by the intake pipeline.
 *
 * Two screens: a searchable table of every matter in Clio, then a split
 * selection view — packages on the left, individual documents on the right.
 * The list is served from the nightly clio_matters mirror; the values that go
 * into the documents are fetched live from Clio when Generate is pressed.
 */

export type ClioMatterRow = {
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
  synced_at: string;
};

const PAGE_SIZE = 25;

/**
 * Read a JSON response, or explain why it wasn't one.
 *
 * These endpoints are Vercel serverless functions. Anything that doesn't reach
 * them — a plain `vite dev` with no function runtime, a 404, an upstream HTML
 * error page — comes back as non-JSON, and parsing it blind surfaces
 * "Unexpected end of JSON input" to a lawyer, which tells them nothing.
 */
async function readJsonResponse(response: Response, label: string): Promise<any> {
  const text = await response.text();

  let payload: any = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      throw new Error(
        `${label} returned ${response.status} ${response.statusText || ''}`.trim() +
          '. The API route did not respond with JSON — if you are running the dev ' +
          'server directly, serverless functions need `vercel dev`.',
      );
    }
  }

  if (!response.ok) {
    throw new Error(payload?.details || payload?.error || `${label} failed (${response.status})`);
  }

  if (payload === null) throw new Error(`${label} returned an empty response`);
  return payload;
}

export function ClioDocumentGeneration() {
  const [selectedMatter, setSelectedMatter] = useState<ClioMatterRow | null>(null);

  if (selectedMatter) {
    return (
      <DocumentPackageSelector matter={selectedMatter} onBack={() => setSelectedMatter(null)} />
    );
  }

  return <ClioClientTable onSelect={setSelectedMatter} />;
}

/* ------------------------------------------------------------------ */
/* Screen 1: the client table                                          */
/* ------------------------------------------------------------------ */

function ClioClientTable({ onSelect }: { onSelect: (matter: ClioMatterRow) => void }) {
  const [rows, setRows] = useState<ClioMatterRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Debounce so typing doesn't fire a query per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    if (!supabase) {
      setError('Database connection unavailable');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    let query = supabase
      .from('clio_matters')
      .select('*', { count: 'exact' })
      .order('client_name', { ascending: true })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

    if (debouncedSearch) {
      query = query.or(
        `client_name.ilike.%${debouncedSearch}%,display_number.ilike.%${debouncedSearch}%`,
      );
    }

    const { data, count, error: queryError } = await query;

    if (queryError) {
      setError(queryError.message);
      setRows([]);
    } else {
      setRows(data || []);
      setTotal(count || 0);
    }
    setLoading(false);
  }, [page, debouncedSearch]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSync = async () => {
    setSyncing(true);
    setSyncProgress(0);
    setError(null);
    try {
      // The sync endpoint accepts the scheduler's shared secret or a signed-in
      // lawyer's session. The secret stays server-side, so we send the session.
      const headers = await authHeaders();

      // The sync is resumable: the firm has enough matters that one pass would
      // exceed the platform's function timeout, so the endpoint hands back a
      // cursor and we keep calling until it reports done.
      let cursor: string | undefined;
      let runStartedAt: string | undefined;
      let syncedSoFar = 0;

      for (let pass = 0; pass < 50; pass++) {
        const response = await fetch('/api/sync-clio-matters', {
          method: 'POST',
          headers,
          body: JSON.stringify({ cursor, run_started_at: runStartedAt }),
        });

        const result = await readJsonResponse(response, 'Clio sync');
        syncedSoFar += result.synced || 0;
        setSyncProgress(syncedSoFar);

        if (result.done) break;

        cursor = result.cursor;
        runStartedAt = result.run_started_at;
        if (!cursor) break;
      }

      await load();
    } catch (err: any) {
      setError(`Sync failed: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const lastSynced = rows[0]?.synced_at
    ? new Date(rows[0].synced_at).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' })
    : null;

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className='nv-docgen'>
      <div className='nv-docgen-toolbar'>
        <input
          type='search'
          className='nv-docgen-search'
          placeholder='Search by client name or matter number…'
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button type='button' className='nv-btn-view' onClick={handleSync} disabled={syncing}>
          {syncing ? (syncProgress ? `Synced ${syncProgress}…` : 'Syncing…') : 'Sync now'}
        </button>
      </div>

      {lastSynced && (
        <p className='nv-docgen-synced'>
          Showing {total} matter{total === 1 ? '' : 's'} from Clio · last synced {lastSynced}
        </p>
      )}

      {error && <div className='nv-docgen-error'>{error}</div>}

      {loading ? (
        <div className='nv-empty'>Loading matters…</div>
      ) : rows.length === 0 ? (
        <div className='nv-empty'>
          {debouncedSearch
            ? `No matters match "${debouncedSearch}".`
            : 'No matters yet. Run a sync to pull them from Clio.'}
        </div>
      ) : (
        <table className='nv-docgen-table'>
          <thead>
            <tr>
              <th>Client</th>
              <th>Matter</th>
              <th>Type</th>
              <th aria-label='Actions' />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              return (
                <tr key={row.clio_id}>
                  <td className='nv-docgen-client'>{row.client_name || '(unnamed)'}</td>
                  <td>{row.display_number || '—'}</td>
                  <td>{row.is_couple ? 'Couple' : 'Single'}</td>
                  <td className='nv-docgen-actions'>
                    <button type='button' className='nv-btn-qualify' onClick={() => onSelect(row)}>
                      Generate Documents
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {totalPages > 1 && (
        <div className='nv-docgen-pager'>
          <button
            type='button'
            className='nv-btn-view'
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
          >
            Previous
          </button>
          <span>
            Page {page + 1} of {totalPages}
          </span>
          <button
            type='button'
            className='nv-btn-view'
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Screen 2: packages left, individual documents right                 */
/* ------------------------------------------------------------------ */

function DocumentPackageSelector({
  matter,
  onBack,
}: {
  matter: ClioMatterRow;
  onBack: () => void;
}) {
  const [selected, setSelected] = useState<DocumentId[]>([]);
  const [activePackage, setActivePackage] = useState<string | null>(null);
  const [phase, setPhase] = useState<'idle' | 'generating' | 'sending'>('idle');
  // What the last press filed, shown in place rather than on its own screen.
  const [sent, setSent] = useState<{ names: string[]; missingFields: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isCouple = matter.is_couple;

  const choosePackage = (packageId: string) => {
    setSent(null);
    const pkg = PACKAGES.find((p) => p.id === packageId);
    if (!pkg) return;
    setActivePackage(packageId);
    setSelected([...pkg.documents]);
  };

  const toggleDocument = (id: DocumentId) => {
    setSent(null);
    // Picking documents by hand means you are no longer on a package.
    setActivePackage(null);
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((d) => d !== id);
      // The two wills are alternatives, never both — the packages differ only
      // in which one they carry, so selecting one replaces the other.
      const withoutOtherWill = WILL_DOCUMENT_IDS.includes(id)
        ? prev.filter((d) => !WILL_DOCUMENT_IDS.includes(d))
        : prev;
      return [...withoutOtherWill, id];
    });
  };

  const unavailable = useMemo(
    () => selected.filter((id) => getDocument(id).templateType === null),
    [selected],
  );
  const generatable = useMemo(
    () => selected.filter((id) => getDocument(id).templateType !== null),
    [selected],
  );
  const missingFields = useMemo(
    () => missingFieldsFor(generatable, matter.custom_fields),
    [generatable, matter.custom_fields],
  );

  const handleGenerate = async () => {
    if (generatable.length === 0) return;
    setPhase('generating');
    setError(null);

    try {
      // The table is a day-old mirror; the values that go into a will are read
      // live so nobody signs a document built from stale data.
      const authed = await authHeaders();
      const matterResponse = await fetch(`/api/clio-matter?matter_id=${matter.clio_id}`, {
        headers: authed,
      });
      const matterResult = await readJsonResponse(matterResponse, 'Reading the matter from Clio');

      const variables: Record<string, string> = matterResult.variables || {};
      const scenario = isCouple ? 'couple' : 'individual';

      // A couple gets the same set twice — mirror wills. The second version
      // swaps Mr and Mrs so the other spouse becomes the testator.
      const versions = isCouple
        ? [
            { suffix: variables['Matter.Relationships.Mr.Name'] || 'Client 1', variables },
            {
              suffix: variables['Matter.Relationships.Mrs.Name'] || 'Client 2',
              variables: {
                ...variables,
                'Matter.Relationships.Mr.Name': variables['Matter.Relationships.Mrs.Name'] || '',
                'Matter.Relationships.Mrs.Name': variables['Matter.Relationships.Mr.Name'] || '',
                'Matter.Client.Name': variables['Matter.Relationships.Mrs.Name'] || '',
              },
            },
          ]
        : [{ suffix: '', variables }];

      const requests: Promise<any>[] = [];
      for (const documentId of generatable) {
        const definition = getDocument(documentId);
        for (const version of versions) {
          requests.push(
            fetch('/api/generate-document', {
              method: 'POST',
              headers: authed,
              body: JSON.stringify({
                templateType: definition.templateType,
                scenario,
                client_name: version.variables['Matter.Client.Name'] || matter.client_name,
                form_id: matter.display_number,
                ...version.variables,
              }),
            })
              .then((r) => r.json())
              .then((doc) => ({
                ...doc,
                documentName: version.suffix
                  ? `${definition.label} — ${version.suffix}`
                  : `${definition.label} — ${matter.client_name}`,
              })),
          );
        }
      }

      const documents = await Promise.all(requests);
      const failed = documents.find((doc) => doc?.success === false || doc?.error);
      if (failed) throw new Error(failed.error || 'A document failed to generate');

      // Straight on to Clio. There is nothing to review in between — the
      // documents are a merge of Clio's own data, and filing them is the only
      // thing the lawyer was going to do next.
      setPhase('sending');
      for (const doc of documents) {
        const response = await fetch('/api/send-to-clio-multipart', {
          method: 'POST',
          headers: authed,
          body: JSON.stringify({
            docxBase64: doc.documentBase64,
            matter_id: matter.clio_id,
            documentName: doc.documentName,
          }),
        });
        await readJsonResponse(response, `Sending "${doc.documentName}" to Clio`);
      }

      setSent({ names: documents.map((doc) => doc.documentName), missingFields });
      setSelected([]);
      setActivePackage(null);
    } catch (err: any) {
      setError(err.message || 'Failed to generate documents');
    } finally {
      setPhase('idle');
    }
  };

  return (
    <div className='nv-docgen'>
      <div className='nv-docgen-crumb'>
        <button type='button' className='nv-btn-view' onClick={onBack}>
          ← All clients
        </button>
        <div>
          <h3 className='nv-docgen-heading'>{matter.client_name}</h3>
          <p className='nv-docgen-sub'>
            {matter.display_number || 'No matter number'} · {isCouple ? 'Couple' : 'Single'}
            {isCouple && matter.mr_name && matter.mrs_name
              ? ` (${matter.mr_name} & ${matter.mrs_name})`
              : ''}
          </p>
        </div>
      </div>

      <div className='nv-docgen-split'>
        <section className='nv-docgen-pane'>
          <h4 className='nv-docgen-pane-title'>Standard Documents</h4>
          <p className='nv-docgen-pane-hint'>Packages from the firm's estate planning fee schedule.</p>
          {PACKAGES.map((pkg) => (
            <button
              type='button'
              key={pkg.id}
              className={`nv-docgen-card${activePackage === pkg.id ? ' selected' : ''}`}
              onClick={() => choosePackage(pkg.id)}
            >
              <div className='nv-docgen-card-head'>
                <span className='nv-docgen-card-title'>{pkg.label}</span>
              </div>
              <ol className='nv-docgen-card-list'>
                {pkg.documents.map((id) => (
                  <li key={id}>
                    {getDocument(id).label}
                    {isCouple ? ' (x2)' : ''}
                  </li>
                ))}
              </ol>
            </button>
          ))}
        </section>

        <section className='nv-docgen-pane'>
          <h4 className='nv-docgen-pane-title'>Individual Documents</h4>
          <p className='nv-docgen-pane-hint'>Pick any combination instead of a package.</p>
          {DOCUMENTS.map((doc) => {
            const isSelected = selected.includes(doc.id);
            const hasTemplate = doc.templateType !== null;
            return (
              <label
                key={doc.id}
                className={`nv-docgen-card${isSelected ? ' selected' : ''}${hasTemplate ? '' : ' unavailable'}`}
              >
                <div className='nv-docgen-card-head'>
                  <span className='nv-docgen-card-title'>
                    <input
                      type='checkbox'
                      checked={isSelected}
                      onChange={() => toggleDocument(doc.id)}
                    />
                    {doc.label}
                    {isCouple ? ' (x2)' : ''}
                  </span>
                </div>
                <p className='nv-docgen-card-desc'>{doc.description}</p>
                {!hasTemplate && (
                  <p className='nv-docgen-card-warn'>No precedent supplied yet — cannot be generated.</p>
                )}
              </label>
            );
          })}
        </section>
      </div>

      {sent && (
        <div className='nv-docgen-summary nv-docgen-sent'>
          <div>
            <strong>
              Sent to Clio — {sent.names.length} document{sent.names.length === 1 ? '' : 's'} filed
            </strong>
          </div>
          <ul className='nv-docgen-done-list'>
            {sent.names.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
          {sent.missingFields.length > 0 && (
            <p className='nv-docgen-missing'>
              {sent.missingFields.length} field
              {sent.missingFields.length === 1 ? ' was' : 's were'} empty in Clio (
              {sent.missingFields.join(', ')}) — left as <code>&lt;&lt; … &gt;&gt;</code> to fill
              in Word.
            </p>
          )}
        </div>
      )}

      {selected.length > 0 && (
        <div className='nv-docgen-summary'>
          <div>
            <strong>
              {generatable.length * (isCouple ? 2 : 1)} document
              {generatable.length * (isCouple ? 2 : 1) === 1 ? '' : 's'} to generate
            </strong>
          </div>

          {unavailable.length > 0 && (
            <p className='nv-docgen-card-warn'>
              Skipping {unavailable.map((id) => getDocument(id).label).join(', ')} — no precedent on file.
            </p>
          )}

          {missingFields.length > 0 && (
            <p className='nv-docgen-missing'>
              Empty in Clio: {missingFields.join(', ')}. These will stay as
              {' '}<code>&lt;&lt; … &gt;&gt;</code> placeholders in the draft.
            </p>
          )}
        </div>
      )}

      {error && <div className='nv-docgen-error'>{error}</div>}

      <div className='nv-modal-actions'>
        <button
          type='button'
          className='nv-btn-qualify'
          onClick={handleGenerate}
          disabled={phase !== 'idle' || generatable.length === 0}
        >
          {phase === 'generating'
            ? 'Generating…'
            : phase === 'sending'
              ? 'Sending to Clio…'
              : 'Generate & Send to Clio'}
        </button>
      </div>
    </div>
  );
}
