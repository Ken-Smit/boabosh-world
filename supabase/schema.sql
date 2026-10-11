-- Catworld schema. Paste into Supabase SQL editor and run. Safe to run again
-- (everything is create-if-not-exists / create-or-replace) after updates.
-- Security model: RLS on, zero policies. The anon key cannot touch these tables
-- directly. Only the security-definer functions below can, and each one is
-- scoped to the single save code passed in.

create table if not exists saves (
  code       text primary key,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists attempts (
  id      bigserial primary key,
  code    text not null,
  area    text not null,          -- forest | mountain | lab
  skill   text not null,          -- e.g. 'add-within-20', 'short-vowel-a'
  correct boolean not null,
  at      timestamptz not null default now()
);
create index if not exists attempts_code_skill on attempts (code, skill);

alter table saves    enable row level security;
alter table attempts enable row level security;
-- Deliberately no policies. Do not add one that grants anon access.

create or replace function save_put(p_code text, p_data jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_code !~ '^[A-Z0-9]{8}$' then raise exception 'bad code'; end if;
  -- A save with everything bought is ~6 KB of JSON; 32 KB leaves room to grow
  -- while still refusing junk.
  if pg_column_size(p_data) > 32768 then raise exception 'save too big'; end if;
  insert into saves (code, data) values (p_code, p_data)
  on conflict (code) do update
    set data = excluded.data, updated_at = now();
end $$;

create or replace function save_get(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare d jsonb;
begin
  if p_code !~ '^[A-Z0-9]{8}$' then raise exception 'bad code'; end if;
  select data into d from saves where code = p_code;
  return d;
end $$;

-- Batched so a burst of answers is one round trip.
create or replace function attempts_log(p_code text, p_rows jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_code !~ '^[A-Z0-9]{8}$' then raise exception 'bad code'; end if;
  if jsonb_array_length(p_rows) > 100 then raise exception 'too many rows'; end if;
  insert into attempts (code, area, skill, correct)
  select p_code,
         left(r->>'area', 32),
         left(r->>'skill', 64),
         (r->>'correct')::boolean
  from jsonb_array_elements(p_rows) as r;
end $$;

-- Weakest skills first. Feed adaptive difficulty, or a parent progress view.
create or replace function skill_report(p_code text)
returns table (skill text, got bigint, tried bigint)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_code !~ '^[A-Z0-9]{8}$' then raise exception 'bad code'; end if;
  return query
    select a.skill,
           count(*) filter (where a.correct) as got,
           count(*)                          as tried
    from attempts a
    where a.code = p_code
    group by a.skill
    order by (count(*) filter (where a.correct))::numeric / count(*) asc;
end $$;

-- ---------------------------------------------------------------------------
-- Pairing: a short 4-picture code that points at a save code for 10 minutes,
-- once. Short codes are guessable, so they expire, are single-use, and wrong
-- guesses are capped for everyone (30 a minute) so guessing can't keep up.
create table if not exists pairings (
  pics       text primary key,       -- 4 letters from the code alphabet
  code       text not null,
  expires_at timestamptz not null
);
create table if not exists pair_fails (at timestamptz not null default now());
alter table pairings   enable row level security;
alter table pair_fails enable row level security;
-- Deliberately no policies here either.

create or replace function pair_create(p_code text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  alpha constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  b bytea;
  p text;
begin
  if p_code !~ '^[A-Z0-9]{8}$' then raise exception 'bad code'; end if;
  if not exists (select 1 from saves where code = p_code) then raise exception 'no save'; end if;
  delete from pairings where expires_at < now() or code = p_code; -- one live code per save
  if (select count(*) from pairings) > 5000 then raise exception 'busy'; end if;
  loop
    b := uuid_send(gen_random_uuid()); -- bytes 0-3 of a v4 uuid are random
    p := '';
    for i in 0..3 loop p := p || substr(alpha, 1 + get_byte(b, i) % 31, 1); end loop;
    exit when not exists (select 1 from pairings where pics = p);
  end loop;
  insert into pairings (pics, code, expires_at) values (p, p_code, now() + interval '10 minutes');
  return p;
end $$;

create or replace function pair_redeem(p_pics text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare c text;
begin
  if p_pics !~ '^[A-Z0-9]{4}$' then raise exception 'bad code'; end if;
  if (select count(*) from pair_fails where at > now() - interval '1 minute') >= 30 then
    raise exception 'too many tries';
  end if;
  delete from pairings where pics = p_pics and expires_at > now() returning code into c;
  if c is null then
    insert into pair_fails default values;
    delete from pair_fails where at < now() - interval '1 hour';
  end if;
  return c; -- null = no such code (or it expired / was already used)
end $$;

revoke all on function pair_create(text) from public;
revoke all on function pair_redeem(text) from public;
grant execute on function pair_create(text) to anon, authenticated;
grant execute on function pair_redeem(text) to anon, authenticated;

revoke all on function save_put(text, jsonb)     from public;
revoke all on function save_get(text)            from public;
revoke all on function attempts_log(text, jsonb) from public;
revoke all on function skill_report(text)        from public;
grant execute on function save_put(text, jsonb)     to anon, authenticated;
grant execute on function save_get(text)            to anon, authenticated;
grant execute on function attempts_log(text, jsonb) to anon, authenticated;
grant execute on function skill_report(text)        to anon, authenticated;
