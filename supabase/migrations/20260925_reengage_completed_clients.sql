-- Let a client who has finished their intake come back as a new lead.
--
-- lead_email_in_use() refused an email that appeared on any form in
-- 'appointment_sent', 'scheduled', 'pending_intake' or 'completed_intake'.
-- The first three are right: those forms are still with the client, and a
-- second one would leave them holding two links and the firm reading two sets
-- of answers.
--
-- 'completed_intake' is different. The client has finished; the matter moves
-- on to Clio and to drafting. Nothing is in flight. But because no status
-- exists beyond it, a completed form stays completed forever — so the email
-- was blocked forever, and a client returning to update a will or to start a
-- second matter could not be entered at all. Estate planning clients do come
-- back; that is the business.
--
-- The unique index on pending leads is untouched, so two *pending* leads for
-- one email are still impossible. What this allows is a new lead alongside a
-- finished form, which is a real and ordinary situation.

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
  -- 'completed_intake' deliberately absent — see the note above.
  if exists (select 1 from forms
              where status in ('appointment_sent', 'scheduled', 'pending_intake')
                and lower(trim(client_email)) = v_email) then
    return 'ACTIVE_FORM';
  end if;
  return null;
end;
$$;

revoke all on function public.lead_email_in_use(text) from public, anon;
grant execute on function public.lead_email_in_use(text) to authenticated;
