# Data: Supabase schema (owner: Rebecca)

One table, `events`, holds the learning events the dashboard needs.
Students never log in: the app writes with the public **anon** key, the teacher dashboard reads by **class code**.

## Privacy rules
- Only a **nickname** and a **class code** identify a student. No real names, emails, photos, location or device IDs.
- Nicknames are stored for the teacher dashboard only. They are **never sent to the LLM** (`/api/hint` drops them).
- The anon key can **insert** rows and **read rows for one class code**. It can never update or delete.
- Keys live in Vercel env vars and `.env.local` only (`SUPABASE_URL`, `SUPABASE_ANON_KEY`). Never in git.

## Table `events`
Which `LearningEvent`s are stored: `activity_completed` and `mistake` (enough for stars, time and top mistakes).
`activity_started` / `action` / `hint_shown` stay local.

| Column | Type | From the event | Notes |
| --- | --- | --- | --- |
| `id` | `bigint` identity | | primary key |
| `class_code` | `text` | entry screen | 4–8 chars, `A-Z0-9`, upper case |
| `nickname` | `text` | entry screen | 1–20 chars |
| `activity` | `text` | `activity` | `sort`, `program`, `circuit`, `build`, `arm` |
| `type` | `text` | `type` | `activity_completed` or `mistake` |
| `challenge` | `smallint` | `challenge` | completed only, else null |
| `code` | `text` | `code` | mistake only, e.g. `HIT_WALL` |
| `stars` | `smallint` | `stars` | completed only, 0–3 |
| `seconds` | `integer` | `seconds` | completed only |
| `mistakes` | `integer` | `mistakes` | completed only |
| `client_t` | `bigint` | `t` | when it happened on the device (ms); events can sync late when offline |
| `created_at` | `timestamptz` | | set by the server |

## SQL (run once in the Supabase SQL editor)

```sql
create table public.events (
  id          bigint generated always as identity primary key,
  class_code  text not null check (class_code ~ '^[A-Z0-9]{4,8}$'),
  nickname    text not null check (char_length(nickname) between 1 and 20),
  activity    text not null check (activity in ('sort','program','circuit','build','arm')),
  type        text not null check (type in ('activity_completed','mistake')),
  challenge   smallint,
  code        text check (code is null or code ~ '^[A-Z_]{1,40}$'),
  stars       smallint check (stars is null or stars between 0 and 3),
  seconds     integer check (seconds is null or seconds between 0 and 86400),
  mistakes    integer check (mistakes is null or mistakes >= 0),
  client_t    bigint,
  created_at  timestamptz not null default now(),
  check (type <> 'mistake' or code is not null),
  check (type <> 'activity_completed' or stars is not null)
);

create index events_class_idx on public.events (class_code, created_at);

alter table public.events enable row level security;

-- Students (anon): insert only. No update, no delete (no policy = denied).
create policy "anon can insert events"
  on public.events for insert to anon
  with check (true);

-- No direct select for anon. The dashboard reads one class through this function,
-- so nobody can list every class with the public key.
create or replace function public.class_events(p_class_code text)
returns setof public.events
language sql stable security definer set search_path = public
as $$
  select * from public.events
  where class_code = upper(p_class_code)
  order by created_at;
$$;

revoke all on function public.class_events(text) from public;
grant execute on function public.class_events(text) to anon;
```

**Why a function instead of a select policy:** an RLS `select` policy can't see which class code the caller "meant",
so `select * from events` with the anon key would return every class. The `security definer` function only ever
returns rows for the code passed in. The class code is the teacher's shared secret: pick codes that are hard to guess
(6+ chars), and treat the dashboard as "anyone with the code can see the class" (no PII is stored, by design).

## How the app uses it
- **Write** (progress sync, `src/tutor` / sync module): `POST {SUPABASE_URL}/rest/v1/events` with headers
  `apikey: <anon key>` and `Authorization: Bearer <anon key>`, body = one row or an array of rows.
  Queue rows in local storage while offline and flush when back online.
- **Read** (dashboard): `POST {SUPABASE_URL}/rest/v1/rpc/class_events` with `{ "p_class_code": "ABC123" }`.
  The dashboard computes stars/time per nickname × activity and the top 3 mistake codes.

## Demo class
Seed rows for class code `DEMO26` before the pitch (script TBD in `dashboard/`), so the dashboard is never empty.
