-- ============================================================================
-- Code review fixes — run once in the Supabase SQL editor, BEFORE deploying the
-- matching app code (branch code-review-fixes-isuru-overall).
--
-- What it does
--   1. Adds the columns the app now relies on.
--   2. Converts naive `timestamp` columns to `timestamptz` (values were always
--      written as UTC, so they are interpreted as UTC).
--   3. Replaces ALL row-level security policies on lawyers, screening_submissions
--      and forms. The anon (public) key gets no access at all; the client-facing
--      forms go through /api/* with the service-role key instead.
--   4. Adds qualify_lead(): creates the form and marks the lead qualified in
--      one transaction, only if the lead is still pending.
--   5. Adds link_my_lawyer_profile(): links a signed-in user to the lawyer row
--      an admin created for their email — and only if it is unclaimed.
--
-- The whole script runs in one transaction: if any step fails, nothing changes.
--
-- PREFLIGHT: run these first; each should return no rows.
--
--   -- duplicate pending-lead emails (would block the unique index in step 7)
--   select lower(trim(contact_data->>'email')) as email, count(*)
--     from screening_submissions
--    where status = 'pending' and coalesce(contact_data->>'email', '') <> ''
--    group by 1 having count(*) > 1;
--
--   -- views that depend on these tables (would block the timestamptz change)
--   select distinct view_name, table_name
--     from information_schema.view_column_usage
--    where table_schema = 'public'
--      and table_name in ('lawyers', 'screening_submissions', 'forms');
--
--   -- lawyers sharing an email (they are left unlinked until fixed)
--   select lower(trim(email)), count(*) from lawyers group by 1 having count(*) > 1;
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Columns
-- ---------------------------------------------------------------------------
alter table lawyers add column if not exists auth_user_id uuid;
create unique index if not exists lawyers_auth_user_id_key on lawyers (auth_user_id) where auth_user_id is not null;

-- Link existing lawyers to their sign-in accounts by email (only where exactly
-- one lawyer row has that email, so an ambiguous match is left for an admin).
update lawyers l
   set auth_user_id = u.id
  from auth.users u
 where l.auth_user_id is null
   and lower(trim(l.email)) = lower(trim(u.email))
   and (select count(*) from lawyers l2 where lower(trim(l2.email)) = lower(trim(l.email))) = 1;

alter table forms add column if not exists intake_sent_at    timestamptz;
alter table forms add column if not exists clio_populated_at timestamptz;
alter table forms add column if not exists send_back_at      timestamptz;
alter table forms add column if not exists send_back_count   integer not null default 0;
alter table forms add column if not exists reminder_3d_sent  timestamptz;
alter table forms add column if not exists reminder_1w_sent  timestamptz;
alter table forms add column if not exists reminder_2w_sent  timestamptz;

alter table forms add column if not exists screening_id      text;

-- ---------------------------------------------------------------------------
-- 2. timestamp -> timestamptz (values are UTC)
-- ---------------------------------------------------------------------------
do $$
declare
  col record;
begin
  for col in
    select table_name, column_name
      from information_schema.columns
     where table_schema = 'public'
       and table_name in ('lawyers', 'screening_submissions', 'forms')
       and data_type = 'timestamp without time zone'
  loop
    execute format(
      'alter table public.%I alter column %I type timestamptz using %I at time zone ''UTC''',
      col.table_name, col.column_name, col.column_name
    );
  end loop;
end $$;

-- Forms already waiting on the client: last_accessed was set when the intake
-- email went out, so it is the best available "sent at". (Runs after the
-- conversion above so every source column is already timestamptz.)
update forms
   set intake_sent_at = coalesce(last_accessed, updated_at, created_at)
 where status = 'pending_intake' and intake_sent_at is null;

-- ---------------------------------------------------------------------------
-- 3. Identity helpers used by the policies
--    SECURITY DEFINER so the policies can read `lawyers` without recursing
--    into the lawyers policy itself.
-- ---------------------------------------------------------------------------
create or replace function public.current_lawyer_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select id::text from lawyers where auth_user_id = auth.uid() limit 1
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_admin from lawyers where auth_user_id = auth.uid() limit 1), false)
$$;

revoke all on function public.current_lawyer_id() from public, anon;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.current_lawyer_id() to authenticated;
grant execute on function public.is_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Row-level security — drop every existing policy, then recreate
-- ---------------------------------------------------------------------------
do $$
declare
  pol record;
begin
  for pol in
    select tablename, policyname
      from pg_policies
     where schemaname = 'public'
       and tablename in ('lawyers', 'screening_submissions', 'forms')
  loop
    execute format('drop policy %I on public.%I', pol.policyname, pol.tablename);
  end loop;
end $$;

alter table lawyers               enable row level security;
alter table screening_submissions enable row level security;
alter table forms                 enable row level security;

-- lawyers: every linked lawyer can read the list (for the assignment and
-- filter dropdowns); only admins can change it. Linking a profile goes through
-- link_my_lawyer_profile().
create policy lawyers_select on lawyers
  for select to authenticated
  using (public.current_lawyer_id() is not null);

create policy lawyers_admin_insert on lawyers
  for insert to authenticated
  with check (public.is_admin());

create policy lawyers_admin_update on lawyers
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy lawyers_admin_delete on lawyers
  for delete to authenticated
  using (public.is_admin());

-- screening_submissions: admins see everything, lawyers see their own. Any
-- linked lawyer may create a lead for any lawyer (assigning ownership).
create policy screenings_select on screening_submissions
  for select to authenticated
  using (public.is_admin() or lawyer_id::text = public.current_lawyer_id());

create policy screenings_insert on screening_submissions
  for insert to authenticated
  with check (public.current_lawyer_id() is not null);

create policy screenings_update on screening_submissions
  for update to authenticated
  using (public.is_admin() or lawyer_id::text = public.current_lawyer_id())
  with check (public.is_admin() or lawyer_id::text = public.current_lawyer_id());

create policy screenings_delete on screening_submissions
  for delete to authenticated
  using (public.is_admin() or lawyer_id::text = public.current_lawyer_id());

-- forms: admins see everything, lawyers see their own. Rows are created only
-- by qualify_lead(); clients reach their form through /api/* (service role).
create policy forms_select on forms
  for select to authenticated
  using (public.is_admin() or lawyer_id::text = public.current_lawyer_id());

create policy forms_update on forms
  for update to authenticated
  using (public.is_admin() or lawyer_id::text = public.current_lawyer_id())
  with check (public.is_admin() or lawyer_id::text = public.current_lawyer_id());

create policy forms_delete on forms
  for delete to authenticated
  using (public.is_admin() or lawyer_id::text = public.current_lawyer_id());

-- ---------------------------------------------------------------------------
-- 5. qualify_lead(): one transaction, only from 'pending'
-- ---------------------------------------------------------------------------
create or replace function public.qualify_lead(p_screening_id text)
returns table (form_id text, client_name text, client_email text)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_me        text := public.current_lawyer_id();
  v_lead      screening_submissions%rowtype;
  v_owner     lawyers.id%type;
  v_matches   integer;
  v_name      text;
  v_email     text;
begin
  if v_me is null then
    raise exception 'NOT_AUTHORISED';
  end if;

  select * into v_lead
    from screening_submissions
   where id::text = p_screening_id
   for update;

  if not found then
    raise exception 'LEAD_NOT_FOUND';
  end if;

  if not public.is_admin() and v_lead.lawyer_id::text is distinct from v_me then
    raise exception 'NOT_AUTHORISED';
  end if;

  if v_lead.status is distinct from 'pending' then
    raise exception 'LEAD_ALREADY_ACTIONED';
  end if;

  -- The form belongs to the person responsible when that names exactly one
  -- lawyer; otherwise it stays with the lead's current owner.
  select count(*) into v_matches
    from lawyers
   where lower(trim(full_name)) = lower(trim(coalesce(v_lead.person_responsible, '')));

  if v_matches > 1 then
    raise exception 'LAWYER_AMBIGUOUS';
  elsif v_matches = 1 then
    select id into v_owner
      from lawyers
     where lower(trim(full_name)) = lower(trim(v_lead.person_responsible));
  else
    select id into v_owner from lawyers where id::text = v_lead.lawyer_id::text;
    if not found then
      raise exception 'LAWYER_NOT_FOUND';
    end if;
  end if;

  v_name  := coalesce(nullif(trim(v_lead.contact_data ->> 'name'), ''),
                      nullif(trim(v_lead.contact_data ->> 'contactName'), ''),
                      'Unknown');
  v_email := lower(trim(coalesce(nullif(v_lead.contact_data ->> 'email', ''),
                                 v_lead.contact_data ->> 'contactEmail', '')));

  insert into forms (
    lawyer_id, screening_id, client_name, client_email, lead_type, region, referral_type,
    billing_type, person_responsible, status, progress_pct, unique_link, created_at
  ) values (
    v_owner, v_lead.id::text, v_name, v_email, v_lead.lead_type, v_lead.region, v_lead.referral_type,
    v_lead.billing_type, coalesce(v_lead.person_responsible, ''), 'appointment_sent', 0,
    replace(gen_random_uuid()::text, '-', ''), now()
  )
  returning forms.id::text into form_id;

  update screening_submissions
     set status = 'qualified', updated_at = now()
   where id = v_lead.id;

  client_name  := v_name;
  client_email := v_email;
  return next;
end;
$$;

revoke all on function public.qualify_lead(text) from public, anon;
grant execute on function public.qualify_lead(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. link_my_lawyer_profile(): claim only an UNCLAIMED profile whose email an
--    admin has already set to the signed-in user's email.
-- ---------------------------------------------------------------------------
create or replace function public.link_my_lawyer_profile()
returns setof lawyers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_email   text := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
  v_matches integer;
begin
  if v_uid is null then
    raise exception 'NOT_SIGNED_IN';
  end if;

  if exists (select 1 from lawyers where auth_user_id = v_uid) then
    return query select * from lawyers where auth_user_id = v_uid;
    return;
  end if;

  if v_email = '' then
    raise exception 'NO_PROFILE';
  end if;

  select count(*) into v_matches
    from lawyers
   where lower(trim(email)) = v_email and auth_user_id is null;

  if v_matches = 0 then
    if exists (select 1 from lawyers where lower(trim(email)) = v_email) then
      raise exception 'PROFILE_ALREADY_CLAIMED';
    end if;
    raise exception 'NO_PROFILE';
  elsif v_matches > 1 then
    raise exception 'DUPLICATE_PROFILE';
  end if;

  return query
    update lawyers
       set auth_user_id = v_uid, email = v_email
     where lower(trim(email)) = v_email and auth_user_id is null
    returning *;
end;
$$;

revoke all on function public.link_my_lawyer_profile() from public, anon;
grant execute on function public.link_my_lawyer_profile() to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Duplicate guards
--    lead_email_in_use() checks across ALL lawyers (row-level security would
--    otherwise hide another lawyer's duplicate) but returns only a reason
--    code, never the other record.
-- ---------------------------------------------------------------------------
create or replace function public.lead_email_in_use(p_email text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
begin
  if public.current_lawyer_id() is null then
    raise exception 'NOT_AUTHORISED';
  end if;
  if v_email = '' then
    return null;
  end if;
  if exists (select 1 from screening_submissions
              where status = 'pending' and lower(trim(contact_data ->> 'email')) = v_email) then
    return 'PENDING_LEAD';
  end if;
  if exists (select 1 from forms
              where status in ('appointment_sent', 'scheduled', 'pending_intake', 'completed_intake')
                and lower(trim(client_email)) = v_email) then
    return 'ACTIVE_FORM';
  end if;
  return null;
end;
$$;

revoke all on function public.lead_email_in_use(text) from public, anon;
grant execute on function public.lead_email_in_use(text) to authenticated;

-- One pending lead per email (case-insensitive), enforced by the database
-- ---------------------------------------------------------------------------
create unique index if not exists screening_pending_email_key
  on screening_submissions (lower(trim(contact_data ->> 'email')))
  where status = 'pending' and coalesce(contact_data ->> 'email', '') <> '';

commit;

-- ---------------------------------------------------------------------------
-- After running: confirm the public key can no longer read anything. Each of
-- these should return [] when called with only the anon/publishable key:
--   GET /rest/v1/forms?select=id
--   GET /rest/v1/screening_submissions?select=id
--   GET /rest/v1/lawyers?select=id
-- ---------------------------------------------------------------------------
