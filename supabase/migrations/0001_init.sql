-- Power10 Journalist Desk — schema
create extension if not exists pgcrypto;

create table journalists (
  id             uuid primary key default gen_random_uuid(),
  slug           text unique not null,
  first_name     text not null,
  last_name      text not null,
  display_name   text not null,
  outlets        text[] not null,
  display_outlet text not null,
  sort_order     int not null default 0,
  created_at     timestamptz not null default now()
);

create table sources (
  id             uuid primary key default gen_random_uuid(),
  journalist_id  uuid not null references journalists(id) on delete cascade,
  outlet         text not null,
  kind           text not null check (kind in ('rss','scrape')),
  url            text not null,
  selector       jsonb,
  enabled        boolean not null default true,
  created_at     timestamptz not null default now(),
  unique (journalist_id, url)
);

create table articles (
  id             uuid primary key default gen_random_uuid(),
  journalist_id  uuid not null references journalists(id) on delete cascade,
  outlet         text not null,
  headline       text not null,
  url            text not null,
  synopsis       text,
  published_at   timestamptz not null,
  fetched_at     timestamptz not null default now(),
  unique (journalist_id, url)
);

create index articles_journalist_published_idx
  on articles (journalist_id, published_at desc);

create index articles_published_idx
  on articles (published_at desc);

-- Row-Level Security ----------------------------------------------------
alter table journalists enable row level security;
alter table articles    enable row level security;
alter table sources     enable row level security;

-- Public read policies: the dashboard reads via anon key
create policy "public read journalists"
  on journalists for select using (true);

create policy "public read articles"
  on articles for select using (true);

-- sources table is service-role only (no select policy for anon/authenticated)
