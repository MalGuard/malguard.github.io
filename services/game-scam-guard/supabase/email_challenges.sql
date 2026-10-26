-- REVIEW REQUIRED. Apply to staging first; no automatic Production migration.
-- This ledger stores random IDs and keyed email digests, never codes or emails.
begin;
create table if not exists public.guard_email_challenges (
 id uuid primary key,
 expires_at timestamptz not null,
 attempts smallint not null default 0 check (attempts between 0 and 5),
 consumed boolean not null default false
);
create index if not exists guard_email_challenges_expiry on public.guard_email_challenges(expires_at);
create table if not exists public.guard_email_challenge_rates (
 subject text primary key check (subject ~ '^[a-f0-9]{64}$'),
 window_start timestamptz not null,
 count smallint not null check (count between 1 and 3)
);
create index if not exists guard_email_challenge_rates_window on public.guard_email_challenge_rates(window_start);
alter table public.guard_email_challenges enable row level security;
alter table public.guard_email_challenge_rates enable row level security;
revoke all on public.guard_email_challenges,public.guard_email_challenge_rates from public,anon,authenticated;

create or replace function public.guard_issue_email_challenge(p_id uuid,p_subject text)
returns boolean language plpgsql security definer set search_path=pg_catalog as $$
declare current_count smallint; t timestamptz := clock_timestamp();
begin
 if p_id is null or p_subject is null or p_subject !~ '^[a-f0-9]{64}$' then return false; end if;
 -- An atomic upsert locks this subject across all API instances.
 insert into public.guard_email_challenge_rates(subject,window_start,count) values(p_subject,t,1)
 on conflict(subject) do update set
   window_start=case when guard_email_challenge_rates.window_start<=t-interval '15 minutes' then t else guard_email_challenge_rates.window_start end,
   count=case when guard_email_challenge_rates.window_start<=t-interval '15 minutes' then 1 else guard_email_challenge_rates.count+1 end
 where guard_email_challenge_rates.window_start<=t-interval '15 minutes' or guard_email_challenge_rates.count<3
 returning count into current_count;
 if current_count is null then return false; end if;
 insert into public.guard_email_challenges(id,expires_at) values(p_id,t+interval '10 minutes');
 -- Bound each cleanup batch; expired rows are never accepted even before pruning.
 delete from public.guard_email_challenges where expires_at<t and id in (select id from public.guard_email_challenges where expires_at<t limit 500);
 delete from public.guard_email_challenge_rates where window_start<t-interval '1 day' and subject in (select subject from public.guard_email_challenge_rates where window_start<t-interval '1 day' limit 500);
 return true;
end $$;

create or replace function public.guard_attempt_email_challenge(p_id uuid,p_matched boolean)
returns boolean language plpgsql security definer set search_path=pg_catalog as $$
declare affected integer;
begin
 if p_id is null or p_matched is null then return false; end if;
 -- Row update and consumption are one transaction: at most one successful caller.
 update public.guard_email_challenges set attempts=attempts+1,consumed=p_matched
 where id=p_id and expires_at>clock_timestamp() and attempts<5 and consumed=false;
 get diagnostics affected=row_count;
 return affected=1 and p_matched;
end $$;

revoke all on function public.guard_issue_email_challenge(uuid,text) from public,anon,authenticated;
revoke all on function public.guard_attempt_email_challenge(uuid,boolean) from public,anon,authenticated;
grant execute on function public.guard_issue_email_challenge(uuid,text) to service_role;
grant execute on function public.guard_attempt_email_challenge(uuid,boolean) to service_role;
commit;
