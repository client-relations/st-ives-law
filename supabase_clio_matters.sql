-- Local mirror of Clio matters, for the document generation screen.
-- Run this in the Supabase SQL Editor.
--
-- WHY A MIRROR AND NOT A LIVE FETCH
-- The screen shows every client in Clio, paginated and searchable. Clio returns
-- 200 matters per request, so listing them live is one request per 200 rows on
-- every page load — a cost that grows with the firm forever, and you cannot
-- search a remote paginated API without pulling all of it down first.
--
-- So: the LIST is served from here (synced daily by /api/sync-clio-matters),
-- and the DETAIL is fetched live from Clio at the moment a document is
-- generated. Stale-by-a-day is fine for "which clients exist". It is not fine
-- for "who is the executor", which is why that read stays live.

CREATE TABLE IF NOT EXISTS clio_matters (
  clio_id BIGINT PRIMARY KEY,           -- Clio's own matter id, so re-syncs upsert
  display_number TEXT,                  -- e.g. "00123-Smith", shown in the table
  description TEXT,
  status TEXT,                          -- Clio matter status: Open / Pending / Closed
  client_name TEXT NOT NULL DEFAULT '',
  client_type TEXT,                     -- 'Person' for a single, 'Company' for a couple
  is_couple BOOLEAN DEFAULT FALSE,      -- drives whether the document set is generated twice
  mr_name TEXT,                         -- from the matter's "Mr" related contact
  mrs_name TEXT,                        -- from the matter's "Mrs" related contact
  custom_fields JSONB DEFAULT '{}'::jsonb,  -- {"InitialExecutor": "...", "Beneficiary1": "..."}
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

-- The table is sorted newest-synced and searched by client name; both are hot.
CREATE INDEX IF NOT EXISTS idx_clio_matters_client_name ON clio_matters (client_name);
CREATE INDEX IF NOT EXISTS idx_clio_matters_status ON clio_matters (status);
CREATE INDEX IF NOT EXISTS idx_clio_matters_synced_at ON clio_matters (synced_at DESC);

-- Case-insensitive "contains" search over the client name. Without this the
-- ILIKE '%term%' in the client table degrades to a sequential scan as the
-- mirror grows, which is the exact problem this table exists to avoid.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_clio_matters_client_name_trgm
  ON clio_matters USING gin (client_name gin_trgm_ops);

ALTER TABLE clio_matters ENABLE ROW LEVEL SECURITY;

-- Signed-in lawyers read the mirror. Nobody writes to it through the anon key:
-- the sync job authenticates with the service role, which bypasses RLS. This
-- matters because the anon key ships inside the frontend bundle, so an
-- anon-writable table is a publicly writable table.
CREATE POLICY "lawyers_read_clio_matters"
  ON clio_matters
  FOR SELECT
  TO authenticated
  USING (true);

-- Verify
SELECT tablename, policyname FROM pg_policies WHERE tablename = 'clio_matters';
