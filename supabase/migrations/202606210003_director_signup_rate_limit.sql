create table if not exists public.director_signup_rate_limits (
  attempt_key text primary key,
  window_started_at timestamptz not null default now(),
  attempt_count integer not null default 0
);

alter table public.director_signup_rate_limits enable row level security;

create or replace function public.consume_director_signup_attempt(
  p_attempt_key text,
  max_attempts integer default 5,
  window_seconds integer default 900
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  attempts integer;
begin
  if p_attempt_key is null or length(p_attempt_key) <> 64 then
    return false;
  end if;

  insert into public.director_signup_rate_limits (
    attempt_key,
    window_started_at,
    attempt_count
  )
  values (p_attempt_key, now(), 1)
  on conflict (attempt_key) do update
  set
    window_started_at = case
      when director_signup_rate_limits.window_started_at
        < now() - make_interval(secs => window_seconds)
      then now()
      else director_signup_rate_limits.window_started_at
    end,
    attempt_count = case
      when director_signup_rate_limits.window_started_at
        < now() - make_interval(secs => window_seconds)
      then 1
      else director_signup_rate_limits.attempt_count + 1
    end
  returning attempt_count into attempts;

  return attempts <= max_attempts;
end;
$$;

revoke all on table public.director_signup_rate_limits from anon, authenticated;
revoke all on function public.consume_director_signup_attempt(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_director_signup_attempt(text, integer, integer)
  to service_role;
