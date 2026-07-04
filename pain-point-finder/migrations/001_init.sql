-- Pain Point Finder — initial schema
create extension if not exists "pgcrypto";

create table if not exists raw_snippets (
  id uuid primary key default gen_random_uuid(),
  source text not null,              -- 'reddit', 'google_play', 'twitter', etc
  source_url text,
  external_id text,                  -- original post/review id, for dedup
  text_content text not null,
  author text,
  posted_at timestamptz,
  ingested_at timestamptz default now(),
  unique(source, external_id)
);

create table if not exists pain_points (
  id uuid primary key default gen_random_uuid(),
  snippet_id uuid references raw_snippets(id),
  pain_summary text,
  intensity_score int,
  frequency_signal int,
  wtp_signal int,
  gap_score int,
  composite_score numeric,
  target_user text,
  existing_solution_mentioned text,
  cluster_id uuid,
  is_pain_point boolean,
  created_at timestamptz default now()
);

create table if not exists clusters (
  id uuid primary key default gen_random_uuid(),
  theme_name text,
  theme_description text,
  snippet_count int default 0,
  distinct_sources_last_7d int default 0,
  avg_score numeric,
  first_seen timestamptz,
  last_seen timestamptz
);

alter table pain_points
  add constraint pain_points_cluster_id_fkey
  foreign key (cluster_id) references clusters(id)
  on delete set null;

create index if not exists idx_pain_points_snippet_id on pain_points(snippet_id);
create index if not exists idx_pain_points_cluster_id on pain_points(cluster_id);
create index if not exists idx_pain_points_composite_score on pain_points(composite_score);
create index if not exists idx_raw_snippets_source on raw_snippets(source);
